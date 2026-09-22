const decorate = (block) => {
  // Fail Check
  if (!block) return;

  // Try to get text and URL from block
  let label = 'Help';
  let targetHref = 'https://help.qantas.com/support/s/';
  
  // Check if there's a link in the block
  const anchor = block.querySelector('a');
  if (anchor) {
    targetHref = anchor.href;
    label = anchor.textContent?.trim() || label;
  } else {
    // Try to get text content
    const textContent = block.textContent?.trim();
    if (textContent && textContent.startsWith('http')) {
      targetHref = textContent;
    } else if (textContent) {
      label = textContent;
    }
  }

  // Always use the question mark icon from the project
  const codeBasePath = window.hlx?.codeBasePath || '';
  const iconPath = `${codeBasePath}/icons/runway_icon_question_mark.svg`;

  block.innerHTML = `<a href="${targetHref}" aria-label="${label}">
                      <img data-icon-name="runway_icon_question_mark" src="${iconPath}" alt="" loading="lazy" aria-hidden="true">
                      <span>${label}</span>
                    </a>`;
};

export default decorate;
