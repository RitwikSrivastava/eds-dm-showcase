import { loadFragment } from '../fragment/fragment.js';
import {
  createElementWithClasses,
  isMobileOrTabletScreen,
  getMaskedIconElement,
  getTextContent,
} from '../../scripts/utils/dom.js';
import subscribeToResizeListener from '../../scripts/utils/resize-listener.js';
import {
  formatStringAsId,
  attachTestId,
} from '../../scripts/utils/common-utils.js';
import trapTabKey from '../../scripts/utils/accessibility.js';
import { fetchLanguagePlaceholders } from '../../scripts/scripts.js';
import {
  EVENT_NAME,
  MENU_TYPE,
  triggerMenuClickEvent,
  triggerMenuClickEventFromElement,
  triggerReturnHomeClickEvent,
} from '../../scripts/martech/datalayer.js';

const headerBrandWrapperClass = 'header-brand-wrapper';

const mainMenuId = 'main-menu';
const firstLevelMenuClass = 'navigation-menu';
const mainMenuButtonClass = 'menu-title';
const menuButtonActiveClass = 'active';
const scrimHeightProperty = '--scrim-height';
const menuTopOffsetProperty = '--menu-top-offset';
const viewPortHeightProperty = '--view-port-height';
const menuBarClass = 'navigation-bar-content';
const menuListClass = 'main-navigation';
const headerSupportingClass = 'header-supporting';

const noScrollClass = 'noscroll';
const isMobileMenuOpenClass = 'mobile-menu-open';
const mobileNavButtonClass = 'mobile-nav-button';
const mobileMenuClass = 'mobile-menu-toggle';

const submenuClass = 'submenu';
const submenuContentClass = 'submenu-content';
const headerHasSubmenuExpandedClass = 'has-submenu-expanded';
const subMenuBackButtonClass = 'submenu-back-button';
const subMenuCloseButtonClass = 'submenu-close-button';
const mobileAccordionToggleClass = 'submenu-accordion-toggle';
const subMenuExpandedClass = 'submenu-expanded';
const expandedClass = 'expanded';
const menuLinkClass = 'menu-link';

const shoppingCartOpenEvent = 'shopping-cart-opened';
const shoppingCartCloseEvent = 'shopping-cart-closed';
const shoppingCartModalOpenClass = 'shopping-cart-modal-opened';

const dismissAlertEvent = 'alert-dismissed';

const loginOpenEvent = 'login-ribbon-opened';
const loginCloseEvent = 'login-ribbon-closed';
const loginModalOpenClass = 'login-ribbon-modal-opened';

let liveRegions = [];
let statusRegions = [];

let headerBlock;
let isFocusListenerAttached;
let placeholder;
let lastPointerDownTarget;

/* Brand */
function decorateBrandLogo(logo) {
  if (!logo) return;

  const link = logo.querySelector('a');

  if (link) {
    const url = link.getAttribute('href');
    link.setAttribute('data-wae-event', EVENT_NAME.RETURN_HOME_CLICK);
    link.addEventListener('click', () => triggerReturnHomeClickEvent(url));
  }
}

function decorateBrandSection(brandSection) {
  // Add a div around all the navBrand content
  const navBrandWrapper = createElementWithClasses('div', headerBrandWrapperClass);

  while (brandSection.firstElementChild) {
    navBrandWrapper.append(brandSection.firstElementChild);
  }

  const [qantasLogo] = navBrandWrapper.children;
  decorateBrandLogo(qantasLogo);

  brandSection.textContent = '';
  brandSection.append(navBrandWrapper);
  return brandSection;
}

/* Expose the viewport height to CSS as the 100vh is not always reliable on mobile devices */
function setViewHeight() {
  if (!window) return;

  const viewPortHeight = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty(
    viewPortHeightProperty,
    `${viewPortHeight}px`,
  );
}

