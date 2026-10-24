import { extractorFunctions } from './utils/extractors.js';
import { database } from './utils/dbhelper.js';
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
            db.open();

            // Check to see if the extension is enabled for this site

            // Check to see if the call is a valid tracking software api call
            const name = await runFuncWithTimeout(
            isValidTrackingCall, [db,url], 2000);
            
            // if name is false, then return as it is a api call that we don't care about
            if (!name) return;

            // Handle the Api Call 
            // get the extractor function from the object containing all the extractor function
            const extractor = extractorFunctions[name];
            // call the extractor with the database and details
            const checkValue = extractor(db, details);
            
            

        } catch(e){
            console.log(e);
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
    // condition 1
    // get the hostname of the api call url
    const hostname = url.hostname;
    // get the basic tracking software details. 
    const trackerRecord = db.get('trackingDomains', hostname)

    // if tracking software record is not found, return false
    // also it's currently broken because you need to check for two things:
    // if the hostname contains the valid tracking software domain
    // if the hostname does not contain the invalid version of the tracking 
    if (!trackerRecord) return false;

    // condition 2

    // condition 3
        
    // replace false with the tracking code name
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
