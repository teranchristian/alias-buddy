(async function startAliasBuddy(root) {
  'use strict';

  const runtimeKey = '__aliasBuddyRuntime';

  try {
    root[runtimeKey]?.destroy?.();

    const storage = root.AliasBuddy.core.storage.createStorage(root.chrome);
    const entries = await storage.getAll();
    const adapter = root.AliasBuddy.adapters.contract.createSupported({ entries });

    if (!adapter || !adapter.start()) {
      return;
    }

    const unsubscribe = storage.subscribe(nextEntries => adapter.setEntries(nextEntries));
    root[runtimeKey] = {
      destroy() {
        unsubscribe();
        adapter.destroy();
        delete root[runtimeKey];
      }
    };
  } catch (error) {
    // Keep host-page failures isolated. Details remain local in DevTools.
    console.error('AliasBuddy could not start:', error);
  }
})(globalThis);
