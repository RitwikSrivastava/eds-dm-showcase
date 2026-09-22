import { getTextContent } from '../../scripts/utils/dom.js';

const decorate = (block) => {
  if (!block) return;

  // New structure: [iconFilename, altText, linkUrl]
  const [iconCol, altTextCol, urlCol] = block.children ?? [];

  // Get values, unwrap from nested divs/p tags
  const unwrap = (el) => {
    const child = el?.firstElementChild;
    return (child?.tagName === 'DIV' || child?.tagName === 'P') ? child : el;
  };

  const iconText = getTextContent(unwrap(iconCol))?.trim();
  const logoAltText = getTextContent(unwrap(altTextCol))?.trim() || 'Home, Qantas Airways Logo';
  const targetHref = getTextContent(unwrap(urlCol))?.trim() || '/';

  let imgMarkup = '';

  if (iconText && iconText.endsWith('.svg')) {
    // Use text-based icon filename
    const codeBasePath = window.hlx?.codeBasePath || '';
    imgMarkup = `<span class="visually-hidden">${logoAltText}</span><img data-icon-name="${iconText.replace('.svg', '')}" src="${codeBasePath}/icons/${iconText}" alt="" loading="lazy">`;
  }

  if (imgMarkup) {
    block.innerHTML = `<a href="${targetHref}" data-wae-event="return_home_click">${imgMarkup}</a>`;
  }
};
export default decorate;
