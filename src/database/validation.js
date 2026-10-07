/** Rejects non-object inputs and fields outside the supported record shape. */
function validateObject(value, allowedFields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Expected a record object.');
  }
  if (Object.keys(value).some((field) => !allowedFields.includes(field))) {
    throw new TypeError('Unexpected field in record.');
  }
}

/** Requires a string with non-whitespace content, without changing its value. */
function validateString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a nonempty string.`);
  }
}

/** Accepts a safe integer tab ID, including -1 for requests without a tab. */
function validateTabId(value) {
  if (!Number.isSafeInteger(value) || value < -1) {
    throw new TypeError('tabId must be an integer greater than or equal to -1.');
  }
}

/**
 * Checks request fields and copies them so caller edits cannot change the write.
 * Invalid input throws `TypeError` before a storage operation starts.
 */
export function validateRequest(record) {
  validateObject(record, [
    'requestId',
    'url',
    'method',
    'timeStamp',
    'tabId',
    'frameId',
    'initiator',
  ]);
  validateString(record.requestId, 'requestId');
  validateString(record.url, 'url');
  validateString(record.method, 'method');
  let requestURL;
  try {
    requestURL = new URL(record.url);
  } catch {
    throw new TypeError('url must be an absolute HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(requestURL.protocol)) {
    throw new TypeError('url must be an absolute HTTP or HTTPS URL.');
  }
  if (!Number.isFinite(record.timeStamp) || record.timeStamp < 0) {
    throw new TypeError('timeStamp must be nonnegative milliseconds.');
  }
  validateTabId(record.tabId);
  if (
    record.frameId !== undefined &&
    (!Number.isSafeInteger(record.frameId) || record.frameId < -1)
  ) {
    throw new TypeError('frameId must be an integer greater than or equal to -1.');
  }
  if (record.initiator !== undefined) {
    validateString(record.initiator, 'initiator');
  }
  // Copy before awaiting storage so later caller edits cannot change the write.
  const request = {
    requestId: record.requestId,
    url: record.url,
    method: record.method,
    timeStamp: record.timeStamp,
    tabId: record.tabId,
  };
  if (record.frameId !== undefined) request.frameId = record.frameId;
  if (record.initiator !== undefined) request.initiator = record.initiator;
  return request;
}

/** Requires a positive numeric database ID, not browser's `requestId` string. */
export function validateRequestId(id) {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new TypeError('id must be a positive database-generated integer.');
  }
}

/** Validates and copies the optional exact-match `requestId` and `tabId` filters. */
export function validateFilters(filters) {
  validateObject(filters, ['requestId', 'tabId']);
  if (filters.requestId !== undefined) {
    validateString(filters.requestId, 'requestId');
  }
  if (filters.tabId !== undefined) validateTabId(filters.tabId);
  return {...filters};
}
