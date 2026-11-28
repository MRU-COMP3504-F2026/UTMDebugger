//#region \0rolldown/runtime.js
var __esmMin = (fn, res, err) => () => {
	if (err) throw err[0];
	try {
		return fn && (res = fn(fn = 0)), res;
	} catch (e) {
		throw err = [e], e;
	}
};
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
//#endregion
//#region src/database/defaults.js
var DEFAULT_TRACKING_DOMAINS, DEFAULT_SETTINGS;
var init_defaults = __esmMin((() => {
	DEFAULT_TRACKING_DOMAINS = [
		{
			domain: "analytics.google.com",
			providerName: "Google Analytics",
			extractorName: "googleAnalyticsExtractor",
			excludeIfContains: ["script"],
			captureEnabled: true
		},
		{
			domain: "clarity.ms",
			providerName: "Microsoft Clarity",
			extractorName: "clarityExtractor",
			excludeIfContains: ["script", "tag"],
			captureEnabled: true
		},
		{
			domain: "track.hubspot.com",
			providerName: "HubSpot",
			extractorName: "hubSpotExtractor",
			excludeIfContains: ["script"],
			captureEnabled: true
		},
		{
			domain: "www.googleadservices.com",
			providerName: "Google Ads",
			extractorName: "googleAdsExtractor",
			excludeIfContains: ["script"],
			captureEnabled: true
		},
		{
			domain: "www.facebook.com",
			providerName: "Meta Pixel",
			extractorName: "metaPixelExtractor",
			excludeIfContains: ["script"],
			captureEnabled: true
		}
	];
	DEFAULT_SETTINGS = [{
		key: "captureTrackingRequests",
		value: false
	}, {
		key: "excludedPages",
		value: []
	}];
}));
//#endregion
//#region src/database/schema.js
/**
* Creates every store and index, then adds the default configuration.
* The manager calls this when the browser creates the database for the first time.
*
* @param {IDBDatabase} database The new database. Stores can only be created at this point.
* @returns {void}
*/
function initializeSchema(database) {
	const trackingDomains = database.createObjectStore("trackingDomains", { keyPath: STORE_KEYS.trackingDomains });
	trackingDomains.createIndex("providerName", "providerName");
	trackingDomains.createIndex("extractorName", "extractorName");
	const requests = database.createObjectStore("requests", {
		keyPath: STORE_KEYS.requests,
		autoIncrement: true
	});
	for (const field of [
		"requestId",
		"tabId",
		"hostname",
		"pageURL",
		"timeStamp",
		"utmSource",
		"utmMedium",
		"userID"
	]) requests.createIndex(field, field);
	database.createObjectStore("lastSeenValues", { keyPath: STORE_KEYS.lastSeenValues });
	const settings = database.createObjectStore("settings", { keyPath: STORE_KEYS.settings });
	for (const trackingDomain of DEFAULT_TRACKING_DOMAINS) trackingDomains.add(trackingDomain);
	for (const setting of DEFAULT_SETTINGS) settings.add(setting);
}
var DATABASE_NAME, STORE_KEYS;
var init_schema = __esmMin((() => {
	init_defaults();
	DATABASE_NAME = "UTMDebugger";
	STORE_KEYS = {
		trackingDomains: "domain",
		requests: "id",
		lastSeenValues: "name",
		settings: "key"
	};
}));
//#endregion
//#region src/database/validation.js
/**
* Requires a plain object, optionally limited to the given field names.
*
* @param {*} value Value to check.
* @param {string[]} [allowedFields] Accepted field names. Leave out to allow any field.
* @returns {void}
* @throws {TypeError} If the value is not an object or has a field that is not allowed.
*/
function validateObject(value, allowedFields) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Expected a record object.");
	if (allowedFields !== void 0 && Object.keys(value).some((field) => !allowedFields.includes(field))) throw new TypeError("Unexpected field in record.");
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
	if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${field} must be a nonempty string.`);
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
	if (typeof value !== "boolean") throw new TypeError(`${field} must be true or false.`);
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
	if (!Number.isSafeInteger(value) || value < -1) throw new TypeError(`${field} must be an integer greater than or equal to -1.`);
}
/**
* Requires a time in milliseconds, as returned by `Date.now()` or Chrome's `timeStamp`.
*
* @param {*} value Time to check.
* @returns {void}
* @throws {TypeError} If the value is not a finite number greater than or equal to zero.
*/
function validateTimeStamp(value) {
	if (!Number.isFinite(value) || value < 0) throw new TypeError("timeStamp must be a nonnegative number of milliseconds.");
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
	if (value !== null && typeof value !== "string") throw new TypeError(`${field} must be a string or null.`);
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
	if (/[\s/\\?#@]/.test(value) || parsedURL.hostname.length === 0 || parsedURL.port !== "" || (value.startsWith("[") ? !value.endsWith("]") : value.includes(":"))) throw new TypeError(`${field} must be a hostname only, without a scheme, port or path.`);
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
	if (!["http:", "https:"].includes(parsedURL.protocol)) throw new TypeError(`${field} must be a full HTTP or HTTPS URL.`);
}
/**
* Requires the record to have a value field, even if that value is undefined.
*
* @param {Object} record Record already checked as an object.
* @returns {void}
* @throws {TypeError} If the record has no value field.
*/
function validateHasValue(record) {
	if (!Object.hasOwn(record, "value")) throw new TypeError("value is required.");
}
/**
* Makes a deep copy of a record, so later changes to the caller's object cannot change what gets written.
* Values IndexedDB cannot store, such as functions, are rejected here.
*
* @param {Object} record Plain object to copy.
* @returns {Object} An independent copy.
* @throws {TypeError} If the input is not an object or holds a value IndexedDB cannot store.
*/
function cloneRecord(record) {
	validateObject(record);
	try {
		return structuredClone(record);
	} catch (error) {
		throw new TypeError("Record values must be supported by IndexedDB.", { cause: error });
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
function validateRecordId(id) {
	if (!Number.isSafeInteger(id) || id < 1) throw new TypeError("id must be a positive integer generated by the database.");
}
/**
* Requires the name of a store listed in `STORE_KEYS`.
*
* @param {*} storeName Store name to check.
* @returns {string} The store name, unchanged.
* @throws {TypeError} If there is no store with that name.
*/
function validateStoreName(storeName) {
	if (typeof storeName !== "string" || !Object.hasOwn(STORE_KEYS, storeName)) throw new TypeError("Unknown database store.");
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
function validateKey(storeName, key) {
	validateStoreName(storeName);
	if (STORE_KEYS[storeName] === "id") validateRecordId(key);
	else validateString(key, STORE_KEYS[storeName]);
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
function validateRecord(storeName, record) {
	validateStoreName(storeName);
	const savedRecord = cloneRecord(record);
	const keyPath = STORE_KEYS[storeName];
	if (keyPath !== "id" || savedRecord[keyPath] !== void 0) validateKey(storeName, savedRecord[keyPath]);
	switch (storeName) {
		case "trackingDomains":
			validateHostname(savedRecord.domain, "domain");
			validateString(savedRecord.providerName, "providerName");
			validateString(savedRecord.extractorName, "extractorName");
			savedRecord.excludeIfContains ??= [];
			if (!Array.isArray(savedRecord.excludeIfContains)) throw new TypeError("excludeIfContains must be an array of nonempty strings.");
			for (const text of savedRecord.excludeIfContains) validateString(text, "excludeIfContains item");
			savedRecord.captureEnabled ??= true;
			validateBoolean(savedRecord.captureEnabled, "captureEnabled");
			break;
		case "requests":
			validateString(savedRecord.requestId, "requestId");
			validateURL(savedRecord.url, "url");
			savedRecord.hostname = new URL(savedRecord.url).hostname;
			validateString(savedRecord.method, "method");
			validateTimeStamp(savedRecord.timeStamp);
			validateChromeId(savedRecord.tabId, "tabId");
			savedRecord.pageURL ??= null;
			if (savedRecord.pageURL !== null) validateURL(savedRecord.pageURL, "pageURL");
			savedRecord.utmSource ??= null;
			validateNullableString(savedRecord.utmSource, "utmSource");
			savedRecord.utmMedium ??= null;
			validateNullableString(savedRecord.utmMedium, "utmMedium");
			if (savedRecord.frameId !== void 0) validateChromeId(savedRecord.frameId, "frameId");
			if (savedRecord.initiator !== void 0) validateString(savedRecord.initiator, "initiator");
			break;
		case "lastSeenValues":
		case "settings": validateHasValue(savedRecord);
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
function validateQuery(storeName, filters = {}) {
	validateStoreName(storeName);
	validateObject(filters, SUPPORTED_FILTERS[storeName]);
	const selectedFilters = cloneRecord(filters);
	for (const [field, value] of Object.entries(selectedFilters)) {
		if (value === void 0) {
			delete selectedFilters[field];
			continue;
		}
		switch (field) {
			case "domain":
			case "hostname":
				validateHostname(value, field);
				break;
			case "pageURL":
				if (value !== null) validateURL(value, field);
				break;
			case "timeStamp":
				validateTimeStamp(value);
				break;
			case "tabId":
				validateChromeId(value, field);
				break;
			case "utmSource":
			case "utmMedium":
				validateNullableString(value, field);
				break;
			case "captureEnabled":
				validateBoolean(value, field);
				break;
			default: validateString(value, field);
		}
	}
	return selectedFilters;
}
var SUPPORTED_FILTERS;
var init_validation = __esmMin((() => {
	init_schema();
	SUPPORTED_FILTERS = {
		trackingDomains: [
			"domain",
			"providerName",
			"extractorName",
			"captureEnabled"
		],
		requests: [
			"requestId",
			"tabId",
			"hostname",
			"pageURL",
			"timeStamp",
			"utmSource",
			"utmMedium"
		],
		lastSeenValues: ["name"],
		settings: ["key"]
	};
}));
//#endregion
//#region src/utils/logger.js
/** Creates a labelled logger in console. */
function createLogger(label) {
	const prefix = `[${label}]`;
	return {
		info: console.info.bind(console, prefix),
		warn: console.warn.bind(console, prefix),
		error: console.error.bind(console, prefix)
	};
}
var init_logger = __esmMin((() => {}));
//#endregion
//#region src/database/manager.js
/**
* Puts a `hostname` in the form the browser uses (lowercase, international characters converted to ASCII, and no trailing dot).
*
* @param {string} hostname Hostname to convert.
* @returns {string} The converted `hostname`.
*/
function normalizeHostname(hostname) {
	return new URL(`https://${hostname}`).hostname.replace(/\.$/, "");
}
var log, Database;
var init_manager = __esmMin((() => {
	init_schema();
	init_validation();
	init_logger();
	log = createLogger("database");
	Database = class {
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
			if (typeof databaseName !== "string" || databaseName.trim().length === 0) throw new TypeError("databaseName must be a nonempty string.");
			this.#databaseName = databaseName;
		}
		/**
		* Opens the database if it is not open yet. Every other method calls this itself.
		*
		* @returns {Promise<void>} Resolves once the database and its defaults are ready.
		*/
		async open() {
			if (this.#connection) return;
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
		/**
		* Lists the records in a store whose fields exactly equal every given filter.
		*
		* @param {string} storeName Name of a store in `STORE_KEYS`.
		* @param {Object} [filters={}] Field values to match. An empty object lists every record.
		* @returns {Promise<Object[]>} Matching records, sorted by primary key.
		*/
		async list(storeName, filters = {}) {
			const selectedFilters = validateQuery(storeName, filters);
			return (await this.#performRequest(storeName, "readonly", (store) => {
				for (const [field, value] of Object.entries(selectedFilters)) {
					if (value === null) continue;
					if (field === store.keyPath) return store.getAll(value);
					if (store.indexNames.contains(field)) return store.index(field).getAll(value);
				}
				return store.getAll();
			})).filter((record) => {
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
			return await this.#performRequest(storeName, "readonly", (store) => store.get(keyValue));
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
			if (copiedRecord[keyPath] !== void 0 && copiedRecord[keyPath] !== keyValue) throw new TypeError(`${keyPath} must match the given key.`);
			copiedRecord[keyPath] = keyValue;
			const validatedRecord = validateRecord(storeName, copiedRecord);
			await this.#performRequest(storeName, "readwrite", (store) => store.put(validatedRecord));
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
			const key = await this.#performRequest(storeName, "readwrite", (store) => store.add(validatedRecord));
			return {
				...validatedRecord,
				[STORE_KEYS[storeName]]: key
			};
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
			if (Object.hasOwn(copiedChanges, keyPath) && copiedChanges[keyPath] !== keyValue) throw new TypeError(`${keyPath} cannot be changed.`);
			return await this.#performTransaction([storeName], "readwrite", (transaction, setResult, fail) => {
				const store = transaction.objectStore(storeName);
				const request = store.get(keyValue);
				request.onsuccess = () => {
					if (request.result === void 0) return;
					try {
						const validatedRecord = validateRecord(storeName, {
							...request.result,
							...copiedChanges
						});
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
			await this.#performRequest(storeName, "readwrite", (store) => store.delete(keyValue));
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
			await this.#performRequest(storeName, "readwrite", (store) => store.clear());
		}
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
			if (typeof url !== "string") throw new TypeError("url must be a full URL.");
			const parsedURL = new URL(url);
			if (!["http:", "https:"].includes(parsedURL.protocol)) return void 0;
			const trackingDomains = await this.list("trackingDomains");
			const trackingDomain = this.#mostSpecificTrackingDomain(trackingDomains, parsedURL.hostname);
			const hostnameAndPath = parsedURL.hostname + parsedURL.pathname;
			if (trackingDomain?.excludeIfContains.some((text) => hostnameAndPath.includes(text))) return;
			return trackingDomain;
		}
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
			return await this.#saveNewRecord("requests", record, "Request");
		}
		/**
		* Returns a saved request by its `id`.
		*
		* @param {number} id The `id` the database generated, not Chrome's `requestId`.
		* @returns {Promise<Object|undefined>} The request, or `undefined` if there is none.
		*/
		async getRequest(id) {
			return await this.get("requests", id);
		}
		/**
		* Lists saved requests matching every given filter, oldest first.
		*
		* @param {Object} [filters={}] Exact requestId, tabId, hostname, pageURL, timeStamp, utmSource or utmMedium values.
		* @returns {Promise<Object[]>} The matching requests.
		*/
		async listRequests(filters = {}) {
			return await this.list("requests", filters);
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
			const selectedFilters = validateQuery("requests", filters);
			const storeNames = ["trackingDomains", "requests"];
			const readBothStores = (transaction, setResult) => {
				const trackingDomainsRequest = transaction.objectStore("trackingDomains").getAll();
				const requestsRequest = transaction.objectStore("requests").getAll();
				requestsRequest.onsuccess = () => setResult({
					trackingDomains: trackingDomainsRequest.result,
					requests: requestsRequest.result
				});
			};
			const { trackingDomains, requests } = await this.#performTransaction(storeNames, "readonly", readBothStores);
			const history = Object.create(null);
			requests.sort((first, second) => {
				return second.timeStamp - first.timeStamp || second.id - first.id;
			});
			for (const request of requests) {
				if (!Object.entries(selectedFilters).every(([field, value]) => {
					return request[field] === value;
				})) continue;
				const pageKey = request.pageURL ?? "Unknown page";
				const providerName = this.#mostSpecificTrackingDomain(trackingDomains, request.hostname)?.providerName ?? request.hostname;
				history[pageKey] ??= Object.create(null);
				history[pageKey][providerName] ??= [];
				history[pageKey][providerName].push(request);
			}
			return history;
		}
		/**
		* Deletes every saved request. Tracking domains and settings are kept.
		*
		* @returns {Promise<void>} Resolves once the requests are deleted.
		*/
		async clearRequestHistory() {
			await this.clear("requests");
		}
		/**
		* Returns a setting's value.
		*
		* @param {string} key Setting name, e.g. 'captureTrackingRequests'.
		* @returns {Promise<*>} The value, or `undefined` if the setting does not exist.
		*/
		async getSetting(key) {
			return (await this.get("settings", key))?.value;
		}
		/**
		* Saves a setting, replacing its previous value.
		*
		* @param {*} value Any value IndexedDB can store, including arrays and objects.
		* @param {string} key Setting name.
		* @returns {Promise<*>} The saved value.
		*/
		async setSetting(value, key) {
			return (await this.set("settings", { value }, key)).value;
		}
		/**
		* Returns the value last saved under a name, such as the previous provider session ID.
		*
		* @param {string} name Name the value was saved under.
		* @returns {Promise<*>} The value, or undefined if nothing was saved under that name.
		*/
		async getLastSeenValue(name) {
			return (await this.get("lastSeenValues", name))?.value;
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
			return (await this.set("lastSeenValues", { value }, name)).value;
		}
		/**
		* Adds a new record to a store whose ids are generated, and logs the result.
		* Only the `id` and the error name are logged, never captured values.
		*
		* @param {string} storeName 'requests'.
		* @param {Object} record The new record, without an `id`.
		* @param {string} description What the record is, used in log and error messages.
		* @returns {Promise<Object>} The saved record, including its generated `id`.
		*/
		async #saveNewRecord(storeName, record, description) {
			try {
				if (record?.id !== void 0) throw new TypeError(`${description} must not include an id when it is saved.`);
				const savedRecord = await this.add(storeName, record);
				log.info(`${description} committed.`, { id: savedRecord.id });
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
				if ((requestHostname === domain || requestHostname.endsWith(`.${domain}`)) && domain.length > bestMatchLength) {
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
				const request = indexedDB.open(this.#databaseName, 1);
				let blocked = false;
				request.onupgradeneeded = () => {
					if (blocked) {
						request.transaction.abort();
						return;
					}
					initializeSchema(request.result);
				};
				request.onerror = () => {
					log.error("Storage open failed.", request.error.name);
					reject(request.error);
				};
				request.onblocked = () => {
					blocked = true;
					log.warn("Open blocked. Close other database users.");
					reject(new DOMException("Database opening is blocked.", "InvalidStateError"));
				};
				request.onsuccess = () => {
					const connection = request.result;
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
					log.info("Storage opened.");
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
			return await new Promise((resolve, reject) => {
				const transaction = this.#connection.transaction(storeNames, mode);
				let result;
				let failure;
				const fail = (error) => {
					failure = error;
					transaction.abort();
				};
				transaction.oncomplete = () => resolve(result);
				transaction.onerror = (event) => {
					failure = event.target.error;
				};
				transaction.onabort = () => {
					reject(failure || transaction.error || new DOMException("Database transaction aborted.", "AbortError"));
				};
				try {
					operation(transaction, (value) => {
						result = value;
					}, fail);
				} catch (error) {
					fail(error);
				}
			});
		}
	};
}));
//#endregion
//#region src/utils/dbhelper.js
var database;
var init_dbhelper = __esmMin((() => {
	init_manager();
	database = new Database();
}));
//#endregion
//#region src/utils/utm.js
/**
* Reads the UTM parameters from one URL, from its query string and from a query-like fragment.
*
* @param {string|URL} url The URL to read
* @return {?Object<string, string>} The UTM fields found, such as `{utmSource: 'newsletter'}`, or `null` when there are none
*/
function readUTM(url) {
	let parsedURL;
	try {
		parsedURL = new URL(url);
	} catch {
		return null;
	}
	if (!["http:", "https:"].includes(parsedURL.protocol)) return null;
	const fields = {};
	const fragment = parsedURL.hash.includes("=") ? new URLSearchParams(parsedURL.hash.slice(1)) : new URLSearchParams();
	for (const parameters of [parsedURL.searchParams, fragment]) for (const [name, value] of parameters) {
		const field = UTM_PARAMETERS[name.toLowerCase()];
		const trimmedValue = value.trim();
		if (field && trimmedValue && fields[field] === void 0) fields[field] = trimmedValue;
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
function findUTM(details) {
	const requestURL = new URL(details.url);
	const candidates = [
		...fieldCandidates("query", [...requestURL.searchParams], true),
		{
			foundIn: "url",
			url: requestURL.href
		},
		...fieldCandidates("query", [...requestURL.searchParams], false)
	];
	const formData = details.requestBody?.formData;
	if (formData) {
		const entries = Object.entries(formData).flatMap(([name, values]) => values.map((value) => [name, value]));
		candidates.push(...fieldCandidates("formData", entries, true), ...fieldCandidates("formData", entries, false));
	}
	for (const text of bodyTexts(details.requestBody)) {
		for (const line of text.split(/\r?\n/)) candidates.push(...fieldCandidates("body", [...new URLSearchParams(line)], true));
		for (const url of text.match(/https?:\/\/[^\s"'<>\\]+/g) ?? []) candidates.push({
			foundIn: "body",
			url
		});
	}
	for (const candidate of candidates) {
		const fields = readUTM(candidate.url);
		if (fields) return {
			...fields,
			utmFoundIn: candidate.foundIn
		};
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
	if (pageFields) return PAGE_URL_FIELDS.flatMap((field) => entries.filter(([name]) => name.toLowerCase() === field).map(([name, value]) => ({
		foundIn: `${place}:${name}`,
		url: value
	})));
	return entries.filter(([name, value]) => !PAGE_URL_FIELDS.includes(name.toLowerCase()) && /^https?:\/\//i.test(value)).map(([name, value]) => ({
		foundIn: `${place}:${name}`,
		url: value
	}));
}
/**
* Decodes the raw parts of a request body as UTF-8 text. Compressed bodies will not be readable this way.
*
* @param {?Object} requestBody The `requestBody` from the `webRequest` details.
* @return {!Array<string>} The decoded texts.
*/
function bodyTexts(requestBody) {
	const decoder = new TextDecoder();
	return (requestBody?.raw ?? []).filter((part) => part.bytes instanceof ArrayBuffer).map((part) => decoder.decode(part.bytes));
}
var UTM_PARAMETERS, PAGE_URL_FIELDS;
var init_utm = __esmMin((() => {
	UTM_PARAMETERS = {
		utm_source: "utmSource",
		utm_medium: "utmMedium",
		utm_campaign: "utmCampaign",
		utm_term: "utmTerm",
		utm_content: "utmContent",
		utm_id: "utmId",
		utm_source_platform: "utmSourcePlatform",
		utm_creative_format: "utmCreativeFormat",
		utm_marketing_tactic: "utmMarketingTactic"
	};
	PAGE_URL_FIELDS = [
		"dl",
		"url",
		"pu",
		"page_location",
		"page_url",
		"location",
		"href",
		"u"
	];
}));
//#endregion
export { database as a, init_logger as c, readUTM as i, __commonJSMin as l, findUTM as n, init_dbhelper as o, init_utm as r, createLogger as s, UTM_PARAMETERS as t, __esmMin as u };
