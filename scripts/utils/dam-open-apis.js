import { isAuthorMode } from './common-utils.js';
import { getMetadata } from '../aem.js';

// Append Qantas Image Version if pressent
function appendQantasImageVersion(url) {
  const qiv = getMetadata('qiv');
  if (qiv) {
    url?.searchParams?.set('qiv', qiv);
  }
}

export function buildDamUrl(imgSrc) {
  if (!imgSrc) throw new TypeError('buildDamUrl: imgSrc is required');
  if (window.location.hostname === 'localhost') return imgSrc;

  // Parse input URL
  const urlObj = new URL(imgSrc, window.location.origin);
  let path = urlObj.pathname;
  let { origin } = urlObj;
  const { dam = {} } = window.eds_config ?? {};
  const {
    useAkamai = false,
    domain: akamaiDomain = '',
    url: akamaiPath = '/dynamic-assets/',
    adobePrefix = '/adobe/',
  } = dam;

  // Removing 'renditions' from URL due to recent Adobe update
  if (path.includes('/renditions/')) {
    path = path.replace('/renditions/', '/');
  }

  if (path.includes('/original/as/')) {
    path = path.replace('/original/as/', '/as/');
  } else if (!path.includes('/as/')) {
    path = `${path.replace(/\/$/, '')}/as/-image.avif`;
  }

  if (!isAuthorMode() && useAkamai) {
    path = path.replace(adobePrefix, dam.url ?? akamaiPath);
    origin = akamaiDomain ?? '';
  }
  // Delete the assetname parameter as the asset name is part of the image url
  urlObj.searchParams?.delete('assetname');
  // Set default format to AVIF to match the default .avif extension
  urlObj.searchParams?.set('format', 'avif');
  // Append Qantas Image Version if pressent
  appendQantasImageVersion(urlObj);

  const imgUrl = `${origin}${path}${urlObj.search}`;
  return imgUrl;
}

export const createDMImageUrl = (repositoryId, assetId) => {
  if (repositoryId && assetId) {
    return `https://${repositoryId}/adobe/assets/${assetId}`;
  }
  return '';
};
