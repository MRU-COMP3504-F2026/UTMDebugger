import {suite, test, assertEqual} from '../testing.js';
import {database} from '../../src/utils/dbhelper.js';

// Fixtures are AI-generated.

suite('Background Listener', () => {
  let listener;

  async function background() {
    if (listener) return listener;
    globalThis.chrome = {
      webRequest: {onBeforeRequest: {addListener(callback) { listener = callback; }}},
      runtime: {onConnect: {addListener() {}}},
      action: {setIcon() {}},
      tabs: {
        async get(tabId) {
          if (tabId !== 7) throw new Error(`No tab with id: ${tabId}.`);
          return {url: 'https://shop.example.com/?utm_source=news'};
        },
      },
    };
    await import('../../src/background.js');
    return listener;
  }

  function request(url, overrides = {}) {
    return {
      requestId: crypto.randomUUID(),
      url: url,
      method: 'POST',
      timeStamp: Date.now(),
      tabId: 7,
      frameId: 0,
      type: 'xmlhttprequest',
      initiator: 'https://shop.example.com',
      ...overrides,
    };
  }

  async function capturedRequests(...requests) {
    const handle = await background();
    await database.clearRequestHistory();
    try {
      for (const details of requests) await handle(details);
      return await database.listRequests();
    } finally {
      await database.clearRequestHistory();
    }
  }

  test('saves a tracking request with the page it came from', async () => {
    const details = request('https://region1.analytics.google.com/g/collect?v=2');
    const requests = await capturedRequests(details);
    assertEqual(requests.length, 1);
    assertEqual(requests[0].requestId, details.requestId);
    assertEqual(requests[0].hostname, 'region1.analytics.google.com');
    assertEqual(requests[0].pageURL, 'https://shop.example.com/?utm_source=news');
    assertEqual(requests[0].initiator, 'https://shop.example.com');
  });

  test('saves the UTM parameters of the page the provider reports', async () => {
    const page = 'https://shop.example.com/sale?utm_source=newsletter&utm_medium=email&utm_campaign=fall';
    const details = request(`https://region1.analytics.google.com/g/collect?v=2&dl=${encodeURIComponent(page)}`);
    const requests = await capturedRequests(details);
    assertEqual(requests[0].utmSource, 'newsletter');
    assertEqual(requests[0].utmMedium, 'email');
    assertEqual(requests[0].utmCampaign, 'fall');
    assertEqual(requests[0].utmFoundIn, 'query:dl');
  });

  test('ignores excluded and unknown requests', async () => {
    const requests = await capturedRequests(
      request('https://analytics.google.com/script.js'),
      request('https://www.example.com/collect'));
    assertEqual(requests.length, 0);
  });

  test('uses the navigation URL as the page and stores no page without a tab', async () => {
    const navigation = request('https://www.facebook.com/tr?id=1', {type: 'main_frame'});
    const background = request('https://clarity.ms/collect', {tabId: -1});
    const requests = await capturedRequests(navigation, background);
    assertEqual(requests.map((saved) => saved.pageURL), [navigation.url, null]);
  });
});
