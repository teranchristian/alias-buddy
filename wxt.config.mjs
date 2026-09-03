import { defineConfig } from 'wxt';

const icons = {
  16: 'icon-16.png',
  32: 'icon-32.png',
  48: 'icon-48.png',
  128: 'icon-128.png'
};

// Keeps the extension ID stable across unpacked Chromium builds.
const chromiumPublicKey =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsN3Jw5q/sWy6hfq/5ScX' +
  'vZNxdPsrVR4mGx8/sZ5D/Au24GzCKGkzc3zpu7/ln2CqfXDLTRgMOIbdQhkpdsMJ' +
  'gkNhb7ixBa/vHBUDpw6mJZVW5Ep9YXkZvhAAOC+lr5Djj7Qotdz5eegkqR17p8/0' +
  'e2OM4u2Z6KtWGFSYAB+m8u4hh8MyS7it3UvgJje37K5CcECTxqsn8+kK9ltOTI16' +
  'K1YnD5dcIv+1gt6lKcKq6RLX/YtHGaiEiv98/74tHD15Ta1KoSMU1yqhj2LkSHY1' +
  'dbU1s++iqo2wMpOZ2ENgaETL08bonUoZvwmuSabKkiQgbAgWG9zsoumxt2oLP/i/' +
  'UwIDAQAB';

export default defineConfig({
  manifestVersion: 3,
  publicDir: 'icons',
  manifest: ({ browser }) => ({
    name: 'AliasBuddy',
    description: 'Use your own aliases to find real people in supported web applications.',
    permissions: ['storage'],
    host_permissions: ['https://calendar.google.com/*'],
    icons,
    action: {
      default_title: 'AliasBuddy',
      default_icon: icons
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'aliasbuddy@local.extension',
              strict_min_version: '142.0',
              data_collection_permissions: {
                required: ['none']
              }
            }
          }
        }
      : { key: chromiumPublicKey })
  })
});
