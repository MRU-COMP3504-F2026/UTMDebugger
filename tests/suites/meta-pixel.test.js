import {suite, test, assertEqual} from '../testing.js';
import {extractorFunctions} from '../../src/utils/extractors.js';
import {Database} from '../../src/database/manager.js';


const TEST_DATABASE = 'UTMDebuggerTestMetaPixel';

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(TEST_DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

suite('Meta Pixel extractor', () => {
  const handler = (details) => {
    return extractorFunctions.metaPixelExtractor(new Database(TEST_DATABASE), {tabId: -1, ...details});
  };
    
  test('reads a GET PageView', async () => {
      const result = await handler({url: 'https://www.facebook.com/tr/?id=7&ev=PageView'});
      assertEqual(result, {
        isError: false,
        pixelId: '7',
        eventName: 'PageView',
        fbc: null,
        userID: null,
      });
  });
  
  test('reads the click id when present', async () => {
    const result = await handler({url: 'https://www.facebook.com/tr/?id=7&fbc=fb.1.1.abc'});
    assertEqual(result.fbc, 'fb.1.1.abc');
  });
  
  test('ignores other facebook.com requests', async () => {
    assertEqual(await handler({url: 'https://www.facebook.com/so/something/like.php'}), null);
  });
  
  test('ignores paths that only start with /tr', async () => {
    assertEqual(await handler({url: 'https://www.facebook.com/trace?id=1'}), null);
  });
  
  test('reads form POST bodies', async () => {
    const result = await handler({
      url: 'https://www.facebook.com/tr',
      requestBody: {formData: {id: ['7'], ev: ['Purchase']}},
    });
    assertEqual(result, {
      userID: null,
      isError: false,
      pixelId: '7',
      eventName: 'Purchase',
      fbc: null,
    });
  });
  
  test('prefers query params over body params', async () => {
    const result = await handler({
      url: 'https://www.facebook.com/tr/?ev=Lead',
      requestBody: {formData: {ev: ['Purchase']}},
    });
    assertEqual(result.eventName, 'Lead');
  });
  
  test('uses null and not undefined for missing values', async () => {
    const result = await handler({url: 'https://www.facebook.com/tr/?id=7'});
    assertEqual(result, {
      isError: false,
      pixelId: '7',
      eventName: null,
      fbc: null,
      userID: null,
    });
  });
  
  // I'll write history checking tests later...
});
