import {suite, test, assertEqual} from '../testing.js';
import {database} from '../../src/utils/dbhelper.js';

// Fixtures are AI-generated.

suite('Popup', () => {
  test('renders tracker groups without extension APIs', async () => {
    const trackerList = document.createElement('div');
    trackerList.id = 'tracker-list';
    trackerList.hidden = true;
    document.body.append(trackerList);
    await import('../../src/popup.js');
    const groupCount = trackerList.querySelectorAll('.tracker-group').length;
    assertEqual(groupCount, 3);
    const trackingDomains = await database.list('trackingDomains');
    const providerCount = new Set(trackingDomains.map((trackingDomain) => trackingDomain.providerName)).size;
    const cardCount = trackerList.querySelectorAll('.tracker-card').length;
    assertEqual(cardCount, providerCount);
    trackerList.remove();
  });

  test('a tracker that never fired is not detected', async () => {
    const {trackerState} = await import('../../src/popup.js');
    const state = trackerState('Google Analytics', [], {utmSource: 'newsletter'});
    assertEqual(state.status, 'Missing');
  });

  test('a tracker reporting the page UTM values is healthy', async () => {
    const {trackerState} = await import('../../src/popup.js');
    const requests = [{utmSource: 'newsletter', utmMedium: 'email', utmCampaign: 'fall'}];
    const state = trackerState('Google Analytics', requests, {utmSource: 'newsletter', utmMedium: 'email'});
    assertEqual(state.status, 'Healthy');
    assertEqual(state.description, 'Reported utm_source=newsletter, utm_medium=email, utm_campaign=fall');
  });

  test('a tracker missing or changing page UTM values is an error, judged by its latest request', async () => {
    const {trackerState} = await import('../../src/popup.js');
    const pageUTM = {utmSource: 'newsletter', utmMedium: 'email'};
    const requests = [{utmSource: 'newsletter', utmMedium: null}, {utmSource: 'newsletter', utmMedium: 'email'}];
    const state = trackerState('Meta Pixel', requests, pageUTM);
    assertEqual(state.status, 'Error');
    assertEqual(state.description, 'Expected utm_medium=email, reported utm_source=newsletter');
    const empty = trackerState('Meta Pixel', [{utmSource: null, utmMedium: null}], pageUTM);
    assertEqual(empty.description, 'Expected utm_source=newsletter, utm_medium=email, reported no UTM values');
  });

  test('without page UTM values a firing tracker is healthy', async () => {
    const {trackerState} = await import('../../src/popup.js');
    const state = trackerState('Microsoft Clarity', [{utmSource: null}], null);
    assertEqual(state, {name: 'Microsoft Clarity', description: 'Reported no UTM values', status: 'Healthy'});
  });
});

test('navigation switches pages', async () => {
  const fixture = document.createElement('div');
  fixture.innerHTML = `
    <div id="tracker-list"></div>
    <button class="nav-button" data-target="details"></button>
    <section class="page" id="home"></section>
    <section class="page" id="details" hidden></section>`;
  document.body.append(fixture);
  await import('../../src/popup.js?test=simple-nav');
  fixture.querySelector('button').click();
  assertEqual(fixture.querySelector('#home').hidden, true);
  assertEqual(fixture.querySelector('#details').hidden, false);
  fixture.remove();
});

test('places an absent tracker under Not Detected', async () => {
  const fixture = document.createElement('div');
  fixture.id = 'tracker-list';
  document.body.append(fixture);
  const originalList = database.list;
  const originalHistory = database.getRequestHistory;
  database.list = async () => [{ providerName: 'Absent' }];
  database.getRequestHistory = async () => ({});
  await import('../../src/popup.js?test=simple-group');
  const card = fixture.querySelector('.tracker-card');
  assertEqual(card.querySelector('h3').textContent, 'Absent');
  assertEqual(
    card.closest('.tracker-group').querySelector('.group-header').textContent,
    'Not Detected'
  );
  database.list = originalList;
  database.getRequestHistory = originalHistory;
  fixture.remove();
});

test('displays the page hostname', async () => {
  const fixture = document.createElement('div');
  fixture.innerHTML = '<span class="domain"></span><div id="tracker-list"></div>';
  document.body.append(fixture);
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: { id: 'test', connect() {} },
    tabs: { query: async () => [{ url: 'https://example.com/shop' }] }
  };
  await import('../../src/popup.js?test=simple-domain');
  assertEqual(fixture.querySelector('.domain').textContent, 'example.com');
  globalThis.chrome = originalChrome;
  fixture.remove();
});