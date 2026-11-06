/**
 * Finds the page the user was on when the request was sent.
 *
 * @param {!Object} details The `webRequest` event details.
 * @return {!Promise<string|null>} The page URL, or `null` when the request has no tab or the tab is gone.
 */
export async function pageURL(details) {
  if (details.type === 'main_frame') return details.url;
  if (details.tabId < 0) return null;
  let tab;
  try {
    tab = await chrome.tabs.get(details.tabId);
  } catch {
    return null;
  }
  return tab.url && /^https?:/.test(tab.url) ? tab.url : null;
}
