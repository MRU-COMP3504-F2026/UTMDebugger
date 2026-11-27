
// Existing error types
const ERROR_TYPE_LABELS = {
  UIDMismatch: 'user ID mismatch',
  missingCode: 'tracking code missing',
};

/**
 * Formats the error log output.
 *
 * @param {Object[]} errors  Array of error objects
 * @returns {string} Formatted error log string
 */
export function formatErrorLog(errors) {
  const entries = (Array.isArray(errors) ? errors : [])
    .filter((error) => error !== null && typeof error === 'object');

  const lines = [
    'UTM Debugger error log',
    `Errors: ${entries.length}`,
  ];

  if (entries.length === 0) lines.push('', 'No errors were recorded.');

  // Go through each error entry and format its details
  entries.forEach((error, index) => {
    const label = Object.hasOwn(ERROR_TYPE_LABELS, error.type)
      ? ERROR_TYPE_LABELS[error.type]
      : undefined;
    const type = error.type ?? 'unknown error';
    const typeText = label ? `${type} (${label})` : type;
    const tracker = error.trackingSoftware ?? 'Unknown tracker';

    lines.push('', `[${index + 1}] ${tracker} | ${typeText}`);

    const fields = [
      ['Page', error.pageDetected],
      ['Compared with', error.errorPage],
      ['Current value', error.pageDetectedUID],
      ['Earlier value', error.errorPageUID],
      ['Message', error.errorMSG],
    ];

    // Check each field and add it to the log if it has a value
    for (const [name, value] of fields) {
      if (value !== undefined && value !== null && value !== '') {
        const text = String(value).replace(/\r?\n/g, '\n' + '  '); // Indent new lines
        lines.push(`${name}: ` + text);
      }
    }
  });

  return lines.join('\n') + '\n';
}