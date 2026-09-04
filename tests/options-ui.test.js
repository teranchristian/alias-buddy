'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');

test('group member modes use two exclusive tab panels', async () => {
  const [html, css, javascript] = await Promise.all([
    readFile(resolve(root, 'entrypoints/options/index.html'), 'utf8'),
    readFile(resolve(root, 'src/options/options.css'), 'utf8'),
    readFile(resolve(root, 'src/options/options.js'), 'utf8')
  ]);

  assert.match(html, /role="tablist"/);
  assert.match(html, /id="member-individual-panel"[\s\S]*?role="tabpanel"/);
  assert.match(html, /id="member-paste-panel"[\s\S]*?role="tabpanel"[\s\S]*?hidden/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  assert.match(javascript, /memberIndividualPanel\.hidden = !isIndividual/);
  assert.match(javascript, /memberPastePanel\.hidden = isIndividual/);
});

test('settings explain the boundary between browser sync and durable backups', async () => {
  const html = await readFile(resolve(root, 'entrypoints/options/index.html'), 'utf8');

  assert.match(html, /Sync &amp; backup/);
  assert.match(html, /built-in extension sync storage/);
  assert.match(html, /Chrome\/Chromium, Edge, and Firefox use separate sync ecosystems/);
  assert.match(html, /not an uninstall-safe long-term backup/i);
  assert.match(html, /Export a JSON backup/);
});
