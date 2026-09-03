(function initialiseAliasBuddyContent(root) {
  'use strict';

  const runtimeKey = '__aliasBuddyRuntime';

  async function start() {
    try {
      root[runtimeKey]?.destroy?.();

      const storage = root.AliasBuddy.core.storage.createStorage();
      const entries = await storage.getAll();
      const adapter = root.AliasBuddy.adapters.contract.createSupported({ entries });

      if (!adapter || !adapter.start()) {
        return false;
      }

      const unsubscribe = storage.subscribe(nextEntries => adapter.setEntries(nextEntries));
      root[runtimeKey] = {
        destroy() {
          unsubscribe();
          adapter.destroy();
          delete root[runtimeKey];
        }
      };

      return true;
    } catch (error) {
      // Keep host-page failures isolated. Details remain local in DevTools.
      console.error('AliasBuddy could not start:', error);
      return false;
    }
  }

  const api = Object.freeze({ start });

  root.AliasBuddy = root.AliasBuddy || {};
  root.AliasBuddy.content = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
