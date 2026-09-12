import test from 'node:test';
import assert from 'node:assert/strict';
import { getLinkFaviconHostname } from '../shared/lib/linkFavicon.js';

test('getLinkFaviconHostname safely resolves valid website hostnames', () => {
  assert.equal(getLinkFaviconHostname('https://www.github.com/openai/codex'), 'github.com');
  assert.equal(getLinkFaviconHostname('example.com/path'), 'example.com');
});

test('getLinkFaviconHostname rejects missing, invalid, and non-web URLs', () => {
  assert.equal(getLinkFaviconHostname(''), null);
  assert.equal(getLinkFaviconHostname('not a url'), null);
  assert.equal(getLinkFaviconHostname('javascript:alert(1)'), null);
  assert.equal(getLinkFaviconHostname('file:///C:/secret.txt'), null);
});
