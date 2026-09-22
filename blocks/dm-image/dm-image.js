import { buildDamUrl } from '../../scripts/utils/dam-open-apis.js';
import getAssetImageUrlFromRow from '../../scripts/utils/asset-row-url.js';

function getFieldText(block, propName, positionalRow) {
  const ueRow = block.querySelector(`[data-aue-prop="${propName}"]`);
  if (ueRow) {
    return ueRow.textContent?.trim() || '';
  }
  return positionalRow?.querySelector('div')?.textContent?.trim() || '';
}

function toBoolean(value) {
  return /^true$/i.test(value || '');
}

export default function decorate(block) {
  const rows = [...block.children];
  const imageRow = rows[0];
  const altText = getFieldText(block, 'imageAlt', rows[2]);
  const priority = getFieldText(block, 'priority', rows[4]);
  const preset = getFieldText(block, 'preset', rows[5]);
  const smartCrop = getFieldText(block, 'smartCrop', rows[6]);
  const rawImageUrl = getAssetImageUrlFromRow(imageRow);

  if (!rawImageUrl) {
    return;
  }

  let built;
  try {
    built = buildDamUrl(rawImageUrl);
  } catch (e) {
    built = rawImageUrl;
  }

  let urlObj;
  try {
    urlObj = new URL(built, window.location.href);
  } catch (e) {
    return;
  }

  if (preset) {
    urlObj.searchParams.set('preset', preset);
  }
  if (smartCrop) {
    urlObj.searchParams.set('crop', smartCrop);
  }

  const img = document.createElement('img');
  img.alt = altText || '';
  img.src = urlObj.toString();

  if (toBoolean(priority)) {
    img.loading = 'eager';
    img.fetchPriority = 'high';
  } else {
    img.loading = 'lazy';
  }

  block.textContent = '';
  block.append(img);
}
