import {
  DATABASE_NAME,
  DATABASE_VERSION,
  initializeSchema
} from './schema.js';
import {
  validateFilters,
  validateRequest,
  validateRequestId,
} from './validation.js';
import {createLogger} from '../utils/logger.js';

const log = createLogger('database');

// TODO: Confirm `setRequest(id, changes)` with Kevin before adding lifecycle updates.
// TODO: Plan database-backed settings with Zen (and Patrick and Jordan).

export class Database {
  #databaseName;
  #connection = null;
  #opening = null;
  
  /** Remembers the database name. The connection opens lazily. */
  constructor(databaseName = DATABASE_NAME) {
    if (typeof databaseName !== 'string' || databaseName.trim().length === 0) {
      throw new TypeError('databaseName must be a nonempty string.');
    }
    this.#databaseName = databaseName;
  }
  
  /**
   * Opens storage if needed, sharing one opening attempt across concurrent calls.
   * Save and read methods call this automatically.
   */
  async open() {
    if (this.#connection) return;
    // Concurrent listener calls share the same pending connection attempt.
    if (!this.#opening) this.#opening = this.#openConnection();
    const opening = this.#opening;
    try {
      await opening;
    } finally {
      if (this.#opening === opening) this.#opening = null;
    }
  }
  
  /**
   * Releases the connection without deleting records; later operations reopen it.
   * Call after current operations finish, since this does not cancel them.
   */
  async close() {
    if (this.#opening) await this.#opening;
    this.#connection?.close();
    this.#connection = null;
  }
  
  /**
   * Appends a validated record and returns it with a generated ID after commit.
   * Repeated web request IDs create separate records, not updates.
   */
  async saveRequest(record) {
    try {
      const request = validateRequest(record);
      const id = await this.#performRequest('readwrite', (store) => {
          return store.add(request);
      });
      log.info('Request committed.', {id});
      return {...request, id};
    } catch (error) {
      log.error('Request save failed.', error.name);
      throw error;
    }
  }
  
  /**
   * Returns a stored record by its numeric database ID, or undefined if missing.
   * Editing the returned object does not change storage.
   */
  async getRequest(id) {
    validateRequestId(id);
    return await this.#performRequest('readonly', (store) => store.get(id));
  }
  
  /**
   * Lists records in database ID order, optionally matching `requestId` and `tabId`.
   * - Both filters must match when supplied together.
   * - No filters returns all rows.
   */
  async listRequests(filters = {}) {
    const selectedFilters = validateFilters(filters);
    const requests = await this.#performRequest('readonly', (store) => {
        if (selectedFilters.requestId !== undefined) {
          return store.index('requestId').getAll(selectedFilters.requestId);
        }
        if (selectedFilters.tabId !== undefined) {
          return store.index('tabId').getAll(selectedFilters.tabId);
        }
        return store.getAll();
    });
    return requests.filter((request) => {
        return selectedFilters.tabId === undefined || request.tabId === selectedFilters.tabId;
    });
  }
  
  /**
   * Wraps IndexedDB opening events in a Promise and initializes a new database.
   * Rejects failed or blocked opens and releases connections on version changes.
   */
  #openConnection() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.#databaseName, DATABASE_VERSION);
        let blocked = false;
        request.onupgradeneeded = () => initializeSchema(request.result);
        request.onerror = () => {
          log.error('Storage open failed.', request.error.name);
          reject(request.error);
        };
        request.onblocked = () => {
          blocked = true;
          log.warn('Open blocked. Close other database users.');
          reject(new DOMException('Database opening is blocked.', 'InvalidStateError'));
        };
        request.onsuccess = () => {
          const connection = request.result;
          // A blocked open can finish later, after its caller has already failed.
          if (blocked) {
            connection.close();
            return;
          }
          this.#connection = connection;
          connection.onversionchange = () => {
            connection.close();
            if (this.#connection === connection) this.#connection = null;
          };
          connection.onclose = () => {
            if (this.#connection === connection) this.#connection = null;
          };
          log.info('Storage opened.');
          resolve();
        };
    });
  }
  
  /**
   * Opens storage and queues one IndexedDB request in a transaction.
   * Returns its result only after commit, or rejects if the transaction fails.
   */
  async #performRequest(mode, createRequest) {
    await this.open();
    return await new Promise((resolve, reject) => {
        const transaction = this.#connection.transaction('requests', mode);
        let request;
        let failure;
        // Request success is not commit. Only transaction completion resolves.
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = (event) => { failure = event.target.error; };
        transaction.onabort = () => {
          reject(failure || transaction.error || new DOMException('Database transaction aborted.', 'AbortError'));
        };
        try {
          // Queue IndexedDB work now. No network calls or unrelated awaits here.
          request = createRequest(transaction.objectStore('requests'));
        } catch (error) {
          failure = error;
          transaction.abort();
        }
    });
  }
}