function onKeyDownMobileMenu(e) {
  if (e.key === 'Escape') {
    // eslint-disable-next-line no-use-before-define
    toggleMobileMenu(false);
  } else {
    const firstFocusableElement = headerBlock.querySelector('.mobile-nav-button');

    const lastFocusableElement = headerBlock.querySelector('.help.block a');
    trapTabKey(e, firstFocusableElement, lastFocusableElement);
  }
}

function setNonHeaderElementsInert(inert) {
  const nonHeaderElements = document.querySelectorAll(
    '.skip-to-elements-wrapper, .breadcrumbs-wrapper, .cx25-breadcrumb, main, .footer-wrapper',
  );

  // Before setting inert, disable announcements
  if (inert) {
    liveRegions = [];
    statusRegions = [];

    nonHeaderElements.forEach((element) => {
      liveRegions.push(...element.querySelectorAll('[aria-live="polite"]'));
      statusRegions.push(...element.querySelectorAll('[role="status"]'));
    });

    liveRegions.forEach((liveEl) => {
      liveEl.setAttribute('aria-live', 'off');
    });

    statusRegions.forEach((roleEl) => {
      roleEl.removeAttribute('role');
    });
  }

  nonHeaderElements.forEach((el) => {
    el.inert = inert;
  });

  // Re-enable aria-live after a short delay
  if (!inert) {
    setTimeout(() => {
      liveRegions.forEach((liveEl) => {
        liveEl.setAttribute('aria-live', 'polite');
      });

      statusRegions.forEach((roleEl) => {
        roleEl.setAttribute('role', 'status');
      });
    }, 2000);
  }
}

function setL1MenuInert(inert) {
  const l1MenuItems = headerBlock.querySelectorAll(
    `.${mainMenuButtonClass}, .${headerSupportingClass}, .${headerBrandWrapperClass}`,
  );
  l1MenuItems.forEach((el) => {
    el.inert = inert;

    if (inert) {
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('aria-hidden');
    }
  });
}

let resizeListener;

function disableInert() {
  setNonHeaderElementsInert(false);
  setL1MenuInert(false);
}

function disableScrollLock() {
  document.body.classList.remove(noScrollClass);
  disableInert();
  if (resizeListener) {
    resizeListener.unsubscribe();
  }
}

function trySetScrollLock() {
  if (isMobileOrTabletScreen()) {
    // Set view height again in case of screen rotation
    setViewHeight();

    const mainMenu = document.getElementById(mainMenuId);
    mainMenu?.setAttribute('aria-hidden', 'false');

    window.scrollTo({
      top: 0,
      behavior: 'instant',
    });
    if (!headerBlock) return;
    headerBlock.style.setProperty(
      menuTopOffsetProperty,
      `${headerBlock.getBoundingClientRect().top}px`,
    );
    document.body.classList.add(noScrollClass);
    setNonHeaderElementsInert(true);
  }
}

function onAlertDismissed() {
  trySetScrollLock();
}

function enableScrollLock() {
  trySetScrollLock();
  resizeListener = subscribeToResizeListener(() => {
    trySetScrollLock();
    if (!isMobileOrTabletScreen()) {
      disableInert();
    }
  });
}

function toggleMobileMenu(setToShow) {
  let shouldShow = !headerBlock.classList.contains(isMobileMenuOpenClass);
  const mobileMenuButton = headerBlock.querySelector(`.${mobileMenuClass}`);
  const mainMenu = document.getElementById(mainMenuId);

  if (setToShow !== undefined) {
    shouldShow = setToShow;
  }

  if (shouldShow) {
    enableScrollLock();
    headerBlock.classList.add(isMobileMenuOpenClass);
    mobileMenuButton.ariaLabel = placeholder.headerCloseMobileMenu;
    mobileMenuButton.ariaExpanded = 'true';
    document.addEventListener('keydown', onKeyDownMobileMenu);
    document.addEventListener(dismissAlertEvent, onAlertDismissed);
  } else {
    disableScrollLock();
    headerBlock.classList.remove(isMobileMenuOpenClass);
    mobileMenuButton.ariaLabel = placeholder.headerOpenMobileMenu;
    mobileMenuButton.ariaExpanded = 'false';
    if (isMobileOrTabletScreen()) {
      mainMenu?.setAttribute('aria-hidden', 'true');
    }
    mobileMenuButton.focus();
    document.removeEventListener('keydown', onKeyDownMobileMenu);
    document.removeEventListener(dismissAlertEvent, onAlertDismissed);
  }
}

