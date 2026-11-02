import {runTests} from './testing.js';

runTests([
  './suites/database.test.js',
  './suites/background.test.js',
  './suites/utm.test.js',
  './suites/popup.test.js',
  './suites/meta-pixel-extractor.test.js',
]);
