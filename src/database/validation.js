import {STORE_KEYS} from './schema.js';

// Every write passes through `validateRecord` before it reaches IndexedDB, and every list query passes through `validateQuery`.
// Bad input is rejected with a `TypeError` that names the field, instead of being stored and causing problems later.

// The fields each store can be filtered by in `Database.list()`.
const SUPPORTED_FILTERS = {
  trackingDomains: ['domain', 'providerName', 'extractorName', 'captureEnabled'],
  requests: ['requestId', 'tabId', 'hostname', 'pageURL', 'timeStamp', 'utmSource', 'utmMedium'],
  lastSeenValues: ['name'],
  settings: ['key'],
};

/**
 * Requires a plain object, optionally limited to the given field names.
 *
 * @param {*} value Value to check.
 * @param {string[]} [allowedFields] Accepted field names. Leave out to allow any field.
 * @returns {void}
 * @throws {TypeError} If the value is not an object or has a field that is not allowed.
 */
function validateObject(value, allowedFields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Expected a record object.');
  }
  if (
    allowedFields !== undefined &&
    Object.keys(value).some((field) => !allowedFields.includes(field))
  ) {
    throw new TypeError('Unexpected field in record.');
  }
}

/**
 * Requires a string that is not empty or only spaces.
 *
 * @param {*} value Value to check.
 * @param {string} field Field name used in the error message.
 * @returns {void}
 * @throws {TypeError} If the value is not a nonempty string.
 */
function validateString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a nonempty string.`);
  }
}

/**
 * Requires true or false.
 *
 * @param {*} value Value to check.
 * @param {string} field Field name used in the error message.
 * @returns {void}
 * @throws {TypeError} If the value is not a boolean.
 */
function validateBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${field} must be true or false.`);
  }
}

/**
 * Requires one of Chrome's tab or frame IDs. Chrome uses -1 when there is no tab.
 *
 * @param {*} value ID to check.
 * @param {string} field Field name used in the error message.
 * @returns {void}
 * @throws {TypeError} If the value is not an integer greater than or equal to -1.
 */
function validateChromeId(value, field) {
  if (!Number.isSafeInteger(value) || value < -1) {
    throw new TypeError(`${field} must be an integer greater than or equal to -1.`);
  }
}

/**
 * Requires a time in milliseconds, as returned by `Date.now()` or Chrome's `timeStamp`.
 *
 * @param {*} value Time to check.
 * @returns {void}
 * @throws {TypeError} If the value is not a finite number greater than or equal to zero.
 */
function validateTimeStamp(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError('timeStamp must be a nonnegative number of milliseconds.');
  }
}

/**
 * Accepts a string, including an empty one, or `null` for a value that is not known.
 *
 * @param {*} value Value to check.
 * @param {string} field Field name used in the error message.
 * @returns {void}
 * @throws {TypeError} If the value is neither a string nor null.
 */
function validateNullableString(value, field) {
  if (value !== null && typeof value !== 'string') {
    throw new TypeError(`${field} must be a string or null.`);
  }
}

/**
 * Requires a hostname on its own, such as `clarity.ms`, with no scheme, port or path.
 *
 * @param {*} value Hostname to check.
 * @param {string} field Field name used in the error message.
 * @returns {void}
 * @throws {TypeError} If the value is not a bare hostname.
 */
function validateHostname(value, field) {
  validateString(value, field);
  let parsedURL;
  try {
    parsedURL = new URL(`https://${value}`);
  } catch {
    throw new TypeError(`${field} must be a hostname only, without a scheme, port or path.`);
  }
  if (
    /[\s/\\?#@]/.test(value) ||
    parsedURL.hostname.length === 0 ||
    parsedURL.port !== '' ||
    (value.startsWith('[') ? !value.endsWith(']') : value.includes(':'))
  ) {
    throw new TypeError(`${field} must be a hostname only, without a scheme, port or path.`);
  }
}

/**
 * Requires a full `http://` or `https://` URL.
 *
 * @param {*} value URL to check.
 * @param {string} field Field name used in the error message.
 * @returns {void}
 * @throws {TypeError} If the value is not a full HTTP or HTTPS URL.
 */
function validateURL(value, field) {
  validateString(value, field);
  let parsedURL;
  try {
    parsedURL = new URL(value);
  } catch {
    throw new TypeError(`${field} must be a full HTTP or HTTPS URL.`);
  }
  if (!['http:', 'https:'].includes(parsedURL.protocol)) {
    throw new TypeError(`${field} must be a full HTTP or HTTPS URL.`);
  }
}

/**
 * Requires the record to have a value field, even if that value is undefined.
 *
 * @param {Object} record Record already checked as an object.
 * @returns {void}
 * @throws {TypeError} If the record has no value field.
 */
function validateHasValue(record) {
  if (!Object.hasOwn(record, 'value')) {
    throw new TypeError('value is required.');
  }
}

/**
 * Makes a deep copy of a record, so later changes to the caller's object cannot change what gets written.
 * Values IndexedDB cannot store, such as functions, are rejected here.
 *
 * @param {Object} record Plain object to copy.
 * @returns {Object} An independent copy.
 * @throws {TypeError} If the input is not an object or holds a value IndexedDB cannot store.
 */
export function cloneRecord(record) {
  validateObject(record);
  try {
    // `structuredClone` is the same copy IndexedDB makes when it stores a value.
    return structuredClone(record);
  } catch (error) {
    throw new TypeError('Record values must be supported by IndexedDB.', {cause: error});
  }
}

/**
 * Requires an ID generated by IndexedDB (a positive whole number).
 * Not to be confused with Chrome's `requestId`, which is a string.
 *
 * @param {*} id ID to check.
 * @returns {void}
 * @throws {TypeError} If the ID is not a positive integer.
 */
export function validateRecordId(id) {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new TypeError('id must be a positive integer generated by the database.');
  }
}

