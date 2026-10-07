export const DATABASE_NAME = 'UTMDebugger';
export const DATABASE_VERSION = 1;

/**
 * Creates the initial requests store with generated IDs and lookup indexes.
 * Called only during IndexedDB's database upgrade event.
 */
export function initializeSchema(database) {
  const requests = database.createObjectStore('requests', {
    keyPath: 'id',
    autoIncrement: true,
  });
  requests.createIndex('requestId', 'requestId');
  requests.createIndex('tabId', 'tabId');
}