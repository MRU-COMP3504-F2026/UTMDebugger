import {suite, test, assertEqual, assertRejects} from './testing.js';
import {Database} from '../src/database/manager.js';

suite('Database');

const TEST_DATABASE_NAME = 'UTMDebuggerTest';

function makeRequest(requestId, tabId) {
  return {
    requestId: requestId,
    url: 'https://www.example.com',
    method: 'GET',
    timeStamp: Date.now(),
    tabId: tabId,
  };
}

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(TEST_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function createTestFixture() {
  await deleteTestDatabase();
  const database = new Database(TEST_DATABASE_NAME);
  await database.saveRequest(makeRequest('100', 1));
  await database.saveRequest(makeRequest('101', 1));
  await database.saveRequest(makeRequest('101', 2));
  return database;
}

test('saveRequest returns the new database id', async () => {
  const database = await createTestFixture();
  const saved = await database.saveRequest(makeRequest('102', 3));
  assertEqual(saved.id, 4);
});

test('getRequest returns the saved request', async () => {
  const database = await createTestFixture();
  const saved = await database.saveRequest(makeRequest('102', 3));
  assertEqual(await database.getRequest(saved.id), saved);
});

test('getRequest returns undefined for a missing id', async () => {
  const database = await createTestFixture();
  assertEqual(await database.getRequest(9999), undefined);
});

test('listRequests returns every request in the order saved', async () => {
  const database = await createTestFixture();
  const requests = await database.listRequests();
  assertEqual(requests.map((request) => request.id), [1, 2, 3]);
});

test('listRequests filters by tabId', async () => {
  const database = await createTestFixture();
  const requests = await database.listRequests({tabId: 1});
  assertEqual(requests.map((request) => request.requestId), ['100', '101']);
});

test('listRequests filters by requestId', async () => {
  const database = await createTestFixture();
  const requests = await database.listRequests({requestId: '101'});
  assertEqual(requests.map((request) => request.tabId), [1, 2]);
});

test('listRequests uses both filters together', async () => {
  const database = await createTestFixture();
  const requests = await database.listRequests({requestId: '101', tabId: 2});
  assertEqual(requests.map((request) => request.id), [3]);
});

test('saveRequest rejects an invalid url', async () => {
  const database = await createTestFixture();
  const request = {...makeRequest('102', 1), url: 'not a url'};
  await assertRejects(() => database.saveRequest(request), TypeError);
  assertEqual((await database.listRequests()).length, 3);
});

test('requests are still saved after closing and reopening', async () => {
  const database = await createTestFixture();
  await database.close();
  const reopened = new Database(TEST_DATABASE_NAME);
  assertEqual((await reopened.listRequests()).length, 3);
});