function decorateMobileMenu() {
  const mobileMenuButton = createElementWithClasses(
    'button',
    mobileMenuClass,
    mobileNavButtonClass,
  );
  mobileMenuButton.setAttribute('aria-controls', mainMenuId);
  mobileMenuButton.setAttribute('aria-label', placeholder.headerOpenMobileMenu);
  mobileMenuButton.ariaExpanded = 'false';
  mobileMenuButton.innerHTML = getMaskedIconElement().outerHTML;
  mobileMenuButton.addEventListener('click', () => toggleMobileMenu());
  return mobileMenuButton;
}

function moveFocusUsingArrowKey(moveToNext) {
  const current = document.activeElement;
  let prev = null;
  let next = null;

  const setPrevNext = (element, i, parent) => {
    if (element !== current) return;

    if (i - 1 >= 0) {
      prev = parent[i - 1];
    }
    if (i + 1 !== parent.length) {
      next = parent[i + 1];
    }
  };

  // 1st Level Buttons
  if (current.classList.contains(mainMenuButtonClass)) {
    const allMainMenuButtons = headerBlock.querySelectorAll(`.${mainMenuButtonClass}`);
    allMainMenuButtons.forEach((button, i) => setPrevNext(button, i, allMainMenuButtons));

    if (current.ariaExpanded === 'true') {
      const subMenu = current.nextSibling;
      const firstSubMenuLink = subMenu.querySelector(`.${menuLinkClass}`);
      next = firstSubMenuLink;
    }
  } else if (current.classList.contains(menuLinkClass)) {
    // Sub Menu Links
    const parentMenu = current.closest(`.${firstLevelMenuClass}`);
    const allSubmenuLinks = parentMenu.querySelectorAll(`.${menuLinkClass}`);

    allSubmenuLinks.forEach((link, i) => setPrevNext(link, i, allSubmenuLinks));
  }

  if (!moveToNext && prev) {
    prev.focus();
  } else if (moveToNext && next) {
    next.focus();
  }
}

function onKeyDownFocus(e) {
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    moveFocusUsingArrowKey(false);
    e.preventDefault();
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    moveFocusUsingArrowKey(true);
    e.preventDefault();
  }
}

function setAriaExpandedForDesktop(menuButton, expanded) {
  if (isMobileOrTabletScreen()) return;
  menuButton.ariaExpanded = expanded;
}

function setFocusToBackButton(submenu) {
  if (!isMobileOrTabletScreen() || !submenu) return;
  setTimeout(() => {
    submenu.querySelector(`.${subMenuBackButtonClass}`)?.focus();
  }, 0);
}

