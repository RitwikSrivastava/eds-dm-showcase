import { loadFragment } from '../fragment/fragment.js';
import { createElementWithClasses, getMaskedIconElement } from '../../scripts/utils/dom.js';

const mobileMenuOpenClass = 'mobile-menu-open';

// Decorative promo bar + utility icons matching the frescopa.coffee reference - not tied to
// content authoring, since they're static chrome rather than editable page content.
function buildPromoBar() {
  const bar = createElementWithClasses('div', 'promo-bar');
  const message = createElementWithClasses('span', 'promo-message');
  message.textContent = 'Free shipping from $35 & free coffee samples with code FRESCOPA.';
  const link = createElementWithClasses('a', 'promo-cta');
  link.href = '#';
  link.textContent = 'Shop Now';
  bar.append(message, link);
  return bar;
}

const UTILITY_ICONS = [
  {
    name: 'cart',
    label: 'Cart',
    path: 'M6 8h16l-1.5 10.5a2 2 0 0 1-2 1.5H9.5a2 2 0 0 1-2-1.5L6 8Zm3-2a3 3 0 0 1 6 0',
  },
  {
    name: 'search',
    label: 'Search',
    path: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 16-5.2-5.2',
  },
  {
    name: 'account',
    label: 'Account',
    path: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  },
];

function buildUtilityIcons() {
  const wrapper = createElementWithClasses('div', 'header-utilities');
  UTILITY_ICONS.forEach(({ name, label, path }) => {
    const link = createElementWithClasses('a', 'utility-icon', `utility-icon-${name}`);
    link.href = '#';
    link.setAttribute('aria-label', label);
    link.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentcolor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
    wrapper.append(link);
  });
  const signIn = createElementWithClasses('a', 'sign-in-link');
  signIn.href = '#';
  signIn.textContent = 'Sign in';
  wrapper.append(signIn);
  return wrapper;
}

function toggleMobileMenu(block, toggleButton, nav) {
  const isOpen = block.classList.toggle(mobileMenuOpenClass);
  toggleButton.setAttribute('aria-expanded', String(isOpen));
  toggleButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  nav.setAttribute('aria-hidden', String(!isOpen));
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await loadFragment('/nav');
  block.textContent = '';
  if (!fragment) return;

  const sections = [...fragment.children];
  const brandSection = sections.shift();
  // Drop the trailing "supporting" section (e.g. Help) - the frescopa.coffee reference this
  // header matches doesn't show one, and it would otherwise get scooped into the nav links.
  if (sections.length > 1) sections.pop();

  if (brandSection) {
    brandSection.classList.add('header-brand');
  }

  const nav = createElementWithClasses('nav', 'navigation-bar');
  nav.setAttribute('aria-label', 'Main');
  nav.setAttribute('aria-hidden', 'true');

  const navList = createElementWithClasses('ul', 'main-navigation');
  sections.forEach((section) => {
    section.querySelectorAll('a').forEach((anchor) => {
      const li = createElementWithClasses('li', 'navigation-menu');
      li.append(anchor.cloneNode(true));
      navList.append(li);
    });
  });
  nav.append(navList);

  const toggleButton = createElementWithClasses('button', 'mobile-nav-toggle');
  toggleButton.setAttribute('aria-label', 'Open menu');
  toggleButton.setAttribute('aria-expanded', 'false');
  toggleButton.append(getMaskedIconElement());
  toggleButton.addEventListener('click', () => toggleMobileMenu(block, toggleButton, nav));

  const topBar = createElementWithClasses('div', 'top-bar');
  topBar.append(brandSection || '', nav, buildUtilityIcons(), toggleButton);

  block.append(buildPromoBar(), topBar);
}
