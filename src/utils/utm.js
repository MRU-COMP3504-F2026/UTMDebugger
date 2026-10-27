/**
 * The UTM query parameters a page URL can carry, and the request field each one is saved as.
 */
export const UTM_PARAMETERS = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_term: 'utmTerm',
  utm_content: 'utmContent',
  utm_id: 'utmId',
  utm_source_platform: 'utmSourcePlatform',
  utm_creative_format: 'utmCreativeFormat',
  utm_marketing_tactic: 'utmMarketingTactic',
};

/**
 * Query and form fields that tracking providers use to send the page the user is on.
 * They are checked before other URLs because a referrer can carry different UTM values.
 */
export const PAGE_URL_FIELDS = [
  'dl',
  'url',
  'pu',
  'page_location',
  'page_url',
  'location',
  'href',
  'u'
];

/**
 * Reads the UTM parameters from one URL, from its query string and from a query-like fragment.
 *
 * @param {string|URL} url The URL to read
 * @return {?Object<string, string>} The UTM fields found, such as `{utmSource: 'newsletter'}`, or `null` when there are none
 */
export function readUTM(url) {
  let parsedURL;
  try {
    parsedURL = new URL(url);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsedURL.protocol)) return null;
  const fields = {};
  const fragment = parsedURL.hash.includes('=')
  ? new URLSearchParams(parsedURL.hash.slice(1))
  : new URLSearchParams();
  for (const parameters of [parsedURL.searchParams, fragment]) {
    for (const [name, value] of parameters) {
      const field = UTM_PARAMETERS[name.toLowerCase()];
      const trimmedValue = value.trim();
      if (
        field &&
        trimmedValue &&
        fields[field] === undefined
      ) fields[field] = trimmedValue;
    }
  }
  return Object.keys(fields).length ? fields : null;
}

/**
 * Finds the UTM parameters a tracking request reports, without any provider specific code.
 * The places are checked in this order, and the first one with UTM parameters will win:
 * 1. Page URL fields (`PAGE_URL_FIELDS`) in the request's query string
 * 2. The request URL itself
 * 3. Any other query field whose value is a URL
 * 4. Page URL fields, then any other URL, in the request's form data
 * 5. URLs inside a readable request body, such as batched query strings or JSON
 *
 * @param {!Object} details The `webRequest` event details.
 * @return {?Object<string, string>} The UTM fields plus `utmFoundIn`, which names where they were found, or `null` when there are none.
 */
export function findUTM(details) {
  const requestURL = new URL(details.url);
  const candidates = [
    ...fieldCandidates('query', [...requestURL.searchParams], true),
    {foundIn: 'url', url: requestURL.href},
    ...fieldCandidates('query', [...requestURL.searchParams], false),
  ];
  const formData = details.requestBody?.formData;
  if (formData) {
    const entries = Object
      .entries(formData)
      .flatMap(([name, values]) => values.map((value) => [name, value]));
    candidates.push(
      ...fieldCandidates('formData', entries, true),
      ...fieldCandidates('formData', entries, false)
    );
  }
  for (const text of bodyTexts(details.requestBody)) {
    for (const line of text.split(/\r?\n/)) {
      candidates.push(...fieldCandidates('body', [...new URLSearchParams(line)], true));
    }
    for (const url of text.match(/https?:\/\/[^\s"'<>\\]+/g) ?? []) {
      candidates.push({foundIn: 'body', url});
    }
  }
  for (const candidate of candidates) {
    const fields = readUTM(candidate.url);
    if (fields) return {...fields, utmFoundIn: candidate.foundIn};
  }
  return null;
}

/**
 * Turns name and value pairs into URL candidates, either only the page URL fields in their priority order, or every other field.
 *
 * @param {string} place Where the fields came from (e.g. `query`, `formData` or `body`).
 * @param {!Array<!Array<string>>} entries The name and value pairs.
 * @param {boolean} pageFields True for only the page URL fields, false for every other field.
 * @return {!Array<{foundIn: string, url: string}>} The candidates.
 */
function fieldCandidates(place, entries, pageFields) {
  if (pageFields) {
    return PAGE_URL_FIELDS.flatMap((field) => entries
      .filter(([name]) => name.toLowerCase() === field)
      .map(([name, value]) => ({foundIn: `${place}:${name}`, url: value})));
  }
  return entries
    .filter(([name, value]) =>
      !PAGE_URL_FIELDS.includes(name.toLowerCase()) &&
      /^https?:\/\//i.test(value)
    )
    .map(([name, value]) =>
      ({foundIn: `${place}:${name}`, url: value})
    );
}

/**
 * Decodes the raw parts of a request body as UTF-8 text. Compressed bodies will not be readable this way.
 *
 * @param {?Object} requestBody The `requestBody` from the `webRequest` details.
 * @return {!Array<string>} The decoded texts.
 */
function bodyTexts(requestBody) {
  const decoder = new TextDecoder();
  return (requestBody?.raw ?? [])
    .filter((part) => part.bytes instanceof ArrayBuffer)
    .map((part) => decoder.decode(part.bytes));
}
