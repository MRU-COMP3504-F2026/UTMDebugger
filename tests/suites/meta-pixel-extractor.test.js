import {suite, test, assertEqual} from '../testing.js';
import {metaPixelExtractor} from '../../src/extractors/meta-pixel-extractor.js';
import {extractorFunctions} from '../../src/utils/extractors.js';
import {Database} from '../../src/database/manager.js';

suite('Meta Pixel extractor', () => {
    const PAGEVIEW_URL =
        'https://www.facebook.com/tr/?id=123&ev=PageView&fbp=fb.1.1.2' +
        '&dl=https%3A%2F%2Fshop.test%2F%3Futm_source%3Dfb%26utm_medium%3Dpaid';
    
    test('reads a GET PageView', () => {
      assertEqual(metaPixelExtractor({url: PAGEVIEW_URL}), {
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
    assertEqual(result, {pixelId: '123', eventName: 'Purchase', fbp: null, fbc: null});
  });
  
  test('prefers query params over body params', () => {
    const result = metaPixelExtractor({
      url: 'https://www.facebook.com/tr/?ev=Lead',
      requestBody: {formData: {ev: ['Purchase']}},
    });
    assertEqual(result.eventName, 'Lead');
  });
  
  test('uses null and not undefined for missing values', () => {
    assertEqual(metaPixelExtractor({url: 'https://www.facebook.com/tr/?id=123'}), {
      pixelId: '123',
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
  
  test('a Pixel beacon gets routed to a handler that exists', async () => {
    await deleteTestDatabase();
    const database = new Database(TEST_DATABASE_NAME);
    const trackingDomain = await database.findTrackingDomain(PAGEVIEW_URL);
    assertEqual(trackingDomain.extractorName, 'metaPixelExtractor');
    assertEqual(trackingDomain.captureEnabled, true);
    assertEqual(typeof extractorFunctions[trackingDomain.extractorName], 'function');
  });
  
  test('the Meta Pixel script download is not treated as a tracking request', async () => {
    await deleteTestDatabase();
    const database = new Database(TEST_DATABASE_NAME);
    const url = 'https://connect.facebook.net/en_US/fbevents.js';
    assertEqual(await database.findTrackingDomain(url), undefined);
  });
});
