import {
  DATABASE_NAME,
  DATABASE_VERSION,
  STORE_KEYS,
  initializeSchema,
} from './schema.js';

import {
  cloneRecord,
  validateKey,
  validateQuery,
  validateRecord,
  validateStoreName,
} from './validation.js';

import {createLogger} from '../utils/logger.js';

const log = createLogger('database');

// Request history groups requests whose page is not known under this name.
export const UNKNOWN_PAGE = 'Unknown page';

/**
 * Puts a `hostname` in the form the browser uses (lowercase, international characters converted to ASCII, and no trailing dot).
 *
 * @param {string} hostname Hostname to convert.
 * @returns {string} The converted `hostname`.
 */
function normalizeHostname(hostname) {
  return new URL(`https://${hostname}`).hostname.replace(/\.$/, '');
}

/**
 * The extension's database. Every method returns a promise, so call it with await.
 * The connection opens on first use.
 *
 * Extension code should use the shared instance exported by `src/utils/dbhelper.js`.
 * Tests create their own instances with separate database names.
 */
export class Database {
  #databaseName;
  #connection = null;
  #opening = null;

  /**
   * Remembers which database to use. Nothing is opened until the first operation.
   *
   * @param {string} [databaseName] Database name, defaulting to `DATABASE_NAME`.
   * @throws {TypeError} If `databaseName` is not a nonempty string.
   */
  constructor(databaseName = DATABASE_NAME) {
    if (typeof databaseName !== 'string' || databaseName.trim().length === 0) {
      throw new TypeError('databaseName must be a nonempty string.');
    }
    this.#databaseName = databaseName;
  }

  // Opening and closing

  /**
   * Opens the database if it is not open yet. Every other method calls this itself.
   *
   * @returns {Promise<void>} Resolves once the database and its defaults are ready.
   */
  async open() {
    if (this.#connection) return;
    // Many listener events can arrive at the same moment.
    // They all wait on one opening attempt instead of each opening a connection of their own.
    if (!this.#opening) this.#opening = this.#openConnection();
    const opening = this.#opening;
    try {
      await opening;
    } finally {
      if (this.#opening === opening) this.#opening = null;
    }
  }

  /**
   * Closes the connection. The next operation opens it again.
   * Operations that have already started still finish.
   *
   * @returns {Promise<void>} Resolves once the connection is closing.
   */
  async close() {
    if (this.#opening) await this.#opening;
    this.#connection?.close();
    this.#connection = null;
  }

  // Operations that work on any store

  /**
   * Lists the records in a store whose fields exactly equal every given filter.
   *
   * @param {string} storeName Name of a store in `STORE_KEYS`.
   * @param {Object} [filters={}] Field values to match. An empty object lists every record.
   * @returns {Promise<Object[]>} Matching records, sorted by primary key.
   */
  async list(storeName, filters = {}) {
    const selectedFilters = validateQuery(storeName, filters);
    const records = await this.#performRequest(storeName, 'readonly', (store) => {
      // The first filter that matches the primary key or an index narrows the search, so IndexedDB only returns likely matches.
      // Every filter is checked again below.
      // `null` cannot be looked up through an index, so a null filter is only checked below.
      for (const [field, value] of Object.entries(selectedFilters)) {
        if (value === null) continue;
        if (field === store.keyPath) return store.getAll(value);
        if (store.indexNames.contains(field)) return store.index(field).getAll(value);
      }
      return store.getAll();
    });
    return records.filter((record) => {
      return Object.entries(selectedFilters).every(([field, value]) => record[field] === value);
    });
  }

  /**
   * Returns the record with the given primary key.
   *
   * @param {string} storeName Name of a store in `STORE_KEYS`.
   * @param {string|number} keyValue The record's primary key.
   * @returns {Promise<Object|undefined>} The record, or `undefined` if there is none.
   */
  async get(storeName, keyValue) {
    validateKey(storeName, keyValue);
    return await this.#performRequest(storeName, 'readonly', (store) => store.get(keyValue));
  }

  /**
   * Adds a record or replaces the one with the same key. Fields left out are removed.
   * If the record already contains its key, it must equal `keyValue`.
   *
   * @param {string} storeName Name of a store in `STORE_KEYS`.
   * @param {Object} record The complete record. Its key field may be left out.
   * @param {string|number} keyValue Primary key to save the record under.
   * @returns {Promise<Object>} The saved record, including its key.
   */
  async set(storeName, record, keyValue) {
    validateKey(storeName, keyValue);
    const keyPath = STORE_KEYS[storeName];
    const copiedRecord = cloneRecord(record);
    if (copiedRecord[keyPath] !== undefined && copiedRecord[keyPath] !== keyValue) {
      throw new TypeError(`${keyPath} must match the given key.`);
    }
    // The key is written into the copy, so the key given here and the key inside the record cannot disagree, and the caller's own object is left unchanged.
    copiedRecord[keyPath] = keyValue;
    const validatedRecord = validateRecord(storeName, copiedRecord);
    await this.#performRequest(storeName, 'readwrite', (store) => store.put(validatedRecord));
    return validatedRecord;
  }

  /**
   * Adds a new record. Fails with a `ConstraintError` if its key is already used.
   * Leave out `id` in stores whose ids are generated. Other stores need their key field.
   *
   * @param {string} storeName Name of a store in `STORE_KEYS`.
   * @param {Object} record The new record.
   * @returns {Promise<Object>} The saved record, including its key.
   */
  async add(storeName, record) {
    const validatedRecord = validateRecord(storeName, record);
    const key = await this.#performRequest(storeName, 'readwrite', (store) => store.add(validatedRecord));
    return {...validatedRecord, [STORE_KEYS[storeName]]: key};
  }

  /**
   * Changes some fields of an existing record and keeps the rest.
   *
   * @param {string} storeName Name of a store in `STORE_KEYS`.
   * @param {string|number} keyValue Primary key of the record to change.
   * @param {Object} changes Fields to replace. A nested object is replaced as a whole.
   *     The primary key cannot change.
   * @returns {Promise<Object|undefined>} The updated record, or undefined if there is none.
   */
  async update(storeName, keyValue, changes) {
    validateKey(storeName, keyValue);
    const copiedChanges = cloneRecord(changes);
    const keyPath = STORE_KEYS[storeName];
    if (Object.hasOwn(copiedChanges, keyPath) && copiedChanges[keyPath] !== keyValue) {
      throw new TypeError(`${keyPath} cannot be changed.`);
    }
    // Reading and writing happen in one transaction.
    // With separate get and set calls, two updates at the same time could both start from the old record and one would be lost.
    return await this.#performTransaction([storeName], 'readwrite', (transaction, setResult, fail) => {
      const store = transaction.objectStore(storeName);
      const request = store.get(keyValue);
      request.onsuccess = () => {
        if (request.result === undefined) return;
        try {
          const validatedRecord = validateRecord(storeName, {...request.result, ...copiedChanges});
          store.put(validatedRecord);
          setResult(validatedRecord);
        } catch (error) {
          fail(error);
        }
      };
    });
  }

