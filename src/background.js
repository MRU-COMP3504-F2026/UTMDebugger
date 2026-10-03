

/*---------------------------------------------------*/
/*              Main API call Listener               */
/*---------------------------------------------------*/

/**
 * Main API call listener.
 * 
 * Every API call will contain details (api event data) that is:
 * --> requestId: the unique id that stays the same for all events in that request (mainly redirects) 
 *      and across the different types of listeners like onBeforeRequst and onCompleted
 * --> url: the full url being requested
 * --> method: HTTP method - GET, POST, Put, etc
 * --> timeStamp: when the event fired in milliseconds, you can switch it to a date using the "new Date(details.timeStamp)"
 * --> initiator: the origin that initiated the request (google what exactly this means)
 * --> requestBody: only present if the request has a body
 */

chrome.webRequest.onBeforeRequest.addListener(
    (details)=> {

        // create the url and hostname variables using details
        const URL = new URL(details.url);
        const HOSTNAME = URL.hostname;

        
        // open the database (currently doesn't exist, wail till that team responds)

    },
    { urls: ["<all_urls>"]},
    ["requestBody"]
)