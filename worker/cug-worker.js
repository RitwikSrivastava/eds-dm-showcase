/*
 * Reference Cloudflare Worker (not deployed with the EDS code; excluded via .hlxignore).
 *
 * Route it in front of the EDS site, e.g. www.example.com/*.
 * Variables: ORIGIN_HOST (…aem.live host), DELIVERY_HOST (delivery-pXXX-eYYY.adobeaemcloud.com),
 *   TOKEN_API_URL (…/adobe/assets/token), ROUTING_HEADER (x-adobe-routing value, per program/env),
 *   LOGIN_PATH (optional fallback when x-aem-cug-login-path is absent, default /login).
 * Secret: IMS_ADMIN_TOKEN (wrangler secret put IMS_ADMIN_TOKEN).
 *
 * POC only: admin/admin is hard-coded and the group cookie is unsigned (forgeable).
 */

const GROUP = 'partners';
const GROUP_COOKIE = 'cug_groups';
const TOKEN_COOKIE = 'asset_token';
const GROUP_COOKIE_TTL = 3600;
const TOKEN_TTL = 3600;
// Header name from the aem-assets-plugin secure-assets block; verify against ABAC delivery docs.
const DELIVERY_TOKEN_HEADER = 'x-asset-delivery-token';

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function userGroups(request) {
  return (getCookie(request, GROUP_COOKIE) || '').split(',').filter(Boolean);
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function handleLogin(request) {
  let creds;
  try {
    creds = await request.json();
  } catch (e) {
    return new Response('Bad request', { status: 400 });
  }
  if (creds.username !== 'admin' || creds.password !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': cookie(GROUP_COOKIE, GROUP, GROUP_COOKIE_TTL), 'Cache-Control': 'no-store' },
  });
}

async function mintAssetToken(env) {
  const resp = await fetch(env.TOKEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.IMS_ADMIN_TOKEN}`,
      'x-adobe-routing': env.ROUTING_HEADER,
    },
    body: JSON.stringify({
      subjectAttributes: { id: GROUP, username: GROUP, groups: [GROUP] },
      validFor: TOKEN_TTL,
    }),
  });
  if (!resp.ok) throw new Error(`Token API returned ${resp.status}`);
  const data = await resp.json();
  // Response shape is not documented here; adjust if the API names the field differently.
  return data.token || data.access_token;
}

function proxyToOrigin(request, env, url) {
  const target = new URL(url);
  target.hostname = env.ORIGIN_HOST;
  const headers = new Headers(request.headers);
  headers.set('x-forwarded-host', url.hostname);
  headers.delete('Cookie');
  return fetch(new Request(target, { method: request.method, headers, redirect: 'manual' }));
}

function stripCugHeaders(originResp) {
  const resp = new Response(originResp.body, originResp);
  [...resp.headers.keys()]
    .filter((name) => name.startsWith('x-aem-cug-'))
    .forEach((name) => resp.headers.delete(name));
  return resp;
}

async function handleProtectedPage(request, env, url, originResp) {
  const required = (originResp.headers.get('x-aem-cug-groups') || '')
    .split(',').map((g) => g.trim()).filter(Boolean);
  const groups = userGroups(request);

  if (!groups.length) {
    const loginUrl = new URL(
      originResp.headers.get('x-aem-cug-login-path') || env.LOGIN_PATH || '/login',
      url.origin,
    );
    if (loginUrl.origin === url.origin) {
      loginUrl.searchParams.set('redirect', url.pathname + url.search);
    }
    return Response.redirect(loginUrl.toString(), 302);
  }
  if (required.length && !required.some((g) => groups.includes(g))) {
    return new Response('Forbidden', { status: 403 });
  }

  const resp = stripCugHeaders(originResp);
  resp.headers.set('Cache-Control', 'private, no-store');

  if (!getCookie(request, TOKEN_COOKIE)) {
    try {
      resp.headers.append('Set-Cookie', cookie(TOKEN_COOKIE, await mintAssetToken(env), TOKEN_TTL - 60));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Asset token mint failed', e);
    }
  }
  return resp;
}

async function handleAsset(request, env, url) {
  const token = getCookie(request, TOKEN_COOKIE);
  const headers = { Accept: request.headers.get('Accept') || '*/*' };
  // Public assets pass through; delivery enforces ABAC when the token is missing or invalid.
  if (token) headers[DELIVERY_TOKEN_HEADER] = token;
  // Same-site URLs use /custom/assets/; the delivery host serves it at /adobe/assets/.
  const path = url.pathname.replace(/^\/custom\/assets\//, '/adobe/assets/');
  const target = new URL(path + url.search, `https://${env.DELIVERY_HOST}`);
  const resp = await fetch(target, { method: 'GET', headers });
  const out = new Response(resp.body, resp);
  if (token) out.headers.set('Cache-Control', 'private, no-store');
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.hostname === 'eds-dm-showcase.simply-ritwik.workers.dev'
      && url.pathname.startsWith('/adobe/assets/')
    ) {
      return handleAsset(request, env, url);
    }
    if (url.pathname === '/auth/login' && request.method === 'POST') {
      return handleLogin(request);
    }
    if (url.pathname.startsWith('/custom/assets/')) {
      return handleAsset(request, env, url);
    }
    const originResp = await proxyToOrigin(request, env, url);
    if (originResp.headers.get('x-aem-cug-required') === 'true') {
      return handleProtectedPage(request, env, url, originResp);
    }
    return stripCugHeaders(originResp);
  },
};
