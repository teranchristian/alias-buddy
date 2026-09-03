import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packageDocument = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const targets = ['chrome-mv3', 'edge-mv3', 'firefox-mv3'];

function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function outputPath(target, path) {
  return resolve(root, '.output', target, path.replace(/^\//, ''));
}

for (const target of targets) {
  const outputRoot = resolve(root, '.output', target);
  const manifestPath = resolve(outputRoot, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const serializedManifest = JSON.stringify(manifest);

  check(manifest.manifest_version === 3, `${target}: manifest_version must be 3.`);
  check(manifest.name === 'AliasBuddy', `${target}: extension name is incorrect.`);
  check(manifest.version === packageDocument.version, `${target}: version is out of sync.`);
  check(manifest.permissions.includes('storage'), `${target}: storage permission is required.`);
  check(!manifest.permissions.includes('tabs'), `${target}: tabs permission is unnecessary.`);
  check(
    manifest.host_permissions.length === 1 &&
      manifest.host_permissions[0] === 'https://calendar.google.com/*',
    `${target}: host access must be limited to Google Calendar.`
  );
  check(!serializedManifest.includes('<all_urls>'), `${target}: broad host access is forbidden.`);
  check(manifest.action.default_popup === 'popup.html', `${target}: popup entrypoint is missing.`);
  check(manifest.options_ui.page === 'options.html', `${target}: options entrypoint is missing.`);
  check(manifest.options_ui.open_in_tab === true, `${target}: options must open in a tab.`);
  check(manifest.content_scripts.length === 1, `${target}: expected one content script.`);

  if (target === 'firefox-mv3') {
    const gecko = manifest.browser_specific_settings?.gecko;
    check(Boolean(gecko?.id), `${target}: a stable Firefox extension ID is required.`);
    check(
      gecko?.data_collection_permissions?.required?.length === 1 &&
        gecko.data_collection_permissions.required[0] === 'none',
      `${target}: Firefox must declare that AliasBuddy collects no data.`
    );
  } else {
    check(!manifest.browser_specific_settings, `${target}: Firefox-only settings leaked into this build.`);
  }

  const contentFiles = manifest.content_scripts.flatMap(script => [
    ...(script.css || []),
    ...(script.js || [])
  ]);
  const referencedFiles = [
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...contentFiles
  ];

  await Promise.all(referencedFiles.map(file => access(outputPath(target, file))));

  for (const htmlPath of [manifest.action.default_popup, manifest.options_ui.page]) {
    const html = await readFile(outputPath(target, htmlPath), 'utf8');
    check(!/<script[^>]+src=["']https?:/i.test(html), `${target}/${htmlPath} contains a remote script.`);
    check(!/<script(?![^>]+src=)[^>]*>/i.test(html), `${target}/${htmlPath} contains inline JavaScript.`);

    const localScripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
      .map(match => match[1]);
    await Promise.all(localScripts.map(script => {
      const resolvedScript = script.startsWith('/')
        ? outputPath(target, script)
        : resolve(outputRoot, dirname(htmlPath), script);
      return access(resolvedScript);
    }));
  }

  console.log(`Validated ${target}: ${referencedFiles.length} referenced files found.`);
}
