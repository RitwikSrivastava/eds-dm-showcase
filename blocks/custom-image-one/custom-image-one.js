import { buildDamUrl } from '../../scripts/utils/dam-open-apis.js';
import getAssetImageUrlFromRow from '../../scripts/utils/asset-row-url.js';
import { isSvg } from '../../scripts/utils/dom.js';

function getFieldText(block, propName, positionalRow) {
  const ueRow = block.querySelector(`[data-aue-prop="${propName}"]`);
  if (ueRow) return ueRow.textContent?.trim() || '';
  return positionalRow?.querySelector('div')?.textContent?.trim() || '';
}

export default function decorate(block) {
  const [imageRow, , altRow, rotationRow, presetRow] = [...block.children];

  const altText = getFieldText(block, 'imageTitle', altRow);
  const rotation = getFieldText(block, 'rotation', rotationRow);
  const preset = getFieldText(block, 'preset', presetRow);

  const rawUrl = getAssetImageUrlFromRow(imageRow);
  if (!rawUrl) {
    return;
  }

  const sourceImg = imageRow?.querySelector('picture img, img');

  block.textContent = '';

  if (sourceImg && isSvg(sourceImg)) {
    let href = rawUrl;
    try {
      href = buildDamUrl(rawUrl);
    } catch (e) {
      // keep rawUrl
    }
    const img = document.createElement('img');
    img.src = href;
    img.alt = altText || '';
    img.loading = 'lazy';
    block.append(img);
    return;
  }

  let url;
  try {
    url = new URL(buildDamUrl(rawUrl), window.location.href);
  } catch (e) {
    url = new URL(rawUrl, window.location.href);
  }

  if (rotation) {
    url.searchParams.set('rotate', rotation);
  }
  if (preset) {
    url.searchParams.set('preset', preset);
  }

  const img = document.createElement('img');
  img.src = url.toString();
  img.alt = altText || '';
  img.loading = 'lazy';

  block.append(img);
}
