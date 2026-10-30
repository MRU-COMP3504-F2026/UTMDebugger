import { database } from '../utils/dbhelper.js';

export const extractorFunctions = {
    googleAnalyticsExtractor(database, details){
        function checkConsistentUData(database){
            //returns a json if mismatch, else return true
        }
        return checkConsistentUData(database);
    },
    async clarityExtractor(database, details){
        //extracting u data
        const arrayBuffer = details.requestBody?.raw?.[0]?.bytes; // collects the raw gzip bytes
        // if not found, return undefined;
        if(!arrayBuffer) return undefined;

        // creates a decompression 'pipe'
        const ds = new DecompressionStream('gzip'); 
        // wrap the bytes into a blob (binary large object) just to be able to use the stream() func
        const blob = new Blob([arrayBuffer]); 
        // turns the blob into an output 'stream' and connects the output to the decompression pipe
        const stream = blob.stream().pipeThrough(ds);
        // decompressed is basically a bucket that collects all the decompressed bytes 
        const decompressed = await new Response(stream).arrayBuffer();
        // results turns those bytes into text we can read
        const result = new TextDecoder().decode(decompressed);
        // turn that text into json
        const jsonResult = JSON.parse(result);
        // get the userID by navigating the json (userID is always in the same place)
        const userID = jsonResult.e[5];
        
        // now I need to query the db
        const callHistory = await database.getRequestHistory();
        console.log(callHistory); 
        
        // get the current page url
        const currURL = await pageURL(details)
        const currDomain = currURL.host;

        const found = false;

        // check history for descrepencies in User ID
        // for each historic url
        for(const [key,value] of Object.entries(callHistory)){
            // get the domain of the url in history
            const histDomain = new URL(key).host;

            // if domain doesn't match, move on to the next historic url
            if (currDomain != histDomain) continue; 

            // domain is matched, but it is not the same url
            if (key != currURL){
                // if the previous url didn't track Micrsoft Clarity code then it
                // means that the previous page the user was on for the same domain is 
                // missing the tracking code when the current page has it, throw error
                if(!value || !value["Micrsoft Clarity"]){
                    return {
                        isError:true,
                        errorMSG:`The page '${key}' does not contain Microsoft Clarity tracking code while this one does`,
                        type:"missingCode",
                        currPage:currURL,
                        errorPage:key
                    }
                } 

                // if historic page userID doesn't match the current page url
                // it means that something wrong happened and return an error object
                if(value["Micrsoft Clarity"][0].userID != userID){
                    return {
                        isError:true,
                        errorMSG:`Micrsoft Clarity user ID for page ${key} does not match the user ID for the current page ${currURL}`,
                        type:"UIDMismatch", 
                        currPage: currURL,
                        errorPage: key,
                        errorPageVal: value["Micrsoft Clarity"][0].userID,
                        currPageVal: userID
                    }
                } 
                // if no error and data already found, continue to save time
                if(found) continue;

                // Clarity record exists and matches userID, set found to user data
                found = {
                    userID:userID,
                    utmSource:value["Micrsoft Clarity"][0].utmSource,
                    utmMedium:value["Micrsoft Clarity"][0].utmMedium
                };
            } else /* url matched */ {
                // if page does match but value is falsly or value of microsft clarity is falsly (aka empty or not there)
                // then it means the this is the first entry for the page and we want to find a previous one
                if (!value || !value["Micrsoft Clarity"]) continue;

                // if no error and data already found, continue to save time
                if (found) continue;

                // Clarity record exists, set found to user data
                found = {
                    userID:userID,
                    utmSource:value["Micrsoft Clarity"][0].utmSource,
                    utmMedium:value["Micrsoft Clarity"][0].utmMedium
                };
            }
        }

        // if user data is not found, pull user data from envelope a 
        // (logically, this would only every happen if this is the 
        // first api call of the first page that the user sees per domain)
        if (!found){
            // get envelope A (that contains the user UTM data);
            const envelopeA = jsonResult.a;

            console.log(envelopeA);
        }

        return found;
    },
    hubSpotExtractor(database, details){
        function checkConsistentUData(database){
            //returns a json if mismatch, else return true
        }
        //extracting u data
        return checkConsistentUData(database);
    },
    googleAdsExtractor(database, details){
        function checkConsistentUData(database){
            //returns a json if mismatch, else return true
        }
        //extracting u data
        return checkConsistentUData(database);
    },
    metaPixelExtractor(database, details){
        function checkConsistentUData(database) {
            //returns a json if mismatch, else return true
        }
        //extracting u data
        return checkConsistentUData(database);
    }
}