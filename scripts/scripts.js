import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';
import assetsInit from './aem-assets-plugin-support.js';

const CONTENT_ROOT_PATH = '/content/Gazal-ue-site';

/**
 * Helper function that converts an AEM path into an EDS path.
 */
export function getEDSLink(aemPath) {
  if (!aemPath) {
    return '';
  }

  let aemRoot = CONTENT_ROOT_PATH;

  if (window.hlx && window.hlx.aemRoot) {
    aemRoot = window.hlx.aemRoot;
  }

  return aemPath.replace(aemRoot, '').replace('.html', '');
}

/**
 * Gets path details from the current URL
 * @returns {object} Object containing path details
 */
export function getPathDetails() {
  const { pathname } = window.location;
  const extParts = pathname.split('.');
  const ext = extParts.length > 1 ? extParts[extParts.length - 1] : '';
  const isContentPath = pathname.startsWith('/content');
  const parts = pathname.split('/').filter(Boolean);

  const safeLangGet = (index) => {
    const val = parts[index];
    return val ? val.split('.')[0].toLowerCase() : '';
  };

  let langRegion = 'en-au';
  const ISO_2_LETTER = /^[a-z]{2}$/;

  if (window.hlx && window.hlx.isExternalSite === true) {
    const hlxLangRegion = window.hlx.langregion?.toLowerCase();
    if (hlxLangRegion) {
      langRegion = hlxLangRegion;
    } else if (parts.length >= 2) {
      const region = isContentPath ? safeLangGet(2) : safeLangGet(0);
      let language = isContentPath ? safeLangGet(3) : safeLangGet(1);
      [language] = language.split('_');
      if (ISO_2_LETTER.test(language) && ISO_2_LETTER.test(region)) {
        langRegion = `${language}-${region}`;
      }
    }
  } else {
    // Try to extract lang-region from path
    const extractedLangRegion = isContentPath ? safeLangGet(2) : safeLangGet(0);

    // Only use extracted value if it matches lang-region pattern (e.g., "en-au")
    if (extractedLangRegion && extractedLangRegion.includes('-')) {
      const [extractedLang, extractedRegion] = extractedLangRegion.split('-');
      if (ISO_2_LETTER.test(extractedLang) && ISO_2_LETTER.test(extractedRegion)) {
        langRegion = extractedLangRegion;
      }
    }
    // Otherwise keep default 'en-au'
  }

  let [lang, region] = langRegion.split('-');
  const isLanguageMasters = langRegion === 'language-masters';

  // Safety checks
  if (!lang || lang === '' || lang === 'language') lang = 'en';
  if (!region || region === '' || region === 'masters') region = 'au';
  if (isLanguageMasters) {
    langRegion = 'en-au';
    lang = 'en';
    region = 'au';
  }

  const prefix = pathname.substring(0, pathname.indexOf(`/${langRegion}`)) || '';
  const suffix = pathname.substring(pathname.indexOf(`/${langRegion}`) + langRegion.length + 1) || '';

  return {
    ext,
    prefix,
    suffix,
    langRegion,
    lang,
    region,
    isContentPath,
    isLanguageMasters,
  };
}

/**
 * Fetches language placeholders
 * @param {string} langRegion - Language region code
 * @returns {object} Placeholders object
 */
export async function fetchLanguagePlaceholders(langRegion) {
  const langCode = langRegion || getPathDetails()?.langRegion || 'en-au';
  try {
    const resp = await fetch(`/${langCode}/placeholders.json`);
    if (resp.ok) {
      const json = await resp.json();
      return json.data?.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {}) || {};
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error fetching placeholders for lang: ${langCode}`, error);
    try {
      const resp = await fetch('/en-au/placeholders.json');
      if (resp.ok) {
        const json = await resp.json();
        return json.data?.reduce((acc, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {}) || {};
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching placeholders:', err);
    }
  }
  return {};
}

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

function isScene7Url(href) {
  return /^(https?:\/\/(.*\.)?scene7\.com\/is\/image\/(.*))/i.test(href);
}

/**
 * Replace standalone DM / Scene7 image links in default content with img / picture.
 * Scene7 links are swapped for a plain <img>. DM Open API links are handed off to
 * aem-assets-plugin's decorateExternalImages (see scripts/aem-assets-plugin-support.js),
 * which also sets width/height from the originalImageWidth/originalImageHeight query
 * params the asset picker attaches, preventing CLS - see
 * https://github.com/adobe-rnd/aem-assets-plugin/pull/31.
 * @param {Element} main
 */
export function decorateExternalImages(main) {
  main.querySelectorAll('a[href]').forEach((a) => {
    if (isScene7Url(a.href)) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = a.href;
      if (a.href !== a.innerText) {
        img.setAttribute('alt', a.innerText);
      }
      a.replaceWith(img);
    }
  });

  if (window.hlx.aemassets?.decorateExternalImages) {
    window.hlx.aemassets.decorateExternalImages(main);
  }
}

export function decorateImages(main) {
  main.querySelectorAll('p img').forEach((img) => {
    const p = img.closest('p');
    p.className = 'img-wrapper';
  });
}

// export function decorateImagesWithWidthHeight(main) {
//   const urlSpec = window.location.href.endsWith('test-page');
//   if (urlSpec) {
//     main.querySelectorAll('img').forEach((img) => {
//       img.width = '1620';
//       img.height = '1080';
//     });
//   }
// }

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  // decorateButtons(main); // Commented out - blocks handle their own button styling
  decorateIcons(main);
  decorateExternalImages(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

// Initialize eds_config for widgets
if (!window.eds_config) {
  window.eds_config = {
    widgets: {
      env: 'production',
      login: {
        oauthInitBundleUri: 'https://cdn.sit.qantasloyalty.com/appcache/qfa-qff-oauth-login/master/0.0.0/oauth.js',
        oauthBundleUri: 'https://cdn.sit.qantasloyalty.com/appcache/qdd-oauth-login/master/0.0.0/bundle.js',
        oauthLoginRibbonBundleUri: 'https://cdn.sit.qantasloyalty.com/appcache/qdd-login-ribbon/master/0.0.0/bundle.js',
      },
      shopping_cart: {
        scriptPath: 'https://static.qcom-stg.qantastesting.com/ams02/a974/62/dev/eds-master/shoppingcart_widget/current/app.js',
      },
    },
    regional_selector: {
      flags: {
        'en-au': 'runway_country_flag_australia',
        'en-us': 'runway_country_flag_united_states',
        'en-gb': 'runway_country_flag_united_kingdom',
        'en-nz': 'runway_country_flag_new_zealand',
      },
    },
  };
}

await assetsInit();
loadPage();