  /**
   * Deletes the record with the given key. Deleting a missing record does nothing.
   *
   * @param {string} storeName Name of a store in `STORE_KEYS`.
   * @param {string|number} keyValue Primary key of the record to delete.
   * @returns {Promise<void>} Resolves once the record is deleted.
   */
  async delete(storeName, keyValue) {
    validateKey(storeName, keyValue);
    await this.#performRequest(storeName, 'readwrite', (store) => store.delete(keyValue));
  }

  /**
   * Deletes every record in one store. Other stores are not touched.
   * Deleted defaults are not added back.
   *
   * @param {string} storeName Name of the store to empty.
   * @returns {Promise<void>} Resolves once the store is empty.
   */
  async clear(storeName) {
    validateStoreName(storeName);
    await this.#performRequest(storeName, 'readwrite', (store) => store.clear());
  }

  // Tracking domains

  /**
   * Finds the tracking domain a request was sent to, so the listener knows which provider it belongs to and which extractor reads it.
   * When several domains match, the most specific wins, e.g. `events.analytics.example.com`, `analytics.example.com` beats `example.com`.
   * Domains with `captureEnabled` turned off are returned too.
   *
   * @param {string} url The request's full URL (`details.url` in the listener).
   * @returns {Promise<Object|undefined>} The tracking domain, or `undefined` when the request is not HTTP or HTTPS, matches no domain, or contains one of its `excludeIfContains` texts.
   * @throws {TypeError} If `url` is not a full URL.
   */
  async findTrackingDomain(url) {
    if (typeof url !== 'string') {
      throw new TypeError('url must be a full URL.');
    }
    const parsedURL = new URL(url);
    // The listener also sees WebSocket, file and extension requests. None of them are tracking requests.
    if (!['http:', 'https:'].includes(parsedURL.protocol)) return undefined;
    const trackingDomains = await this.list('trackingDomains');
    const trackingDomain = this.#mostSpecificTrackingDomain(trackingDomains, parsedURL.hostname);
    // Only the hostname and path are checked.
    // The query string often carries the page's own URL or title, and a word there such as "subscription" must not exclude the request.
    // The most specific domain decides alone. An excluded request does not fall back to a broader domain.
    const hostnameAndPath = parsedURL.hostname + parsedURL.pathname;
    if (trackingDomain?.excludeIfContains.some((text) => hostnameAndPath.includes(text))) {
      return undefined;
    }
    return trackingDomain;
  }

