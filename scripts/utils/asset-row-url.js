/**
 * Resolves asset URL from a block row (Universal Editor or plain markup).
 * @param {ParentNode | null | undefined} row
 * @returns {string}
 */
export default function getAssetImageUrlFromRow(row) {
  if (!row) return '';
  const anchor = row.querySelector('a[href]');
  if (anchor?.href) return anchor.href;
  const img = row.querySelector('img[src]');
  if (img?.src) return img.src;
  return '';
}
