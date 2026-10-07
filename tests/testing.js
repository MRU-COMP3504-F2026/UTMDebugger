const tests = [];
let currentLabel = '';

export function suite(label, defineTests) {
  currentLabel = label;
  if (defineTests) {
    defineTests();
  }
}

export function test(name, run) {
  tests.push({name, run, label: currentLabel});
}

export function assert(condition, message = 'assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected) {
  const actualText = stringify(actual);
  const expectedText = stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`expected ${expectedText}, got ${actualText}`);
  }
}

export async function assertRejects(run, ErrorType = Error) {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof ErrorType)) {
      throw new Error(`expected ${ErrorType.name}, got ${error}`);
    }
    return;
  }
  throw new Error(`expected ${ErrorType.name}, but nothing was thrown`);
}

export async function runTests(files) {
  const summary = document.createElement('p');
  summary.textContent = 'Running...';
  document.body.append(summary);

  for (const file of files) {
    currentLabel = file;
    try {
      await import(/* @vite-ignore */ file);
    } catch (error) {
      test(`${file} could not be loaded`, () => {
        throw error;
      });
    }
  }

  let list = null;
  let listLabel = '';
  let passed = 0;
  let failed = 0;

  for (const {name, run, label} of tests) {
    if (list === null || label !== listLabel) {
      if (label) {
        const heading = document.createElement('h2');
        heading.textContent = label;
        document.body.append(heading);
        console.log(label);
      }
      list = document.createElement('ul');
      document.body.append(list);
      listLabel = label;
    }
    const item = document.createElement('li');
    try {
      await run();
      passed++;
      item.textContent = `PASS: ${name}`;
      console.log(item.textContent);
    } catch (error) {
      failed++;
      const reason = (error && error.message) || String(error);
      item.textContent = `FAIL: ${name} (${reason})`;
      console.error(item.textContent);
    }
    list.append(item);
  }

  summary.textContent = `${passed} passed, ${failed} failed`;
  console.log(summary.textContent);
}

function stringify(value) {
  return JSON.stringify(value, (key, item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return item;
    }
    const sorted = {};
    for (const itemKey of Object.keys(item).sort()) {
      sorted[itemKey] = item[itemKey];
    }
    return sorted;
  });
}
