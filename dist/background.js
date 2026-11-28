import { a as database, c as init_logger, l as __commonJSMin, n as findUTM, o as init_dbhelper, r as init_utm, s as createLogger, u as __esmMin } from "./assets/utm-Cx-_hj0n.js";
//#region src/utils/page.js
/**
* Finds the page the user was on when the request was sent.
*
* @param {!Object} details The `webRequest` event details.
* @return {!Promise<string|null>} The page URL, or `null` when the request has no tab or the tab is gone.
*/
async function pageURL(details) {
	if (details.type === "main_frame") return details.url;
	if (details.tabId < 0) return null;
	let tab;
	try {
		tab = await chrome.tabs.get(details.tabId);
	} catch {
		return null;
	}
	return tab.url && /^https?:/.test(tab.url) ? tab.url : null;
}
var init_page = __esmMin((() => {}));
//#endregion
//#region src/utils/extractors.js
var extractorFunctions;
var init_extractors = __esmMin((() => {
	init_dbhelper();
	init_page();
	extractorFunctions = {
		googleAnalyticsExtractor(database, details) {},
		async clarityExtractor(database, details) {
			function isURL(possibleURL) {
				let outcome = true;
				try {
					const urlString = possibleURL[0];
					new URL(urlString);
				} catch (e) {
					outcome = false;
				}
				return outcome;
			}
			const arrayBuffer = details.requestBody?.raw?.[0]?.bytes;
			if (!arrayBuffer) return void 0;
			const ds = new DecompressionStream("gzip");
			const stream = new Blob([arrayBuffer]).stream().pipeThrough(ds);
			const decompressed = await new Response(stream).arrayBuffer();
			const result = new TextDecoder().decode(decompressed);
			const jsonResult = JSON.parse(result);
			const userID = jsonResult.e[5];
			const callHistory = await database.getRequestHistory();
			console.log(callHistory);
			const currURL = await pageURL(details);
			const currDomain = new URL(currURL).host;
			let found = false;
			for (const [key, value] of Object.entries(callHistory)) {
				const histDomain = new URL(key).host;
				console.log(histDomain);
				console.log(currDomain);
				if (currDomain != histDomain) continue;
				if (key != currURL) {
					if (!value || !value["Microsoft Clarity"]) return {
						isError: true,
						trackingSoftware: "Microsoft Clarity",
						errorMSG: `The page '${key}' does not contain Microsoft Clarity tracking code while this one does`,
						type: "missingCode",
						currPage: currURL,
						errorPage: key
					};
					if (value["Microsoft Clarity"][0].userID != userID) return {
						isError: true,
						trackingSoftware: "Microsoft Clarity",
						errorMSG: `Microsoft Clarity user ID for page ${key} does not match the user ID for the current page ${currURL}`,
						type: "UIDMismatch",
						currPage: currURL,
						errorPage: key,
						errorPageVal: value["Microsoft Clarity"][0].userID,
						currPageVal: userID
					};
					if (found) continue;
					found = {
						isError: false,
						userID,
						utmSource: value["Microsoft Clarity"][0].utmSource || "direct",
						utmMedium: value["Microsoft Clarity"][0].utmMedium || "direct"
					};
				} else {
					if (!value || !value["Microsoft Clarity"]) continue;
					if (found) continue;
					found = {
						isError: false,
						userID,
						utmSource: value["Microsoft Clarity"][0].utmSource || "direct",
						utmMedium: value["Microsoft Clarity"][0].utmMedium || "direct"
					};
				}
			}
			if (!found) {
				const envelopeA = jsonResult.a;
				for (const [key, value] of Object.entries(envelopeA)) {
					for (let i = 0; i < value.length - 1 && !found; i++) {
						if (!value[i] === 1) continue;
						const possibleURL = value[i + 1];
						if (!possibleURL || !isURL(possibleURL)) continue;
						const url = new URL(possibleURL[0]);
						found = {
							isError: false,
							userID,
							utmSource: url.searchParams.get("utm_source") || "direct",
							utmMedium: url.searchParams.get("utm_medium") || "direct"
						};
					}
					if (found) break;
				}
			}
			console.log(found);
			return found;
		},
		hubSpotExtractor(database, details) {},
		googleAdsExtractor(database, details) {},
		async metaPixelExtractor(database, details) {
			function hostOf(url) {
				let host = null;
				try {
					host = new URL(url).host;
				} catch (e) {}
				return host;
			}
			function checkConsistentUData(callHistory, currURL, userID) {
				const currDomain = hostOf(currURL);
				if (currDomain === null) return true;
				for (const [key, value] of Object.entries(callHistory)) {
					if (hostOf(key) !== currDomain) continue;
					if (key === currURL) continue;
					if (!value["Meta Pixel"]) return {
						isError: true,
						trackingSoftware: "Meta Pixel",
						errorMSG: `The page '${key}' does not contain Meta Pixel tracking code while this one does`,
						type: "missingCode",
						currPage: currURL,
						errorPage: key
					};
					const pastRequest = value["Meta Pixel"]?.[0];
					if (typeof pastRequest?.userID !== "string") continue;
					if (pastRequest.userID !== userID) return {
						isError: true,
						trackingSoftware: "Meta Pixel",
						errorMSG: `Meta Pixel browser ID for page ${key} does not match the browser ID for the current page ${currURL}`,
						type: "UIDMismatch",
						currPage: currURL,
						errorPage: key,
						errorPageVal: pastRequest.userID,
						currPageVal: userID
					};
				}
				return true;
			}
			const url = new URL(details.url);
			if (url.pathname !== "/tr" && !url.pathname.startsWith("/tr/")) return null;
			const params = new Map(url.searchParams);
			const formData = details.requestBody?.formData;
			if (formData) {
				for (const [key, values] of Object.entries(formData)) if (!params.has(key) && values.length > 0) params.set(key, values[0]);
			}
			const userID = params.get("fbp") ?? null;
			const metaData = {
				userID,
				pixelId: params.get("id") ?? null,
				eventName: params.get("ev") ?? null,
				fbc: params.get("fbc") ?? null
			};
			const currURL = await pageURL(details);
			let consistent = true;
			if (userID !== null && currURL !== null) consistent = checkConsistentUData(await database.getRequestHistory(), currURL, userID);
			if (consistent !== true) return {
				...metaData,
				...consistent
			};
			return {
				isError: false,
				...metaData
			};
		}
	};
}));
//#endregion
//#region src/background.js
var require_background = /* @__PURE__ */ __commonJSMin((() => {
	init_dbhelper();
	init_extractors();
	init_logger();
	init_page();
	init_utm();
	var log = createLogger("listener");
	/**
	* Main API call listener.
	* 
	* Every API call will contain details (api event data) that is:
	* --> requestId: the unique id that stays the same for all events 
	*      in that request (mainly redirects) and across the different 
	*      types of listeners like onBeforeRequst and onCompleted
	* --> url: the full url being requested
	* --> method: HTTP method - GET, POST, Put, etc
	* --> timeStamp: when the event fired in milliseconds, you can 
	*      switch it to a date using the "new Date(details.timeStamp)"
	* --> initiator: the origin that initiated the request (google what exactly this means)
	* --> requestBody: only present if the request has a body
	*/
	chrome.webRequest.onBeforeRequest.addListener(async (details) => {
		try {
			const url = new URL(details.url);
			const db = database;
			await db.open();
			const name = await runFuncWithTimeout(isValidTrackingCall, [db, url], 2e3);
			if (!name) return;
			const extractor = extractorFunctions[name];
			if (typeof extractor !== "function") throw new Error(`No extractor named ${name} exists in extractors.js.`);
			const fields = await runFuncWithTimeout(extractor, [db, details], 2e3);
			if (fields !== void 0 && (fields === null || typeof fields !== "object" || Array.isArray(fields))) throw new TypeError(`${name} must return an object of request fields, or nothing.`);
			await db.saveRequest({
				requestId: details.requestId,
				url: details.url,
				method: details.method,
				timeStamp: details.timeStamp,
				tabId: details.tabId,
				frameId: details.frameId,
				...details.initiator === void 0 ? {} : { initiator: details.initiator },
				pageURL: await pageURL(details),
				...findUTM(details),
				...fields
			});
		} catch (e) {
			log.error("Request handling failed.", e);
		}
	}, { urls: ["<all_urls>"] }, ["requestBody"]);
	var ICONS = {
		active: "/dist/icons/icon-active.png",
		inactive: "/dist/icons/icon-inactive.png"
	};
	function applyIcon(isActive) {
		chrome.action.setIcon({ path: isActive ? ICONS.active : ICONS.inactive });
	}
	chrome.runtime.onConnect.addListener((port) => {
		if (port.name !== "popup") return;
		applyIcon(true);
		port.onDisconnect.addListener(() => applyIcon(false));
	});
	/**
	* Takes a API call url and runs a few checks:
	* 1. Does the API call belong to a tracking software
	* 2. Does the API call url contain a string that identifies that the API 
	*   call is not part of the actual tracking portion of the software
	* 3. Does the API call have the exclude tracking option enabled
	* 
	* @param {!Database} db - the database instance
	* @param {string} URL - The full url of the API call
	* @return {!Promise<string|boolean>}- The tracking software extractor function name if passed, else, false
	*/
	async function isValidTrackingCall(db, url) {
		const trackerRecord = await db.findTrackingDomain(url.href);
		if (!trackerRecord) return false;
		if (!trackerRecord.captureEnabled) return false;
		return trackerRecord.extractorName;
	}
	/**
	* Given a function, it's arguments, and a timer length in miliseconds,
	*   it races the function promise agains a timer promise. This then 
	*   returns the first resolve/reject given by either promise
	* 
	* @param {function(...*): !Promise<T>} task the function that will be called
	* @param {!Array<*>} args the arguments that will be used in the function/task. ex: ["a","b"]
	* @param {number} ms the time limit in miliseconds 
	* @return {!Promise<T>} returns the first resolve or reject of either the function promise
	*      or the timer promise.
	*/
	function runFuncWithTimeout(task, args, ms) {
		const taskName = task.name || "Anonymous Function";
		const taskPromise = task(...args);
		let timerId;
		const timeout = new Promise((resolve, reject) => {
			timerId = setTimeout(() => {
				reject(/* @__PURE__ */ new Error(`The function '${taskName}', timed out after ${ms} ms`));
			}, ms);
		});
		return Promise.race([taskPromise, timeout]).finally(() => {
			clearTimeout(timerId);
		});
	}
}));
//#endregion
export default require_background();
