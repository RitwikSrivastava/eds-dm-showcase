import { getDecoratedPicture, getFieldText } from '../../scripts/utils/dom.js';

function decorateCta(ctaRow) {
  const a = ctaRow?.querySelector('a');
  if (!a) return '';
  a.classList.add('button');
  if (a.closest('em')) a.classList.add('secondary');
  if (a.closest('strong')) a.classList.add('primary');
  return a.outerHTML;
}

export default function decorate(block) {
  // fileReferenceMimeType/fileReferenceAlt and classes are consumed by AEM's own
  // block rendering (baked into the image row's <picture> and the block's classList,
  // respectively) - they never produce their own row. Only these 5 rows are emitted.
  const [imageRow, eyebrowRow, titleRow, longDescrRow, ctaRow] = [...block.children];

  const picture = getDecoratedPicture(imageRow);
  const eyebrow = getFieldText(block, 'eyebrow', eyebrowRow);
  const title = getFieldText(block, 'title', titleRow);
  const longDescrEl = block.querySelector('[data-aue-prop="longDescr"]') || longDescrRow?.querySelector('div');
  const ctaEl = block.querySelector('[data-aue-prop="cta"]') || ctaRow?.querySelector('div');

  const teaserDOM = document.createRange().createContextualFragment(`
    <div class="background">${picture ? picture.outerHTML : ''}</div>
    <div class="foreground">
      <div class="text">
        ${eyebrow ? `<div class="eyebrow">${eyebrow.toUpperCase()}</div>` : ''}
        ${title ? `<div class="title"><h3>${title}</h3></div>` : ''}
        <div class="long-description">${longDescrEl?.innerHTML ?? ''}</div>
        <div class="cta">${decorateCta(ctaEl)}</div>
      </div>
      <div class="spacer"></div>
    </div>
  `);

  block.textContent = '';
  block.append(teaserDOM);
}
