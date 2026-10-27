import {suite, test, assertEqual} from '../testing.js';
import {findUTM, readUTM} from '../../src/utils/utm.js';

// Fixtures are AI-generated.

suite('UTM Parser');

const page = 'https://shop.example.com/sale?utm_source=newsletter&utm_medium=email';

function request(url, requestBody) {
  return requestBody === undefined ? {url} : {url, requestBody};
}

test('readUTM reads query and fragment parameters', () => {
  assertEqual(readUTM(page), {utmSource: 'newsletter', utmMedium: 'email'});
  assertEqual(readUTM('https://example.com/#utm_campaign=fall&UTM_TERM=shoes'), {utmCampaign: 'fall', utmTerm: 'shoes'});
  assertEqual(readUTM('https://example.com/?utm_source=%20&ref=1'), null);
  assertEqual(readUTM('not a url'), null);
});

test('findUTM prefers the reported page over the referrer and the request URL', () => {
  const referrer = 'https://search.example.com/?utm_source=search';
  const url = `https://www.facebook.com/tr?id=1&utm_source=pixel&rl=${encodeURIComponent(referrer)}&dl=${encodeURIComponent(page)}`;
  assertEqual(findUTM(request(url)), {utmSource: 'newsletter', utmMedium: 'email', utmFoundIn: 'query:dl'});
});

test('findUTM falls back to the request URL and other URL fields', () => {
  assertEqual(findUTM(request('https://track.example.com/c?utm_source=ad')), {utmSource: 'ad', utmFoundIn: 'url'});
  assertEqual(findUTM(request(`https://track.example.com/c?landing=${encodeURIComponent(page)}`)).utmFoundIn, 'query:landing');
});

test('findUTM reads form data and readable request bodies', () => {
  assertEqual(findUTM(request('https://track.example.com/c', {formData: {url: [page]}})).utmFoundIn, 'formData:url');
  const batch = new TextEncoder().encode(`en=page_view\nen=scroll&dl=${encodeURIComponent(page)}`).buffer;
  assertEqual(findUTM(request('https://track.example.com/c', {raw: [{bytes: batch}]})).utmFoundIn, 'body:dl');
  const json = new TextEncoder().encode(JSON.stringify({page: {href: page}})).buffer;
  assertEqual(findUTM(request('https://track.example.com/c', {raw: [{bytes: json}]})), {utmSource: 'newsletter', utmMedium: 'email', utmFoundIn: 'body'});
  assertEqual(findUTM(request('https://track.example.com/c')), null);
});

test('readUTM reads every standard UTM parameter', () => {
  const names = ['source', 'medium', 'campaign', 'term', 'content', 'id', 'source_platform', 'creative_format', 'marketing_tactic'];
  const query = names.map((name) => `utm_${name}=${name}-value`).join('&');
  assertEqual(readUTM(`https://example.com/?${query}`), {
    utmSource: 'source-value',
    utmMedium: 'medium-value',
    utmCampaign: 'campaign-value',
    utmTerm: 'term-value',
    utmContent: 'content-value',
    utmId: 'id-value',
    utmSourcePlatform: 'source_platform-value',
    utmCreativeFormat: 'creative_format-value',
    utmMarketingTactic: 'marketing_tactic-value',
  });
});

test('readUTM decodes values, trims them and keeps the first of repeated parameters', () => {
  assertEqual(readUTM('https://example.com/?utm_source=summer+sale&utm_medium=%E2%9C%89%20mail'), {utmSource: 'summer sale', utmMedium: '✉ mail'});
  assertEqual(readUTM('https://example.com/?utm_source=%20first%20&utm_source=second'), {utmSource: 'first'});
  assertEqual(readUTM('https://example.com/?utm_source=query#utm_source=fragment&utm_medium=fragment'), {utmSource: 'query', utmMedium: 'fragment'});
});

test('readUTM accepts URL objects and ignores other schemes and plain fragments', () => {
  assertEqual(readUTM(new URL('https://example.com/?utm_source=object')), {utmSource: 'object'});
  assertEqual(readUTM('ftp://example.com/?utm_source=file'), null);
  assertEqual(readUTM('javascript:alert(1)//?utm_source=script'), null);
  assertEqual(readUTM('https://example.com/#section'), null);
  assertEqual(readUTM('https://example.com/?utm_sources=near&xutm_source=miss'), null);
});

test('findUTM checks page fields in their listed order and ignores letter case', () => {
  const other = 'https://other.example.com/?utm_source=other';
  const url = `https://track.example.com/c?url=${encodeURIComponent(other)}&DL=${encodeURIComponent(page)}`;
  assertEqual(findUTM(request(url)).utmFoundIn, 'query:DL');
});

test('findUTM skips page fields that are not URLs or have no UTM parameters', () => {
  const plain = 'https://shop.example.com/sale';
  const url = `https://track.example.com/c?u=12345&dl=${encodeURIComponent(plain)}&utm_source=request`;
  assertEqual(findUTM(request(url)), {utmSource: 'request', utmFoundIn: 'url'});
});

test('findUTM prefers the query string over form data and form data over the body', () => {
  const formPage = 'https://form.example.com/?utm_source=form';
  const bodyPage = 'https://body.example.com/?utm_source=body';
  const body = new TextEncoder().encode(`dl=${encodeURIComponent(bodyPage)}`).buffer;
  const queryFirst = findUTM(request(`https://track.example.com/c?dl=${encodeURIComponent(page)}`, {formData: {dl: [formPage]}, raw: [{bytes: body}]}));
  assertEqual(queryFirst.utmFoundIn, 'query:dl');
  const formFirst = findUTM(request('https://track.example.com/c', {formData: {other: ['x', formPage]}, raw: [{bytes: body}]}));
  assertEqual(formFirst, {utmSource: 'form', utmFoundIn: 'formData:other'});
});

test('findUTM reads later body parts and skips file and unreadable parts', () => {
  const binary = new Uint8Array([0xff, 0xfe, 0x00, 0x81]).buffer;
  const text = new TextEncoder().encode(`event=1\ndl=${encodeURIComponent(page)}`).buffer;
  const result = findUTM(request('https://track.example.com/c', {raw: [{file: '/tmp/upload'}, {bytes: binary}, {bytes: text}]}));
  assertEqual(result.utmFoundIn, 'body:dl');
  assertEqual(findUTM(request('https://track.example.com/c', {raw: [{bytes: binary}]})), null);
  assertEqual(findUTM(request('https://track.example.com/c', {error: 'Body unavailable'})), null);
});
