import { getPathDetails } from '../../scripts/scripts.js';

const decorate = (block) => {
  try {
    // Fail check
    if (!block) {
      console.error('Region selector: block is null or undefined');
      return;
    }

    console.log('Region selector: Starting decoration', block);

    // Try to get URL from either <a> tag or text field
    let regionSelectionUrl = '/en-au/region-selection'; // default
    
    const anchor = block?.querySelector('a');
    console.log('Region selector: Found anchor?', anchor);
    
    if (anchor) {
      regionSelectionUrl = anchor.href;
    } else {
      // If no anchor, try to get text content as URL
      const textContent = block.textContent?.trim();
      if (textContent && textContent.startsWith('/')) {
        regionSelectionUrl = textContent;
      }
    }

    console.log('Region selector: URL will be', regionSelectionUrl);

    const pathDetails = getPathDetails();
    console.log('Region selector: Path details', pathDetails);
    
    let { lang, region, langRegion } = pathDetails;
    
    // Fallback to 'en-au' if empty
    if (!langRegion || langRegion === '') {
      langRegion = 'en-au';
      lang = 'en';
      region = 'au';
    }
    
    // Additional safety check
    if (!lang || lang === '') lang = 'en';
    if (!region || region === '') region = 'au';

    const regionSelectorFlag =
      window.eds_config?.regional_selector?.flags[langRegion] || 'runway_country_flag_australia';

    console.log('Region selector: Flag icon', regionSelectorFlag);

    const codeBasePath = window.hlx?.codeBasePath || '';

    // Build final markup with fallback text
    const newHTML = `
      <a href="${regionSelectionUrl}" class="region-selector-anchor body-02" aria-labelledby="regionSelector">
        <span id="regionSelector" class="visually-hidden">Change country and language. Current selection: ${region.toUpperCase()} ${lang.toUpperCase()}</span>
        <span class="flag" aria-hidden="true">
          <img src="${codeBasePath}/icons/${regionSelectorFlag}.svg" alt="">
        </span>
        <span class="region-label" aria-hidden="true">${region.toUpperCase()}  |  ${lang.toUpperCase()}</span>
      </a>
    `;
    
    console.log('Region selector: Setting innerHTML');
    block.innerHTML = newHTML;
    console.log('Region selector: Decoration complete');
  } catch (error) {
    console.error('Region selector: Error during decoration', error);
  }
};

export default decorate;
