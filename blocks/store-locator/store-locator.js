import { getDecoratedPicture, getFieldText } from '../../scripts/utils/dom.js';

// Non-functional chrome: no map/geolocation API calls are made here - this block only
// renders the static shell (banner image + headline + a decorative, disabled search box)
// to showcase the DM Approach-B image link, not a working store finder.
export default function decorate(block) {
  // fileReferenceMimeType/fileReferenceAlt are consumed by AEM's own block rendering
  // (baked into the image row's <picture>) - they never produce their own row.
  const [imageRow, headlineRow, subheadRow, placeholderRow, ctaRow] = [...block.children];

  const picture = getDecoratedPicture(imageRow);
  const headline = getFieldText(block, 'headline', headlineRow);
  const subhead = getFieldText(block, 'subhead', subheadRow);
  const searchPlaceholder = getFieldText(block, 'searchPlaceholder', placeholderRow);
  const cta = getFieldText(block, 'cta', ctaRow);

  const locatorDOM = document.createRange().createContextualFragment(`
    <div class="background">${picture ? picture.outerHTML : ''}</div>
    <div class="sidepanel">
      ${headline ? `<h3 class="sidepanel-title">${headline}</h3>` : ''}
      ${subhead ? `<p class="sidepanel-subhead">${subhead}</p>` : ''}
      <div class="search">
        <input class="search-input" type="text" placeholder="${searchPlaceholder}" disabled>
        <button class="search-button" type="button" disabled>${cta}</button>
      </div>
    </div>
  `);

  block.textContent = '';
  block.append(locatorDOM);
}
