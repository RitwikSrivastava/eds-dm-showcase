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
  // respectively) - they never produce their own row. Only these 4 rows are emitted.
  const [imageRow, titleRow, longDescrRow, ctaRow] = [...block.children];

  const picture = getDecoratedPicture(imageRow);
  const title = getFieldText(block, 'title', titleRow);
  const longDescrEl = block.querySelector('[data-aue-prop="longDescr"]') || longDescrRow?.querySelector('div');
  const ctaEl = block.querySelector('[data-aue-prop="cta"]') || ctaRow?.querySelector('div');

  const rewardDOM = document.createRange().createContextualFragment(`
    <div class="background">${picture ? picture.outerHTML : ''}</div>
    <div class="reward-content">
      ${title ? `<h6 class="headline">${title}</h6>` : ''}
      <div class="detail">${longDescrEl?.innerHTML ?? ''}</div>
      <div class="cta">${decorateCta(ctaEl)}</div>
    </div>
  `);

  block.textContent = '';
  block.append(rewardDOM);
}
