import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

check(manifest.manifest_version === 3, 'manifest_version must be 3.');
check(manifest.permissions.includes('storage'), 'The storage permission is required.');
check(!manifest.permissions.includes('tabs'), 'The tabs permission is unnecessary.');
check(
  JSON.stringify(manifest).includes('https://calendar.google.com/*'),
  'Calendar host access is missing.'
);
check(!JSON.stringify(manifest).includes('<all_urls>'), 'Broad <all_urls> access is forbidden.');

const referencedFiles = [
  manifest.action.default_popup,
  manifest.options_ui.page,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap(script => [...(script.css || []), ...(script.js || [])])
];

await Promise.all(referencedFiles.map(file => access(resolve(root, file))));

for (const htmlPath of [manifest.action.default_popup, manifest.options_ui.page]) {
  const html = await readFile(resolve(root, htmlPath), 'utf8');
  check(!/<script[^>]+src=["']https?:/i.test(html), `${htmlPath} contains a remote script.`);
  check(!/<script(?![^>]+src=)[^>]*>/i.test(html), `${htmlPath} contains inline JavaScript.`);
}

console.log(`Validated AliasBuddy ${manifest.version}: ${referencedFiles.length} referenced files found.`);