/* Navigation Bar */
function decorateNavigationBar(mainNavSections, supportingSection) {
  const navigationBar = createElementWithClasses('nav', 'navigation-bar', 'visible-lg');
  navigationBar.id = 'main-menu';
  navigationBar.setAttribute('aria-label', placeholder.headerMainMenu);
  if (isMobileOrTabletScreen()) {
    navigationBar.setAttribute('aria-hidden', 'true');
  }

  const navigationBarContent = createElementWithClasses('div', 'navigation-bar-content');

  let activeButton = null; // Track the button that opened the menu

  const mainNavigation = createElementWithClasses('ul', 'main-navigation');

  mainNavSections.forEach((navSection) => {
    const li = createElementWithClasses('li', firstLevelMenuClass);

    // For UE: get title from data attribute or from content wrappers
    let navTitle = navSection.dataset.navigationTitle;
    let titleElement = null;

    if (!navTitle) {
      // Try default-content-wrapper first (UE creates this for text blocks)
      const contentWrapper = navSection.querySelector('.default-content-wrapper');
      if (contentWrapper) {
        const textEl = contentWrapper.querySelector('p');
        if (textEl) {
          navTitle = getTextContent(textEl);
          titleElement = contentWrapper;
        }
      }
    }

    if (!navTitle) {
      // Fallback: use first menu heading
      const firstMenuHeading = navSection.querySelector('.menu-heading');
      navTitle = firstMenuHeading ? getTextContent(firstMenuHeading) : 'Menu';
    }

    // Remove title element after we've extracted the text
    if (titleElement) {
      titleElement.remove();
    }

    const menuButton = createElementWithClasses('button', mainMenuButtonClass, 'body-02');
    menuButton.textContent = navTitle;
    menuButton.setAttribute('data-wae-event', EVENT_NAME.MENU_CLICK);
    menuButton.setAttribute('data-wae-menu-type', MENU_TYPE.HEADER);
    menuButton.setAttribute('data-wae-menu-level', '1');
    setAriaExpandedForDesktop(menuButton, 'false');

    const subMenuId = `submenu-${formatStringAsId(navTitle)}`;
    menuButton.setAttribute('aria-controls', subMenuId);

    const submenu = createElementWithClasses('div', 'submenu');
    submenu.setAttribute('id', subMenuId);
    submenu.innerHTML = `
      <div class="submenu-mobile-header">
        <button class="${subMenuBackButtonClass} ${mobileNavButtonClass}" aria-label="${placeholder.headerGoBack}">
          ${getMaskedIconElement().outerHTML}
        </button>
        <span class="submenu-title body-01">${navTitle}</span>
        <button class="${subMenuCloseButtonClass} ${mobileNavButtonClass}" aria-label="${placeholder.headerCloseMobileMenu}">
          ${getMaskedIconElement().outerHTML}
        </button>
      </div>
    `;

    submenu.querySelector(`.${subMenuBackButtonClass}`).addEventListener('click', () => {
      setTimeout(() => menuButton.focus(), 0);
    });

    const submenuContent = createElementWithClasses('div', submenuContentClass);

    const submenus = navSection.querySelectorAll('.menu-wrapper');
    const submenusAnchor = navSection.querySelectorAll('.menu-wrapper a');

    submenusAnchor.forEach((anchor) => anchor.addEventListener('click', () => triggerMenuClickEvent(
      anchor?.href,
      anchor?.querySelector('span')?.textContent,
      anchor?.getAttribute('data-wae-menu-type'),
      anchor?.getAttribute('data-wae-menu-level'),
    )));
    const firstSubMenuBlock = submenus?.[0]?.firstElementChild;
    if (firstSubMenuBlock) {
      firstSubMenuBlock.classList.add(expandedClass);

      // Add 'shortcuts' class only if the menu heading is "Shortcuts"
      const menuHeading = firstSubMenuBlock.querySelector('.menu-heading')?.textContent.trim();
      if (menuHeading === 'Shortcuts') {
        firstSubMenuBlock.classList.add('shortcuts');
      }

      const accordionButton = firstSubMenuBlock.querySelector(
        `.${mobileAccordionToggleClass}`,
      );
      if (accordionButton) {
        accordionButton.ariaExpanded = true;
      }
    }

    submenuContent.append(...submenus);
    submenu.append(submenuContent);

    li.appendChild(menuButton);
    li.appendChild(submenu);

    const firstFocusableElement = submenu.querySelector(`.${subMenuBackButtonClass}`);

    const onKeyDownSubMenu = (event) => {
      if (event.key === 'Escape') {
        // Close the menu
        if (activeButton) {
          activeButton.focus();
        }
        // eslint-disable-next-line no-use-before-define
        toggleSubMenu(false);
      } else if (headerBlock.classList.contains(isMobileMenuOpenClass)) {
        const lastMenuBlock = submenu.querySelector(`.${submenuContentClass}`).lastChild
          .firstElementChild;
        let lastFocusableElement = lastMenuBlock.querySelector(
          `.${mobileAccordionToggleClass}`,
        );
        if (lastMenuBlock.classList.contains(expandedClass)) {
          const menuList = lastMenuBlock.querySelector('.menu-list');
          lastFocusableElement = menuList.lastChild.firstElementChild;
        }
        trapTabKey(event, firstFocusableElement, lastFocusableElement);
      }
    };

    // Close the expanded menu when the user focus on an element outside of the menu
    const onFocusOut = (event) => {
      if (isMobileOrTabletScreen()) return;
      setTimeout(() => {
        // lastPointerDownTarget is an edge case when user tab on the whitespace within the submenu
        const target = event.relatedTarget ? event.relatedTarget : lastPointerDownTarget;
        if (!li.contains(target)) {
          // eslint-disable-next-line no-use-before-define
          toggleSubMenu(false);
        }
        lastPointerDownTarget = null;
      }, 0);
    };

    // Close the expanded menu when the user taps away
    const onPointerDown = (event) => {
      if (isMobileOrTabletScreen()) return;
      lastPointerDownTarget = event.target;
      if (!li.contains(event.target)) {
        // eslint-disable-next-line no-use-before-define
        toggleSubMenu(false);
      }
    };

    const toggleSubMenu = (setToShow) => {
      let show = !menuButton.classList.contains(menuButtonActiveClass);

      if (setToShow !== undefined) {
        show = setToShow;
      }

      if (show) {
        headerBlock.classList.add(headerHasSubmenuExpandedClass);
        menuButton.classList.add(menuButtonActiveClass);
        setAriaExpandedForDesktop(menuButton, 'true');
        if (isMobileOrTabletScreen()) {
          setL1MenuInert(true);
          setFocusToBackButton(submenu);
        }
        submenu.classList.add(subMenuExpandedClass);
        headerBlock.style.setProperty(scrimHeightProperty, `${submenu.scrollHeight}px`);
        activeButton = menuButton; // Store the reference to the active button
        submenu.focus();

        // In case if user shift-tab away from the menu without closing it
        menuButton.addEventListener('focusout', onFocusOut);
        document.addEventListener('pointerdown', onPointerDown);

        // Escape to close
        document.addEventListener('keydown', onKeyDownSubMenu);
      } else {
        // Close the current submenu
        submenu.classList.remove(subMenuExpandedClass);
        menuButton.classList.remove(menuButtonActiveClass);
        setAriaExpandedForDesktop(menuButton, 'false');
        setL1MenuInert(false);

        // If no other submenu has been opened, update the header state
        if (!headerBlock.querySelector(`.${subMenuExpandedClass}`)) {
          activeButton = null;
          headerBlock.classList.remove(headerHasSubmenuExpandedClass);
          headerBlock.style.setProperty(scrimHeightProperty, '0');
          document.removeEventListener('keydown', onKeyDownSubMenu);
          document.removeEventListener('pointerdown', onPointerDown);
          lastPointerDownTarget = null;
        }
      }
    };

    submenu.addEventListener('focusout', onFocusOut);

    const pointerleaveListener = (e) => {
      if (e.currentTarget?.contains(e.relatedTarget)) return;

      toggleSubMenu(false);
      menuButton.parentNode.removeEventListener('pointerleave', pointerleaveListener);
      // eslint-disable-next-line no-use-before-define
      menuButton.parentNode.addEventListener('pointerenter', pointerenterListener);
    };

    const pointerenterListener = (e) => {
      if (isMobileOrTabletScreen() || e.pointerType !== 'mouse') return;
      toggleSubMenu(true);
      menuButton.parentNode.removeEventListener('pointerenter', pointerenterListener);
      menuButton.parentNode.addEventListener('pointerleave', pointerleaveListener);
    };

    submenu
      .querySelector(`.${subMenuBackButtonClass}`)
      .addEventListener('click', () => toggleSubMenu(false));

    submenu.querySelector(`.${subMenuCloseButtonClass}`).addEventListener('click', () => {
      toggleSubMenu(false);
      toggleMobileMenu(false);
      triggerMenuClickEventFromElement(submenu);
    });

    menuButton.parentNode.addEventListener('pointerenter', pointerenterListener);
    menuButton.addEventListener('click', () => {
      toggleSubMenu();
      triggerMenuClickEvent(
        '',
        getTextContent(menuButton),
        menuButton?.getAttribute('data-wae-menu-type'),
        menuButton?.getAttribute('data-wae-menu-level'),
      );
    });

    // Attach key listener ONCE when any menu button gets focus
    mainNavigation.addEventListener('focusin', () => {
      if (!isFocusListenerAttached) {
        document.addEventListener('keydown', onKeyDownFocus);
        isFocusListenerAttached = true;
      }
    });

    // Remove key listener when focus leaves mainNavigation
    mainNavigation.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!mainNavigation.contains(document.activeElement)) {
          document.removeEventListener('keydown', onKeyDownFocus);
          isFocusListenerAttached = false;
        }
      }, 0);
    });

    mainNavigation.appendChild(li);

    // Remove the original section from DOM since we've moved its content
    navSection.remove();
  });

  navigationBarContent.append(mainNavigation);
  navigationBarContent.append(supportingSection || null);

  navigationBar.append(navigationBarContent);

  const scrim = createElementWithClasses('div', 'submenu-scrim');
  navigationBar.append(scrim);
  return navigationBar;
}

