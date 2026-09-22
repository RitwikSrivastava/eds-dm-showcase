import { loadScript } from '../../scripts/aem.js';
import { getPathDetails } from '../../scripts/scripts.js';

const WIDGET_TYPE = 'shoppingcart';

const createWidget = (type) => {
  let { lang, region } = getPathDetails();
  
  // Fallback to defaults if empty
  if (!lang || lang === '') lang = 'en';
  if (!region || region === '') region = 'au';
  
  const propsJson = {
    environment: window.eds_config?.widgets?.env || 'production',
    languageCode: lang,
    countryCode: region,
  };

  // Create widget container with fallback cart icon
  const widgetHTML = `
    <div data-widget-type="${type}" id="${type}" class="clearfix">
      <script type="qantas/widget">${JSON.stringify(propsJson)}</script>
      <button type="button" aria-label="Shopping Cart" class="cart-icon-fallback">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M4.25207 5L5.19431 9.1548C5.20201 9.2086 5.21399 9.26102 5.2299 9.3117L6.97348 17H18.4206L21.3824 8.01191H6.98591L5.84929 3H2C1.44772 3 1 3.44772 1 4C1 4.55228 1.44772 5 2 5H4.25207ZM18.6176 10.0119L16.9739 15H8.5707L7.43948 10.0119H18.6176ZM10 20.5C10 21.3284 9.32843 22 8.5 22C7.67157 22 7 21.3284 7 20.5C7 19.6716 7.67157 19 8.5 19C9.32843 19 10 19.6716 10 20.5ZM18 20.5C18 21.3284 17.3284 22 16.5 22C15.6716 22 15 21.3284 15 20.5C15 19.6716 15.6716 19 16.5 19C17.3284 19 18 19.6716 18 20.5Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  `;

  return widgetHTML;
};

const loadWidget = (block) => {
  if (
    block.classList.contains('widget-is-loaded') ||
    block.classList.contains('hide-shopping-cart')
  ) {
    return;
  }

  block.innerHTML = createWidget(WIDGET_TYPE);
  block.classList.add('widget-is-loaded');
};

export async function loadShoppingCartScripts() {
  const scriptUrl = window.eds_config?.widgets?.shopping_cart?.scriptPath;

  if (!scriptUrl) {
    console.log('Shopping cart widget script path not found in eds_config.');
    return;
  }

  try {
    await loadScript(scriptUrl);
  } catch (error) {
    console.log('Shopping cart external scripts not available, using placeholder');
  }
}

export default function decorate(block) {
  loadWidget(block);
}