  // Requests

  /**
   * Saves a request the listener captured, together with what its extractor found, and logs the result.
   * Saving the same Chrome `requestId` twice creates two records.
   *
   * @param {Object} record
   *   - Required requestId, url, method, timeStamp and tabId.
   *   - Optional pageURL, utmSource, utmMedium, frameId, initiator and any other fields the extractor returns.
   *   - Must not include an id.
   * @returns {Promise<Object>} The saved request, with its generated `id` and `hostname`.
   */
  async saveRequest(record) {
    return await this.#saveNewRecord('requests', record, 'Request');
  }

  /**
   * Returns a saved request by its `id`.
   *
   * @param {number} id The `id` the database generated, not Chrome's `requestId`.
   * @returns {Promise<Object|undefined>} The request, or `undefined` if there is none.
   */
  async getRequest(id) {
    return await this.get('requests', id);
  }

  /**
   * Lists saved requests matching every given filter, oldest first.
   *
   * @param {Object} [filters={}] Exact requestId, tabId, hostname, pageURL, timeStamp, utmSource or utmMedium values.
   * @returns {Promise<Object[]>} The matching requests.
   */
  async listRequests(filters = {}) {
    return await this.list('requests', filters);
  }

  /**
   * Groups saved requests by page and then by provider, newest first, so `history[pageURL][providerName]` is an array of requests.
   * This is the shape the popup's history view reads. Requests without a page are grouped under `UNKNOWN_PAGE`.
   * Requests whose tracking domain has since been deleted are grouped under their hostname.
   *
   * @param {Object} [filters={}] The same filters listRequests accepts.
   * @returns {Promise<Object<string, Object<string, Object[]>>>} The grouped requests.
   */
  async getRequestHistory(filters = {}) {
    const selectedFilters = validateQuery('requests', filters);
    // Both stores are read in one transaction, so the provider names and the requests come from the same moment even while the listener is writing.
    const storeNames = ['trackingDomains', 'requests'];
    const readBothStores = (transaction, setResult) => {
      const trackingDomainsRequest = transaction.objectStore('trackingDomains').getAll();
      const requestsRequest = transaction.objectStore('requests').getAll();
      // Requests in one transaction finish in the order they were made, so both results are ready when the second one succeeds.
      requestsRequest.onsuccess = () => setResult({
        trackingDomains: trackingDomainsRequest.result,
        requests: requestsRequest.result,
      });
    };
    const {trackingDomains, requests} =
        await this.#performTransaction(storeNames, 'readonly', readBothStores);
    // Page URLs and provider names come from data, so the groups are objects without any built-in properties.
    // A provider called "constructor" or "__proto__" is an ordinary key.
    const history = Object.create(null);
    // Extractors can finish out of order, so requests are sorted by when Chrome saw them, newest first.
    // Requests seen at the same moment put the last one saved first.
    requests.sort((first, second) => {
      return second.timeStamp - first.timeStamp || second.id - first.id;
    });
    for (const request of requests) {
      const matchesFilters = Object.entries(selectedFilters).every(([field, value]) => {
        return request[field] === value;
      });
      if (!matchesFilters) continue;
      // Requests from different tabs or repeat visits to the same URL share a group.
      const pageKey = request.pageURL ?? UNKNOWN_PAGE;
      const trackingDomain = this.#mostSpecificTrackingDomain(trackingDomains, request.hostname);
      const providerName = trackingDomain?.providerName ?? request.hostname;
      history[pageKey] ??= Object.create(null);
      history[pageKey][providerName] ??= [];
      history[pageKey][providerName].push(request);
    }
    return history;
  }

