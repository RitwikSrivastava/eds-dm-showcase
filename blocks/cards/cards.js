import { moveInstrumentation } from '../../scripts/scripts.js';

// Card images are authored via the custom DM asset picker (Approach B): decorateExternalImages
// has already rewritten the authored link into a fully-optimized <picture> before this block's
// decorate() runs, so there's no local re-optimization step here - see hero.js for the same
// pattern.
export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  block.replaceChildren(ul);
}
