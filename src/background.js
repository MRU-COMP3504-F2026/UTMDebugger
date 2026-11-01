import {database} from './utils/dbhelper.js';
import {extractorFunctions} from './utils/extractors.js';
import {createLogger} from './utils/logger.js';
import {findUTM} from './utils/utm.js';

const log = createLogger('listener');

// TODO: Remove hardcoded tracking switch enabled on by default until a UI button is added.
const CAPTURE_TRACKING_REQUESTS = true;

/*---------------------------------------------------*/
/*              Main API call Listener               */
/*---------------------------------------------------*/

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

chrome.webRequest.onBeforeRequest.addListener(
    async (/* API Call Request Info = */ details) => {
        try{
            // create the url variable using details
            const url = new URL(details.url);
            // Open the database instance (uses a db class, initialize an object in that class and use the db)
            const db = database;
            await db.open();
            // Check to see if the extension is enabled for this site
            // Check to see if the call is a valid tracking software api call
            const name = await runFuncWithTimeout(isValidTrackingCall, [db,url], 2000);
            // if name is false, then return as it is a api call that we don't care about
            if (!name) return;
            // Handle the Api Call 
            // get the extractor function from the object containing all the extractor function
            const extractor = extractorFunctions[name];
            if (typeof extractor !== 'function') throw new Error(`No extractor named ${name} exists in extractors.js.`);
            // call the extractor with the database and details
            const fields = await runFuncWithTimeout(extractor, [db, details], 2000);
            if (fields !== undefined && (fields === null || typeof fields !== 'object' || Array.isArray(fields))) {
                throw new TypeError(`${name} must return an object of request fields, or nothing.`);
            }
            await db.saveRequest({
                requestId: details.requestId,
                url: details.url,
                method: details.method,
                timeStamp: details.timeStamp,
                tabId: details.tabId,
                frameId: details.frameId,
                ...(details.initiator === undefined ? {} : {initiator: details.initiator}),
                pageURL: await pageURL(details),
                ...findUTM(details),
                ...fields
            });
        } catch(e){
            log.error('Request handling failed.', e);
        }
    },
    { 
        /* What urls should our listener fire on */
        urls: ["<all_urls>"]
    },
    [
        /* What additional things that require permission may we need */ 
        "requestBody"
    ]
)

const ICONS = {
    active: '/dist/icons/icon-active.png',
    inactive: '/dist/icons/icon-inactive.png'
};

function applyIcon(isActive) {
    chrome.action.setIcon({path: isActive ? ICONS.active : ICONS.inactive});
}

// popup opens -> green, popup closes -> gray
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'popup') return;
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
    // return false the moment when a condition fails
    if (
      !CAPTURE_TRACKING_REQUESTS &&
      await db.getSetting('captureTrackingRequests') !== true
    ) return false;
    // The most specific tracking domain for the hostname, unless its path contains an excluded text
    const trackerRecord = await db.findTrackingDomain(url.href);
    if (!trackerRecord) return false;
    // condition 3
    if (!trackerRecord.captureEnabled) return false;
    return trackerRecord.extractorName;
}

/**
 * Finds the page the user was on when the request was sent.
 *
 * @param {!Object} details The `webRequest` event details.
 * @return {!Promise<string|null>} The page URL, or `null` when the request has no tab or the tab is gone.
 */
async function pageURL(details) {
    if (details.type === 'main_frame') return details.url;
    if (details.tabId < 0) return null;
    let tab;
    try {
        tab = await chrome.tabs.get(details.tabId);
    } catch {
        return null;
    }
    return tab.url && /^https?:/.test(tab.url) ? tab.url : null;
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
function runFuncWithTimeout(task, args, ms){
    // gets the name of the function, else, call it anonymouse
    const taskName = task.name || "Anonymous Function";
    // the value is the promise returned by the function and it's arguments
    const taskPromise = task(...args);
    let timerId;
    const timeout = new Promise((resolve, reject) => {
        // sets timerId to the timer
        timerId = setTimeout(() => {
            // After ms miliseconds, it calls the function
            // which rejects the timeout promise 
            reject(new Error(`The function '${taskName}', timed out after ${ms} ms`));
        }, ms);
    });
    // races the two promises and returns the first resolve/reject
    return Promise.race([taskPromise, timeout]).finally(() => {
        // clears the timer after the race finishes
        clearTimeout(timerId);
    });
}