/* Utilities Section */
function attachShoppingCartModalListeners() {
  document.addEventListener(shoppingCartOpenEvent, () => {
    headerBlock.classList.add(shoppingCartModalOpenClass);
    enableScrollLock();
  });

  document.addEventListener(shoppingCartCloseEvent, () => {
    // Prevent false positive close event from shopping cart
    if (!headerBlock.classList.contains(shoppingCartModalOpenClass)) {
      return;
    }
    headerBlock.classList.remove(shoppingCartModalOpenClass);
    disableScrollLock();
  });
}

function attachLoginModalListeners() {
  document.addEventListener(loginOpenEvent, () => {
    headerBlock.classList.add(loginModalOpenClass);
    enableScrollLock();
  });

  document.addEventListener(loginCloseEvent, () => {
    headerBlock.classList.remove(loginModalOpenClass);
    disableScrollLock();
  });
}

function decorateUtilitiesSection(utilitiesSection) {
  if (!utilitiesSection) return null;
  const [regionSelector, shoppingcartWidget, loginWidget] = utilitiesSection.children;

  const mobileMenu = decorateMobileMenu();

  if (shoppingcartWidget) {
    attachShoppingCartModalListeners();
  }

  if (loginWidget) {
    attachLoginModalListeners();
  }

  utilitiesSection.innerHTML = '';
  utilitiesSection.append(
    regionSelector || '',
    shoppingcartWidget || '',
    loginWidget || '',
    mobileMenu || '',
  );
  return utilitiesSection;
}