  /**
   * Deletes every saved request. Tracking domains, cookies and settings are kept.
   *
   * @returns {Promise<void>} Resolves once the requests are deleted.
   */
  async clearRequestHistory() {
    await this.clear('requests');
  }

  // Cookie snapshots

  /**
   * Saves the value a watched cookie had at one stage of a page load, and logs the result.
   *
   * @param {Object} record
   *   - Required cookieName, value, documentStage and timeStamp.
   *   - Optional pageURL and other cookie details such as domain or path.
   *   - Must not include an id.
   * @returns {Promise<Object>} The saved snapshot with its generated id.
   */
  async saveCookieSnapshot(record) {
    return await this.#saveNewRecord('cookieSnapshots', record, 'Cookie snapshot');
  }

  /**
   * Lists cookie snapshots matching every given filter, oldest first.
   *
   * @param {Object} [filters={}] Exact cookieName, value, documentStage, pageURL or timeStamp values.
   * @returns {Promise<Object[]>} The matching snapshots.
   */
  async listCookieSnapshots(filters = {}) {
    return await this.list('cookieSnapshots', filters);
  }

  /**
   * Deletes every cookie snapshot. The list of watched cookies is kept.
   *
   * @returns {Promise<void>} Resolves once the snapshots are deleted.
   */
  async clearCookieSnapshots() {
    await this.clear('cookieSnapshots');
  }

  // Settings

  /**
   * Returns a setting's value.
   *
   * @param {string} key Setting name, e.g. 'captureTrackingRequests'.
   * @returns {Promise<*>} The value, or `undefined` if the setting does not exist.
   */
  async getSetting(key) {
    const record = await this.get('settings', key);
    return record?.value;
  }

  /**
   * Saves a setting, replacing its previous value.
   *
   * @param {*} value Any value IndexedDB can store, including arrays and objects.
   * @param {string} key Setting name.
   * @returns {Promise<*>} The saved value.
   */
  async setSetting(value, key) {
    const record = await this.set('settings', {value}, key);
    return record.value;
  }

  // Last seen values

  /**
   * Returns the value last saved under a name, such as the previous provider session ID.
   *
   * @param {string} name Name the value was saved under.
   * @returns {Promise<*>} The value, or undefined if nothing was saved under that name.
   */
  async getLastSeenValue(name) {
    const record = await this.get('lastSeenValues', name);
    return record?.value;
  }

  /**
   * Saves a value under a name, replacing the previous one.
   * Reading the old value and saving the new one are separate steps.
   * When two tabs could do this at the same time, put something like the tab ID in the name.
   *
   * @param {*} value Any value IndexedDB can store.
   * @param {string} name Name to save it under, e.g. 'GA4SessionID'.
   * @returns {Promise<*>} The saved value.
   */
  async setLastSeenValue(value, name) {
    const record = await this.set('lastSeenValues', {value}, name);
    return record.value;
  }

  // Helpers used only inside this class

