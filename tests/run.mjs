import {chromium} from 'playwright';
import {createServer} from 'vite';

const server = await createServer({
  logLevel: 'error',
  server: {
    port: 0,
    strictPort: false,
    forwardConsole: false
  }
});
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(message.text()));
  page.on('pageerror', (error) => console.error(`Page error: ${error.message}`));
  await page.goto(new URL('tests/index.html', server.resolvedUrls.local[0]).href);
  const results = await (await page.waitForFunction(() =>
      globalThis.testResults,
      null,
      {timeout: 60000}
  )).jsonValue();
  if (results.failed > 0 || results.passed === 0) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
