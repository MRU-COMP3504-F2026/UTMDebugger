/** Creates a labelled logger in console. */
export function createLogger(label) {
  const prefix = `[${label}]`;
  return {
    info: console.info.bind(console, prefix),
    warn: console.warn.bind(console, prefix),
    error: console.error.bind(console, prefix),
  };
}