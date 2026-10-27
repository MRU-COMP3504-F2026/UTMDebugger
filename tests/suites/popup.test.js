import {suite, test, assertEqual} from '../testing.js';
import {database} from '../../src/utils/dbhelper.js';

// Fixtures are AI-generated.

suite('Popup');

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
