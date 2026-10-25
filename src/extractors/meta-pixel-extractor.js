/**
 * Handler for extracting Meta Pixel data from a facebook.com/tr request.
 *
 * @param {Object} details Chrome `webRequest` details for the request.
 *     Only `url` and, for form-encoded POSTs, `requestBody.formData` are read.
 * @returns {Object|null} `null` when the request is not a Pixel event. Otherwise the fields to
 *     save with the request:
 *   - `pageURL` Page the Pixel fired on (`dl`), or `null` if it's missing or invalid.
 *   - `utmSource` and `utmMedium` Values from that page's URL, or `null`.
 *   - `pixelId` Pixel ID (`id`), or `null`.
 *   - `eventName` Event name such as `PageView` or `Purchase` (`ev`), or `null`.
 *   - `fbp` Meta's browser ID, or `null`.
 *   - `fbc` Meta's click ID, which exists only after an ad click, or `null`.
 */
export function metaPixelExtractor(details) {
  const url = new URL(details.url);
  if (url.pathname !== '/tr' && !url.pathname.startsWith('/tr/')) return null;

  const params = new Map(url.searchParams);
  // `webRequest` only provides `formData` for form-encoded POSTs, with an array of values per
  // key. It only needs the first one.
  const formData = details.requestBody?.formData;
  if (formData) {
    for (const [key, values] of Object.entries(formData)) {
      if (!params.has(key) && values.length > 0) params.set(key, values[0]);
    }
  }

  // `dl` is the page that the Pixel fired on. The UTM parameters are in that page's query string.
  const pageURL = toHttpURL(params.get('dl'));
  let utmSource = null;
  let utmMedium = null;
  if (pageURL !== null) {
    const pageParams = new URL(pageURL).searchParams;
    utmSource = pageParams.get('utm_source');
    utmMedium = pageParams.get('utm_medium');
  }

  // Unknown values are stored as null.
  // `Map.get()` returns undefined for a missing key, so each lookup is converted.
  return {
    pageURL,
    utmSource,
    utmMedium,
    pixelId: params.get('id') ?? null,
    eventName: params.get('ev') ?? null,
    fbp: params.get('fbp') ?? null,
    fbc: params.get('fbc') ?? null,
  };
}

/**
 * Returns the value if it is a full `http://` or `https://` URL, otherwise `null`.
 *
 * @param {string|null} value The query parameter value to check.
 * @returns {string|null} The same value if it is a full HTTP or HTTPS URL, otherwise `null`.
 */
function toHttpURL(value) {
  if (!value) return null;
  try {
    const parsedURL = new URL(value);
    return ['http:', 'https:'].includes(parsedURL.protocol) ? value : null;
  } catch {
    return null;
  }
}