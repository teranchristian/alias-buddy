import { defineConfig } from 'wxt';

const icons = {
  16: 'icon-16.png',
  32: 'icon-32.png',
  48: 'icon-48.png',
  128: 'icon-128.png'
};

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
      : {})
  })
});
