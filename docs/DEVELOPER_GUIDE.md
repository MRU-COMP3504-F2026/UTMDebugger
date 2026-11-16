# UTM Debugger Developer Guide

This guide is for people who want to contribute to UTM Debugger.
To install and use the extension, see the [user manual](USER_MANUAL.md). Design decisions, architecture, and the full test plan are in the [living document][living document] and are linked here instead of repeated.

- [Get the source code](#get-the-source-code)
- [Directory layout](#directory-layout)
- [Build](#build)
- [Test](#test)
- [Add a new test](#add-a-new-test)
- [Add a tracker](#add-a-tracker)
- [Contribute](#contribute)
- [Build a release](#build-a-release)

## Get the source code

Everything is in one repository. There are no submodules.

```bash
git clone https://github.com/MRU-COMP3504-F2026/UTMDebugger.git
```

```bash
cd UTMDebugger
```

To check out a specific release:

```bash
git checkout v1.0.0-beta
```

Prerequisites (Node.js 22.12 or later, npm 10 or later, Chrome) are listed in the [user manual](USER_MANUAL.md#prerequisites).

## Directory layout

| Path | Contents |
| --- | --- |
| `manifest.json` | Chrome extension manifest (Manifest V3). Points to the built files in `dist/`. |
| `package.json`, `package-lock.json` | npm scripts and development dependencies. |
| `vite.config.js` | Build configuration. Entry points are `src/background.js` and `src/popup.html`. |
| `src/background.js` | Service worker. Listens to every web request, keeps the tracking ones and saves them to the database. Switches the toolbar icon. |
| `src/popup.html`, `src/popup.js`, `src/popup.css` | UI: Status, Errors, Blocking and Settings tabs. Tailwind CSS is used through `popup.css`. |
| `src/database/schema.js` | IndexedDB name, version, object stores and indexes. |
| `src/database/defaults.js` | Default tracking domains (one per provider) and default settings, added when the database is first created. |
| `src/database/validation.js` | Checks records before they are written. |
| `src/database/manager.js` | `Database` class: open, close, CRUD, request history and settings. |
| `src/utils/dbhelper.js` | The single shared `Database` instance used by the extension. |
| `src/utils/extractors.js` | One extractor function per provider. Reads provider-specific fields (user ID, pixel ID) from a request. |
| `src/utils/utm.js` | Shared UTM parser used for every provider. |
| `src/utils/page.js` | Finds the page a request was sent from. |
| `src/utils/logger.js` | Labelled console logger. |
| `public/` | Static files copied into `dist/` unchanged (logo, toolbar icons). |
| `tests/testing.js` | The test framework: `suite`, `test`, and assertions. |
| `tests/index.js` | List of test files to run. |
| `tests/index.html` | Test page that loads `index.js`. |
| `tests/run.mjs` | Test harness: Starts Vite, opens the test page in headless Chromium with Playwright, and sets the exit code. |
| `tests/suites/` | Test files, one per source file. |
| `docs/` | User manual and this developer guide. |
| `reports/` | Weekly team status reports, named `YYYYMMDD.md`. |
| `.github/workflows/ci.yml` | GitHub Actions CI workflow. |
| `.github/ISSUE_TEMPLATE/` | Bug report template. |
| `.github/pull_request_template.md` | Pull request checklist. |
| `dist/` | Build output. |

How the software fits together is described under *Software Architecture* and *Software Design* in the [living document][living document].

1. `background.js` receives every request through `chrome.webRequest.onBeforeRequest`.
2. `Database.findTrackingDomain()` matches the request against the tracking domains in `defaults.js` and returns the provider's extractor name.
3. The extractor in `extractors.js` returns provider fields. `findUTM()` in `utm.js` reads the UTM values. Both are saved as one request record.
4. `popup.js` reads the request history for the current page and compares each provider's latest request with the page's UTM values.

## Build

| Command | What it does |
| --- | --- |
| `npm ci` | Installs the exact dependency versions from `package-lock.json`. Run after cloning and whenever `package-lock.json` changes. |
| `npm run build` | Builds `src/` into `dist/` with Vite. |
| `npm run dev` | Rebuilds `dist/` on every file change. Reload the extension in `chrome://extensions` to pick up changes. |

After building, load the repository folder in Chrome as described in the [user manual](USER_MANUAL.md#install).

## Test

Tests run in a real browser page, so IndexedDB and other browser APIs are the real ones.
The framework and the reasons for choosing it are described under *Test Plan & Bugs* in the [living document][living document].

Run every test from the command line:

1. Install dependencies:
   
   ```bash
   npm ci
   ```
   
2. Install the Chromium browser for Playwright (once per machine):
   
   ```bash
   npx playwright install chromium
   ```
   
3. Run the tests:
   
   ```bash
   npm test
   ```
   
The last line reads `N passed, 0 failed`.
The command exits with code 1 when a test fails, a test file fails to load, or no tests ran.

### Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` on every push to any branch, on every pull request into `main`, and on demand from the **Actions** tab.
It runs `npm ci`, installs Chromium, then `npm run build` and `npm test` on Ubuntu with Node.js 22.
A pull request must pass CI before it is merged.

## Add a new test

| Rule | Convention |
| --- | --- |
| File location | `tests/suites/` |
| File name | `<area>.test.js`, where `<area>` is the source file name. `src/utils/utm.js` is tested by `tests/suites/utm.test.js`. Provider extractors use the provider name, for example `meta-pixel.test.js`. |
| Structure | One `suite(...)` per file containing `test(...)` calls. Always give both a label. |
| Registration | Add the file path to the list in `tests/index.js`. Unlisted files do not run. |
| Test names | Describe the behaviour in plain words, for example `'findUTM prefers the query string over form data'`. |
| Database | Use a separate test database name, for example `new Database('UTMDebuggerTest')`, and clear it in each test so tests do not depend on each other. |
| Fixtures | Keep request fixtures small and in the test file. |

Example:

```js
import {assertEqual, suite, test} from '../testing.js';
import {readUTM} from '../../src/utils/utm.js';

suite('UTM Parser', () => {
  test('reads utm_source from the query string', () => {
    assertEqual(readUTM('https://a.com/?utm_source=news'), {utmSource: 'news'});
  });
});
```

Then register it in `tests/index.js`:

```js
runTests([
  './suites/database.test.js',
  './suites/utm.test.js',
]);
```

Functions available from `tests/testing.js`:

| Function | Behavior |
| --- | --- |
| `suite(label, defineTests)` | Groups the tests defined inside `defineTests`. |
| `test(name, run)` | Defines a test. `run` may be `async`. A test fails if it throws or rejects. |
| `expect(condition, message)` | Records a failure and keeps running the test. |
| `require(value, message)` | Fails the test if `value` is `false`, `null` or `undefined`. Otherwise returns `value`. |
| `assert(condition, message)` | Fails the test if `condition` is false. |
| `assertEqual(actual, expected)` | Fails unless the values are deeply equal. Object key order does not matter. |
| `assertRejects(run, ErrorType)` | Fails unless `run` throws or rejects with an `ErrorType`. |

## Build a release

Releases are Git tags on `main`. Steps that are not automated:

1. Make sure every pull request for the release is merged and CI is green on `main`.
2. Update the version everywhere it appears:

   | File | Field | Format |
   | --- | --- | --- |
   | `package.json` | `version` | Semantic version, e.g. `1.0.0` |
   | `manifest.json` | `version` | Uses up to minor `1.0` |
   | `src/popup.html` | footer text | `v1.0.0` |
   | `README.md` | *Current release* table | Tag name and notes |
   | `docs/USER_MANUAL.md`, `docs/DEVELOPER_GUIDE.md` | Tag links | Tag name |

3. Update [Known bugs and limitations](USER_MANUAL.md#known-bugs-and-limitations) and mark finished features as no longer WIP.
4. Commit through a pull request, then update your local `main`.
5. Run a clean build and the tests:

   ```bash
   rm -rf node_modules dist
   ```

   ```bash
   npm ci
   ```

   ```bash
   npm run build
   ```

   ```bash
   npm test
   ```

6. Sanity check in Chrome:
   - Remove the extension, then **Load unpacked** again so the database is
     created fresh.
   - Open `https://www.shanehomes.com/?utm_source=google&utm_medium=cpc&utm_campaign=test` and open the popup. Trackers the site uses show Healthy or Error, the others Not detected.
   - Switch between all four tabs.
   - Check the service worker console has no errors.
   - Check the popup footer shows the new version.
7. Tag the release and push the tag:

   ```bash
   git tag -a v1.0.0-beta -m "Beta release"
   ```

   ```bash
   git push origin v1.0.0-beta
   ```

8. On GitHub, open **Releases > Draft a new release**, choose the tag, list the changes and known bugs, and attach a ZIP of the repository folder with `dist/` included so users can load it without building.

[living document]: https://drive.google.com/drive/folders/1e1vB8FgEADZmQ7_LU2bbv6SzU05HoB7D
