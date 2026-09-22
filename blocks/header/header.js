import { loadFragment } from '../fragment/fragment.js';
import { createElementWithClasses, getMaskedIconElement } from '../../scripts/utils/dom.js';

const mobileMenuOpenClass = 'mobile-menu-open';

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
  const supportingSection = sections.length > 1 ? sections.pop() : null;

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
  topBar.append(brandSection || '', nav, toggleButton);

  block.append(topBar);

  if (supportingSection) {
    supportingSection.classList.add('header-supporting');
    block.append(supportingSection);
  }
}
