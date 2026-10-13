/*
 * Reference Cloudflare Worker (not deployed with the EDS code; excluded via .hlxignore).
 *
 * Route it in front of the EDS site, e.g. www.example.com/*.
 * Variables: ORIGIN_HOST (…aem.live host), DELIVERY_HOST (delivery-pXXX-eYYY.adobeaemcloud.com),
 *   LOGIN_PATH (optional fallback when x-aem-cug-login-path is absent, default /login).
 * Secrets: IMS_CLIENT_ID, IMS_CLIENT_SECRET.
 *
 * POC only: users are hard-coded and the group cookie is unsigned (forgeable).
 */

// username -> { password, group }
const USERS = {
  partner: { password: 'partner', group: 'partners' },
  distributor: { password: 'distributor', group: 'distributors' },
  sales: { password: 'sales', group: 'sales' },
  admin: { password: 'admin', group: 'partners' },
};

const IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const IMS_SCOPE = 'openid,AdobeID,additional_info.projectedProductContext,aem.assets.author,aem.folders';
const USER_COOKIE = 'cug_user';
const TOKEN_COOKIE = 'polaris-delivery-token';
const TOKEN_PREFIX = 'sd:';
const SESSION_TTL = 3600;
const TOKEN_TTL = 3600;
// Header name from the aem-assets-plugin secure-assets block; verify against ABAC delivery docs.
const DELIVERY_TOKEN_HEADER = 'x-asset-delivery-token';
// Bump to orphan edge-cache entries stored before caching was bypassed; workers.dev has no purge.
const CACHE_VERSION = '1';

// Per-isolate cache of the IMS service token.
let imsCache = { token: null, expires: 0 };

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// Groups always come from the USERS table, never from a client-supplied cookie value.
function currentUser(request) {
  const name = getCookie(request, USER_COOKIE);
  if (!name || !Object.prototype.hasOwnProperty.call(USERS, name)) return null;
  return { name, group: USERS[name].group };
}

function userGroups(request) {
  const user = currentUser(request);
  return user ? [user.group] : [];
}

// Pass raw=true to keep the value literal (e.g. the sd: prefix) instead of URI-encoding it.
function cookie(name, value, maxAge, raw = false) {
  const v = raw ? value : encodeURIComponent(value);
  return `${name}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function handleLogin(request) {
  let creds;
  try {
    creds = await request.json();
  } catch (e) {
    return new Response('Bad request', { status: 400 });
  }
  const user = Object.prototype.hasOwnProperty.call(USERS, creds.username)
    ? USERS[creds.username] : null;
  if (!user || user.password !== creds.password) {
    return new Response('Unauthorized', { status: 401 });
  }
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie(USER_COOKIE, creds.username, SESSION_TTL));
  // Drop any token minted for a previous user so a new one is minted for this user's group.
  headers.append('Set-Cookie', cookie(TOKEN_COOKIE, '', 0));
  return new Response(null, { status: 204, headers });
}

async function getImsToken(env) {
  if (imsCache.token && Date.now() < imsCache.expires) return imsCache.token;
  const resp = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.IMS_CLIENT_ID,
      client_secret: env.IMS_CLIENT_SECRET,
      scope: IMS_SCOPE,
    }),
  });
  if (!resp.ok) throw new Error(`IMS token returned ${resp.status}`);
  const data = await resp.json();
  // expires_in may be seconds or milliseconds depending on the endpoint.
  const ttlSec = data.expires_in > 100000 ? data.expires_in / 1000 : data.expires_in;
  imsCache = { token: data.access_token, expires: Date.now() + (ttlSec - 60) * 1000 };
  return imsCache.token;
}

async function mintAssetToken(env, username, groups) {
  const imsToken = await getImsToken(env);
  const resp = await fetch(`https://${env.DELIVERY_HOST}/adobe/assets/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${imsToken}`,
    },
    body: JSON.stringify({
      subjectAttributes: { id: username, username, groups },
      validFor: TOKEN_TTL,
    }),
  });
  if (!resp.ok) throw new Error(`Token API returned ${resp.status}`);
  const data = await resp.json();
  const token = data.token || data.access_token;
  if (!token) {
    throw new Error(`Token API response has no token field, keys: ${Object.keys(data)}`);
  }
  return token;
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
      const { name } = currentUser(request);
      const token = await mintAssetToken(env, name, groups);
      resp.headers.append(
        'Set-Cookie',
        cookie(TOKEN_COOKIE, `${TOKEN_PREFIX}${token}`, TOKEN_TTL - 60, true),
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Asset token mint failed', e);
    }
  }
  return resp;
}

async function handleAsset(request, env, url) {
  const cookieValue = getCookie(request, TOKEN_COOKIE);
  const headers = { Accept: request.headers.get('Accept') || '*/*' };
  // Public assets pass through; delivery enforces ABAC when the token is missing or invalid.
  if (cookieValue) {
    headers.Cookie = `${TOKEN_COOKIE}=${cookieValue}`;
    headers[DELIVERY_TOKEN_HEADER] = cookieValue.startsWith(TOKEN_PREFIX)
      ? cookieValue.slice(TOKEN_PREFIX.length) : cookieValue;
  }
  // Same-site URLs use /custom/assets/; the delivery host serves it at /adobe/assets/.
  const path = url.pathname.replace(/^\/custom\/assets\//, '/adobe/assets/');
  const target = new URL(path + url.search, `https://${env.DELIVERY_HOST}`);
  target.searchParams.set('_cv', CACHE_VERSION);
  // Edge cache is keyed by URL only, so a stored fallback would be served to token holders too.
  const resp = await fetch(target, { method: 'GET', headers, cf: { cacheTtl: -1 } });
  const out = new Response(resp.body, resp);
  // Browser cache must also key on the cookie, or an earlier fallback is reused after login.
  out.headers.append('Vary', 'Cookie');
  if (cookieValue) out.headers.set('Cache-Control', 'private, no-store');
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/auth/login' && request.method === 'POST') {
      return handleLogin(request);
    }
    if (url.pathname === '/auth/session' && request.method === 'GET') {
      return Response.json({ user: currentUser(request) }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      const headers = new Headers({ 'Cache-Control': 'no-store' });
      headers.append('Set-Cookie', cookie(USER_COOKIE, '', 0));
      headers.append('Set-Cookie', cookie(TOKEN_COOKIE, '', 0));
      return new Response(null, { status: 204, headers });
    }
    if (
      url.pathname.startsWith('/custom/assets/')
      || url.pathname.startsWith('/adobe/assets/')
    ) {
      return handleAsset(request, env, url);
    }
    const originResp = await proxyToOrigin(request, env, url);
    if (originResp.headers.get('x-aem-cug-required') === 'true') {
      return handleProtectedPage(request, env, url, originResp);
    }
    return stripCugHeaders(originResp);
  },
};
