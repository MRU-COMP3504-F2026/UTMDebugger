import {suite, test, assertEqual} from './testing.js';
import {metaPixelExtractor} from '../src/extractors/meta-pixel-extractor.js';
import {Database} from '../src/database/manager.js';

suite('Meta Pixel extractor');

const PAGEVIEW_URL =
    'https://www.facebook.com/tr/?id=123&ev=PageView&fbp=fb.1.1.2' +
    '&dl=https%3A%2F%2Fshop.test%2F%3Futm_source%3Dfb%26utm_medium%3Dpaid';

test('reads a GET PageView', () => {
  assertEqual(metaPixelExtractor({url: PAGEVIEW_URL}), {
    pageURL: 'https://shop.test/?utm_source=fb&utm_medium=paid',
    utmSource: 'fb',
    utmMedium: 'paid',
    pixelId: '123',
    eventName: 'PageView',
    fbp: 'fb.1.1.2',
    fbc: null,
  });
});

test('reads the click id when present', () => {
  const result = metaPixelExtractor({url: 'https://www.facebook.com/tr/?id=1&fbc=fb.1.1.abc'});
  assertEqual(result.fbc, 'fb.1.1.abc');
});

test('ignores other facebook.com requests', () => {
  assertEqual(metaPixelExtractor({url: 'https://www.facebook.com/so/something/like.php'}), null);
});

test('ignores paths that only start with /tr', () => {
  assertEqual(metaPixelExtractor({url: 'https://www.facebook.com/trace?id=1'}), null);
});

test('reads form POST bodies', () => {
  const result = metaPixelExtractor({
    url: 'https://www.facebook.com/tr',
    requestBody: {formData: {id: ['123'], ev: ['Purchase']}},
  });
  assertEqual(result, {
    pageURL: null,
    utmSource: null,
    utmMedium: null,
    pixelId: '123',
    eventName: 'Purchase',
    fbp: null,
    fbc: null,
  });
});

test('prefers query params over body params', () => {
  const result = metaPixelExtractor({
    url: 'https://www.facebook.com/tr/?ev=Lead',
    requestBody: {formData: {ev: ['Purchase']}},
  });
  assertEqual(result.eventName, 'Lead');
});

test('turns an invalid dl into null instead of throwing', () => {
  const result = metaPixelExtractor({url: 'https://www.facebook.com/tr/?id=1&dl=nope'});
  assertEqual([result.pageURL, result.utmSource, result.utmMedium], [null, null, null]);
});

test('uses null and not undefined for missing params', () => {
  assertEqual(metaPixelExtractor({url: 'https://www.facebook.com/tr/?id=1'}), {
    pageURL: null,
    utmSource: null,
    utmMedium: null,
    pixelId: '1',
    eventName: null,
    fbp: null,
    fbc: null,
  });
});

// Testing with the database.
// These need a real IndexedDB, so they only run in the browser.
const TEST_DATABASE_NAME = 'UTMDebuggerTestMetaPixel';

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(TEST_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

test('the default tracking domains route a Pixel beacon to this extractor', async () => {
  await deleteTestDatabase();
  const database = new Database(TEST_DATABASE_NAME);
  const trackingDomain = await database.findTrackingDomain(PAGEVIEW_URL);
  assertEqual(trackingDomain.extractorName, 'metaPixelExtractor');
  assertEqual(trackingDomain.captureEnabled, true);
});

test('the Meta Pixel script download is not treated as a tracking request', async () => {
  await deleteTestDatabase();
  const database = new Database(TEST_DATABASE_NAME);
  const url = 'https://connect.facebook.net/en_US/fbevents.js';
  assertEqual(await database.findTrackingDomain(url), undefined);
});

test('saveRequest accepts what the extractor returns', async () => {
  await deleteTestDatabase();
  const database = new Database(TEST_DATABASE_NAME);
  const saved = await database.saveRequest({
    ...metaPixelExtractor({url: PAGEVIEW_URL}),
    requestId: '1',
    url: PAGEVIEW_URL,
    method: 'GET',
    timeStamp: Date.now(),
    tabId: 1,
  });
  assertEqual([saved.pixelId, saved.eventName, saved.utmSource], ['123', 'PageView', 'fb']);
  assertEqual((await database.listRequests({utmSource: 'fb'})).length, 1);
});