function attachTestIdToElements(block) {
  const elementsToAttach = [
    { selector: `#${mainMenuId}`, elementName: 'menu' },
    { selector: `.${menuBarClass}`, elementName: 'menu-bar' },
    { selector: `.${menuListClass}`, elementName: 'menu-list' },
    { selector: `.${firstLevelMenuClass}`, elementName: 'menu-item-first' },
    { selector: `.${mainMenuButtonClass}`, elementName: 'menu-button' },
    { selector: `.${submenuClass}`, elementName: 'submenu' },
    { selector: `.${submenuContentClass}`, elementName: 'submenu-content' },
    { selector: `.${mobileMenuClass}`, elementName: 'mobile-menu-toggle' },
    { selector: `.${subMenuCloseButtonClass}`, elementName: 'submenu-close-button' },
    { selector: `.${subMenuBackButtonClass}`, elementName: 'submenu-back-button' },
  ];

  elementsToAttach.forEach(({ selector, elementName }) => {
    attachTestId({ block, selector, elementName });
  });
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  headerBlock = block;

  // Simplified path - just use /nav directly
  const navPath = '/nav';

  // For production sites with language folders, use:
  // let navPath = `/${getPathDetails().langRegion}/fragments/nav`;
  // if (isAuthorMode() && navPath.startsWith('/language-masters')) {
  //   navPath = `/${getPathDetails().langRegion}/en/fragments/nav`;
  // }

  const fragment = await loadFragment(navPath);

  placeholder = await fetchLanguagePlaceholders();

  block.textContent = '';

  const topBar = createElementWithClasses('div', 'top-bar');
  const topBarContent = createElementWithClasses('div', 'top-bar-content');

  // Add classes to specific sections
  // Brand: position 0, Utilities: position 1, Supporting: LAST position
  const allSections = [...fragment.children];
  if (allSections[0]) allSections[0].classList.add('header-brand');
  if (allSections[1]) allSections[1].classList.add('header-utilities');
  if (allSections.length > 2) {
    allSections[allSections.length - 1].classList.add('header-supporting');
  }

  setViewHeight();

  const brandSection = fragment.querySelector('.header-brand');
  decorateBrandSection(brandSection);

  const utilitiesSection = fragment.querySelector('.header-utilities');
  decorateUtilitiesSection(utilitiesSection);
  const mobileRegionSelector = utilitiesSection?.children?.[0].cloneNode(true);
  const screenReaderText = mobileRegionSelector.querySelector('#regionSelector');
  const regionSelectorAnchor = mobileRegionSelector.querySelector(
    '.region-selector-anchor',
  );
  if (screenReaderText && regionSelectorAnchor) {
    screenReaderText.id += 'Mobile';
    regionSelectorAnchor.setAttribute('aria-labelledby', screenReaderText.id);
  }
  mobileRegionSelector?.classList.add('mobile-region-selector-wrapper');

  const supportingSection = fragment.querySelector(`.${headerSupportingClass}`);
  if (supportingSection && mobileRegionSelector) {
    supportingSection.prepend(mobileRegionSelector);
  }

  // For UE: auto-detect navigation sections
  // Navigation sections are: positions 2 to (length-2)
  // Position 0: brand, Position 1: utilities, Last position: supporting (Help)
  const navigationSections = [...fragment.children];
  const lastIndex = navigationSections.length - 1;
  const mainNavSections = navigationSections.filter((section, index) => {
    // Check for explicit data attribute (for DA)
    if (section.dataset.isnavigation === 'true') return true;

    // For UE: include sections between utilities and supporting
    // Skip: first 2 sections (brand, utilities) and last section (supporting)
    return index >= 2 && index < lastIndex;
  });

  const navigationBar = decorateNavigationBar(mainNavSections, supportingSection);

  topBarContent.append(brandSection || null);
  topBarContent.append(utilitiesSection || null);

  topBar.append(topBarContent);

  block.append(topBar);
  block.append(navigationBar);

  // testing requirement - set attribute 'data-testid' for elements
  attachTestIdToElements(block);

  // Load widgets in parallel to avoid blocking each other
  if (block.querySelector('.shopping-cart-widget')) {
    import('../shopping-cart-widget/shopping-cart-widget.js')
      .then(({ loadShoppingCartScripts }) => loadShoppingCartScripts())
      .catch(() => {
        // Failed to load shopping cart scripts - showing fallback icon
      });
  }

  if (block.querySelector('.qdd-login-ribbon-host')) {
    import('../login/login.js')
      .then(({ loadLoginScripts }) => loadLoginScripts())
      .catch(() => {
        // Failed to load login scripts - showing fallback button
      });
  }
}