  /**
   * Adds a new record to a store whose ids are generated, and logs the result.
   * Only the `id` and the error name are logged, never captured values.
   *
   * @param {string} storeName 'requests' or 'cookieSnapshots'.
   * @param {Object} record The new record, without an `id`.
   * @param {string} description What the record is, used in log and error messages.
   * @returns {Promise<Object>} The saved record, including its generated `id`.
   */
  async #saveNewRecord(storeName, record, description) {
    try {
      if (record?.id !== undefined) {
        throw new TypeError(`${description} must not include an id when it is saved.`);
      }
      const savedRecord = await this.add(storeName, record);
      log.info(`${description} committed.`, {id: savedRecord.id});
      return savedRecord;
    } catch (error) {
      log.error(`${description} save failed.`, error.name);
      throw error;
    }
  }

  /**
   * Picks the tracking domain that matches a hostname most specifically.
   * A domain matches itself and its subdomains. Exclusions are not checked here.
   *
   * @param {Object[]} trackingDomains Tracking domains to choose from.
   * @param {string} hostname Hostname of a request.
   * @returns {Object|undefined} The longest matching domain, or `undefined` if none match.
   */
  #mostSpecificTrackingDomain(trackingDomains, hostname) {
    const requestHostname = normalizeHostname(hostname);
    let bestMatch;
    let bestMatchLength = 0;
    for (const trackingDomain of trackingDomains) {
      const domain = normalizeHostname(trackingDomain.domain);
      // Matching on the dot keeps 'example.com' from matching 'notexample.com'.
      const matches = requestHostname === domain || requestHostname.endsWith(`.${domain}`);
      if (matches && domain.length > bestMatchLength) {
        bestMatch = trackingDomain;
        bestMatchLength = domain.length;
      }
    }
    return bestMatch;
  }

  /**
   * Opens the database and creates it on first use.
   * Fails instead of waiting when another context blocks the open.
   *
   * @returns {Promise<void>} Resolves once the connection is ready.
   */
  #openConnection() {
    return new Promise((resolve, reject) => {
      // `indexedDB.open()` does not hand back the database directly.
      // It returns a request, and the browser reports what happened through the handlers set below.
      const request = indexedDB.open(this.#databaseName, DATABASE_VERSION);
      let blocked = false;
      // Runs when the database does not exist yet, or when `DATABASE_VERSION` was raised.
      // This is the only moment stores and indexes can be created.
      request.onupgradeneeded = () => {
        if (blocked) {
          request.transaction.abort();
          return;
        }
        initializeSchema(request.result);
      };
      request.onerror = () => {
        log.error('Storage open failed.', request.error.name);
        reject(request.error);
      };
      // Another tab or worker still has an older version open and has not closed it.
      request.onblocked = () => {
        blocked = true;
        log.warn('Open blocked. Close other database users.');
        reject(new DOMException('Database opening is blocked.', 'InvalidStateError'));
      };
      request.onsuccess = () => {
        const connection = request.result;
        // A blocked open can still finish later, after its caller was told it failed.
        if (blocked) {
          connection.close();
          return;
        }
        this.#connection = connection;
        // Another context wants to upgrade or delete the database. Closing lets it go ahead.
        connection.onversionchange = () => {
          connection.close();
          if (this.#connection === connection) this.#connection = null;
        };
        // Chrome can close a connection itself, for example when site data is cleared.
        // Forgetting it here makes the next operation open a new one.
        connection.onclose = () => {
          if (this.#connection === connection) this.#connection = null;
        };
        log.info('Storage opened.');
        resolve();
      };
    });
  }

  /**
   * Runs one IndexedDB request in its own transaction.
   *
   * @param {string} storeName Store the request reads or writes.
   * @param {'readonly'|'readwrite'} mode Transaction mode.
   * @param {function(IDBObjectStore): IDBRequest} createRequest Starts the request.
   * @returns {Promise<*>} The request's result, once the transaction has completed.
   */
  async #performRequest(storeName, mode, createRequest) {
    return await this.#performTransaction([storeName], mode, (transaction, setResult) => {
      const request = createRequest(transaction.objectStore(storeName));
      request.onsuccess = () => setResult(request.result);
    });
  }

  /**
   * Runs IndexedDB work in one transaction and waits until it is saved.
   *
   * @param {string[]} storeNames Stores the transaction uses.
   * @param {'readonly'|'readwrite'} mode Transaction mode.
   * @param {function(IDBTransaction, function(*): void, function(*): void): void} operation
   *     Starts the work. It receives the transaction, a function to set the result, and a
   *     function that cancels the transaction with an error.
   * @returns {Promise<*>} The last result set by the operation, once everything is saved.
   *     Rejects with the error if the transaction fails.
   */
  async #performTransaction(storeNames, mode, operation) {
    await this.open();
    // IndexedDB reports results through events rather than return values.
    // This promise turns a whole transaction into one step the methods above can await.
    return await new Promise((resolve, reject) => {
      const transaction = this.#connection.transaction(storeNames, mode);
      let result;
      let failure;
      const fail = (error) => {
        failure = error;
        transaction.abort();
      };
      // A request succeeding does not mean its data is saved.
      // The transaction can still fail afterwards and undo it, so only a completed transaction resolves.
      transaction.oncomplete = () => resolve(result);
      // Keep the error of the request that failed, so the caller sees the real cause.
      transaction.onerror = (event) => {
        failure = event.target.error;
      };
      transaction.onabort = () => {
        reject(
          failure ||
          transaction.error ||
          new DOMException('Database transaction aborted.', 'AbortError')
        );
      };
      try {
        // The operation has to start its requests right away.
        // A transaction finishes on its own once nothing is pending, so waiting on something else here, such as a fetch or a timer, would end it early.
        operation(transaction, (value) => { result = value; }, fail);
      } catch (error) {
        fail(error);
      }
    });
  }
}