/**
 * Requires the name of a store listed in `STORE_KEYS`.
 *
 * @param {*} storeName Store name to check.
 * @returns {string} The store name, unchanged.
 * @throws {TypeError} If there is no store with that name.
 */
export function validateStoreName(storeName) {
  if (typeof storeName !== 'string' || !Object.hasOwn(STORE_KEYS, storeName)) {
    throw new TypeError('Unknown database store.');
  }
  return storeName;
}

/**
 * Checks a primary key: a generated ID for stores keyed by `id`, a nonempty string otherwise.
 *
 * @param {string} storeName Store the key belongs to.
 * @param {*} key Primary key to check.
 * @returns {number|string} The key, unchanged.
 * @throws {TypeError} If the store is unknown or the key has the wrong form.
 */
export function validateKey(storeName, key) {
  validateStoreName(storeName);
  if (STORE_KEYS[storeName] === 'id') {
    validateRecordId(key);
  } else {
    validateString(key, STORE_KEYS[storeName]);
  }
  return key;
}

/**
 * Checks a complete record for a store and returns the copy that will be written.
 * Fields the database fills in (hostname, defaults, nulls for unknown values) are set on the copy.
 * Extra fields, such as provider specific data, are kept.
 *
 * @param {string} storeName Store that will receive the record.
 * @param {Object} record The complete record, not a partial update.
 * @returns {Object} The record to write, independent of the caller's object.
 * @throws {TypeError} If the store, key or any field is invalid.
 */
export function validateRecord(storeName, record) {
  validateStoreName(storeName);
  const savedRecord = cloneRecord(record);
  const keyPath = STORE_KEYS[storeName];
  // A new record may leave out a generated `id`. Every other primary key is required.
  if (keyPath !== 'id' || savedRecord[keyPath] !== undefined) {
    validateKey(storeName, savedRecord[keyPath]);
  }
  switch (storeName) {
    case 'trackingDomains':
      validateHostname(savedRecord.domain, 'domain');
      validateString(savedRecord.providerName, 'providerName');
      validateString(savedRecord.extractorName, 'extractorName');
      // Optional fields get their defaults here, so code that reads a tracking domain never has to check whether they exist.
      savedRecord.excludeIfContains ??= [];
      if (!Array.isArray(savedRecord.excludeIfContains)) {
        throw new TypeError('excludeIfContains must be an array of nonempty strings.');
      }
      for (const text of savedRecord.excludeIfContains) {
        validateString(text, 'excludeIfContains item');
      }
      savedRecord.captureEnabled ??= true;
      validateBoolean(savedRecord.captureEnabled, 'captureEnabled');
      break;
    case 'requests':
      validateString(savedRecord.requestId, 'requestId');
      validateURL(savedRecord.url, 'url');
      // The hostname always comes from url, so the two can never disagree.
      savedRecord.hostname = new URL(savedRecord.url).hostname;
      validateString(savedRecord.method, 'method');
      validateTimeStamp(savedRecord.timeStamp);
      validateChromeId(savedRecord.tabId, 'tabId');
      // Unknown values are stored as null, so every request has the same fields.
      savedRecord.pageURL ??= null;
      if (savedRecord.pageURL !== null) validateURL(savedRecord.pageURL, 'pageURL');
      savedRecord.utmSource ??= null;
      validateNullableString(savedRecord.utmSource, 'utmSource');
      savedRecord.utmMedium ??= null;
      validateNullableString(savedRecord.utmMedium, 'utmMedium');
      if (savedRecord.frameId !== undefined) validateChromeId(savedRecord.frameId, 'frameId');
      if (savedRecord.initiator !== undefined) validateString(savedRecord.initiator, 'initiator');
      break;
    case 'lastSeenValues':
    case 'settings':
      validateHasValue(savedRecord);
      break;
  }
  return savedRecord;
}

/**
 * Checks the filters for `Database.list()` and returns a copy without undefined values.
 * A filter matches records whose field is exactly equal to the given value.
 *
 * @param {string} storeName Store being searched.
 * @param {Object} [filters={}] Field values to match. Every filter must match.
 * @returns {Object} A copy of the filters, ready to use.
 * @throws {TypeError} If the store is unknown, a field cannot be filtered, or a value is invalid.
 */
export function validateQuery(storeName, filters = {}) {
  validateStoreName(storeName);
  validateObject(filters, SUPPORTED_FILTERS[storeName]);
  const selectedFilters = cloneRecord(filters);
  for (const [field, value] of Object.entries(selectedFilters)) {
    if (value === undefined) {
      delete selectedFilters[field];
      continue;
    }
    switch (field) {
      case 'domain':
      case 'hostname':
        validateHostname(value, field);
        break;
      case 'pageURL':
        if (value !== null) validateURL(value, field);
        break;
      case 'timeStamp':
        validateTimeStamp(value);
        break;
      case 'tabId':
        validateChromeId(value, field);
        break;
      case 'utmSource':
      case 'utmMedium':
        validateNullableString(value, field);
        break;
      case 'captureEnabled':
        validateBoolean(value, field);
        break;
      default:
        validateString(value, field);
        break;
    }
  }
  return selectedFilters;
}
