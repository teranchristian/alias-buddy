(function initialiseAliasStorage(root) {
  'use strict';

  const aliasModel = root.AliasBuddy?.core?.aliases;
  const STORAGE_KEY = 'aliasBuddyData';
  const STORAGE_VERSION = 1;
  const SYNC_META_KEY = 'aliasBuddySyncMeta';
  const SYNC_ENTRY_PREFIX = 'aliasBuddySyncEntry:';
  const SYNC_VERSION = 1;
  const SYNC_MIGRATION_KEY = 'aliasBuddySyncMigration';
  const SYNC_MIGRATION_VERSION = 1;
  const DEFAULT_SYNC_QUOTA_BYTES = 102400;

  function requireAliasModel() {
    if (!aliasModel) {
      throw new Error('AliasBuddy alias model must load before storage.');
    }
  }

  function getExtensionApi(explicitApi) {
    if (explicitApi) {
      return explicitApi;
    }

    if (root.browser?.runtime?.id) {
      return root.browser;
    }

    return root.chrome;
  }

  function createGeneration() {
    if (root.crypto?.randomUUID) {
      return root.crypto.randomUUID();
    }

    return `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function syncEntryKey(id) {
    return `${SYNC_ENTRY_PREFIX}${encodeURIComponent(String(id))}`;
  }

  function createStorage(api) {
    requireAliasModel();
    const extensionApi = getExtensionApi(api);
    const localArea = extensionApi?.storage?.local;
    const syncArea = extensionApi?.storage?.sync;

    if (!localArea || !extensionApi.storage.onChanged) {
      throw new Error('The browser storage API is unavailable.');
    }

    let initialisePromise = null;
    let activeGeneration = null;
    let lastSyncError = null;
    let syncRefreshPromise = Promise.resolve();

    async function readLocalDocument() {
      const result = await localArea.get(STORAGE_KEY);
      const stored = result?.[STORAGE_KEY];

      if (!stored || stored.version !== STORAGE_VERSION || !Array.isArray(stored.entries)) {
        return { version: STORAGE_VERSION, entries: [] };
      }

      return {
        version: STORAGE_VERSION,
        entries: aliasModel.sortEntries(stored.entries.map(aliasModel.normalizeEntry))
      };
    }

    async function writeLocalEntries(entries) {
      const normalized = aliasModel.sortEntries(entries.map(aliasModel.normalizeEntry));
      const current = await readLocalDocument();

      if (JSON.stringify(current.entries) === JSON.stringify(normalized)) {
        return normalized;
      }

      await localArea.set({
        [STORAGE_KEY]: { version: STORAGE_VERSION, entries: normalized }
      });
      return normalized;
    }

    async function readMigrationState() {
      const result = await localArea.get(SYNC_MIGRATION_KEY);
      return result?.[SYNC_MIGRATION_KEY];
    }

    async function markMigrated() {
      await localArea.set({
        [SYNC_MIGRATION_KEY]: {
          version: SYNC_MIGRATION_VERSION,
          migratedAt: new Date().toISOString()
        }
      });
    }

    function validateEntryList(entries) {
      const validated = [];
      const ids = new Set();

      for (const candidate of entries) {
        const normalized = aliasModel.normalizeEntry(candidate);
        if (ids.has(normalized.id)) {
          continue;
        }

        const validation = aliasModel.validateEntry(normalized, validated);
        if (!validation.valid) {
          continue;
        }

        ids.add(validation.entry.id);
        validated.push(validation.entry);
      }

      return aliasModel.sortEntries(validated);
    }

    async function readSyncSnapshot() {
      if (!syncArea) {
        return { hasMeta: false, entries: [] };
      }

      const values = await syncArea.get(null);
      const meta = values?.[SYNC_META_KEY];

      if (!meta || meta.version !== SYNC_VERSION || !meta.generation) {
        return { hasMeta: false, entries: [] };
      }

      activeGeneration = meta.generation;
      const entries = Object.entries(values)
        .filter(([key, value]) => (
          key.startsWith(SYNC_ENTRY_PREFIX)
          && value?.version === SYNC_VERSION
          && value?.generation === meta.generation
          && value?.entry
        ))
        .map(([, value]) => value.entry);

      return {
        hasMeta: true,
        meta,
        entries: validateEntryList(entries)
      };
    }

    function makeMeta(generation = activeGeneration || createGeneration()) {
      return {
        version: SYNC_VERSION,
        generation,
        updatedAt: new Date().toISOString()
      };
    }

    async function writeSyncDataset(entries) {
      if (!syncArea) {
        return false;
      }

      const normalized = validateEntryList(entries);
      const generation = createGeneration();
      activeGeneration = generation;
      const meta = makeMeta(generation);
      const update = { [SYNC_META_KEY]: meta };

      for (const entry of normalized) {
        update[syncEntryKey(entry.id)] = {
          version: SYNC_VERSION,
          generation,
          updatedAt: meta.updatedAt,
          entry
        };
      }

      const current = await syncArea.get(null);
      const staleKeys = Object.keys(current || {}).filter(key => (
        key.startsWith(SYNC_ENTRY_PREFIX) && !Object.hasOwn(update, key)
      ));

      await syncArea.set(update);
      if (staleKeys.length) {
        await syncArea.remove(staleKeys);
      }

      lastSyncError = null;
      return true;
    }

    async function writeSyncEntry(entry) {
      if (!syncArea) {
        return false;
      }

      const generation = activeGeneration || createGeneration();
      activeGeneration = generation;
      const meta = makeMeta(generation);

      await syncArea.set({
        [SYNC_META_KEY]: meta,
        [syncEntryKey(entry.id)]: {
          version: SYNC_VERSION,
          generation,
          updatedAt: meta.updatedAt,
          entry: aliasModel.normalizeEntry(entry)
        }
      });

      lastSyncError = null;
      return true;
    }

    async function removeSyncEntry(id) {
      if (!syncArea) {
        return false;
      }

      const generation = activeGeneration || createGeneration();
      activeGeneration = generation;
      await syncArea.remove(syncEntryKey(id));
      await syncArea.set({ [SYNC_META_KEY]: makeMeta(generation) });
      lastSyncError = null;
      return true;
    }

    function rememberSyncError(error) {
      lastSyncError = error instanceof Error
        ? error
        : new Error(String(error || 'Browser sync failed.'));
    }

    async function safelySync(action) {
      if (!syncArea) {
        return false;
      }

      try {
        await action();
        return true;
      } catch (error) {
        rememberSyncError(error);
        return false;
      }
    }

    function mergeLegacyLocalEntries(syncEntries, localEntries) {
      const merged = [...syncEntries];
      const ids = new Set(merged.map(entry => entry.id));
      const nicknames = new Set(
        merged.map(entry => aliasModel.normalizeNickname(entry.nickname))
      );

      for (const entry of localEntries) {
        const normalized = aliasModel.normalizeEntry(entry);
        const nickname = aliasModel.normalizeNickname(normalized.nickname);

        if (ids.has(normalized.id) || nicknames.has(nickname)) {
          continue;
        }

        const validation = aliasModel.validateEntry(normalized, merged);
        if (!validation.valid) {
          continue;
        }

        merged.push(validation.entry);
        ids.add(validation.entry.id);
        nicknames.add(nickname);
      }

      return aliasModel.sortEntries(merged);
    }

    async function initialiseSync() {
      if (!syncArea) {
        return;
      }

      try {
        const [localDocument, migration, snapshot] = await Promise.all([
          readLocalDocument(),
          readMigrationState(),
          readSyncSnapshot()
        ]);
        const migrated = migration?.version === SYNC_MIGRATION_VERSION;

        if (!snapshot.hasMeta) {
          await writeSyncDataset(localDocument.entries);
          await markMigrated();
          return;
        }

        if (!migrated) {
          const merged = mergeLegacyLocalEntries(snapshot.entries, localDocument.entries);
          await writeLocalEntries(merged);
          await writeSyncDataset(merged);
          await markMigrated();
          return;
        }

        await writeLocalEntries(snapshot.entries);
        lastSyncError = null;
      } catch (error) {
        rememberSyncError(error);
      }
    }

    function ensureInitialised() {
      if (!initialisePromise) {
        initialisePromise = initialiseSync();
      }
      return initialisePromise;
    }

    async function refreshFromSync() {
      await ensureInitialised();
      if (!syncArea) {
        return;
      }

      try {
        const snapshot = await readSyncSnapshot();

        if (!snapshot.hasMeta) {
          const localDocument = await readLocalDocument();
          await writeSyncDataset(localDocument.entries);
          await markMigrated();
          return;
        }

        await writeLocalEntries(snapshot.entries);
        lastSyncError = null;
      } catch (error) {
        rememberSyncError(error);
      }
    }

    async function getAll() {
      await ensureInitialised();
      const document = await readLocalDocument();
      return aliasModel.sortEntries(document.entries);
    }

    async function getById(id) {
      const entries = await getAll();
      return entries.find(entry => entry.id === String(id)) || null;
    }

    async function upsert(entry) {
      await ensureInitialised();
      const entries = await getAll();
      const validation = aliasModel.validateEntry(entry, entries);

      if (!validation.valid) {
        throw new aliasModel.AliasValidationError(validation.errors);
      }

      const index = entries.findIndex(candidate => candidate.id === validation.entry.id);
      if (index >= 0) {
        entries[index] = validation.entry;
      } else {
        entries.push(validation.entry);
      }

      await writeLocalEntries(entries);
      await safelySync(() => writeSyncEntry(validation.entry));
      return validation.entry;
    }

    async function remove(id) {
      await ensureInitialised();
      const entries = await getAll();
      const nextEntries = entries.filter(entry => entry.id !== String(id));

      if (entries.length === nextEntries.length) {
        return false;
      }

      await writeLocalEntries(nextEntries);
      await safelySync(() => removeSyncEntry(id));
      return true;
    }

    async function replaceAll(nextEntries) {
      await ensureInitialised();
      const validatedEntries = [];
      const entryIds = new Set();

      for (const candidate of nextEntries) {
        const validation = aliasModel.validateEntry(candidate, validatedEntries);
        if (!validation.valid || entryIds.has(validation.entry.id)) {
          const errors = entryIds.has(validation.entry.id)
            ? { id: 'Every entry must have a unique ID.' }
            : validation.errors;
          throw new aliasModel.AliasValidationError(errors);
        }

        entryIds.add(validation.entry.id);
        validatedEntries.push(validation.entry);
      }

      const normalized = await writeLocalEntries(validatedEntries);
      await safelySync(() => writeSyncDataset(normalized));
      return normalized;
    }

    async function getSyncStatus() {
      await ensureInitialised();

      if (!syncArea) {
        return {
          available: false,
          bytesInUse: null,
          quotaBytes: null,
          lastError: null
        };
      }

      let bytesInUse = null;
      try {
        if (typeof syncArea.getBytesInUse === 'function') {
          bytesInUse = await syncArea.getBytesInUse(null);
        }
      } catch (error) {
        rememberSyncError(error);
      }

      return {
        available: true,
        bytesInUse,
        quotaBytes: Number(syncArea.QUOTA_BYTES) || DEFAULT_SYNC_QUOTA_BYTES,
        lastError: lastSyncError?.message || null
      };
    }

    function subscribe(listener) {
      const handleChange = (changes, areaName) => {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
          const nextValue = changes[STORAGE_KEY].newValue;
          const entries = Array.isArray(nextValue?.entries)
            ? aliasModel.sortEntries(nextValue.entries.map(aliasModel.normalizeEntry))
            : [];
          listener(entries);
          return;
        }

        if (areaName !== 'sync' || !syncArea) {
          return;
        }

        const relevant = Object.keys(changes).some(key => (
          key === SYNC_META_KEY || key.startsWith(SYNC_ENTRY_PREFIX)
        ));
        if (!relevant) {
          return;
        }

        syncRefreshPromise = syncRefreshPromise
          .then(refreshFromSync)
          .catch(rememberSyncError);
      };

      extensionApi.storage.onChanged.addListener(handleChange);
      return () => extensionApi.storage.onChanged.removeListener(handleChange);
    }

    return Object.freeze({
      getAll,
      getById,
      upsert,
      remove,
      replaceAll,
      getSyncStatus,
      subscribe
    });
  }

  const api = Object.freeze({
    STORAGE_KEY,
    STORAGE_VERSION,
    SYNC_META_KEY,
    SYNC_ENTRY_PREFIX,
    SYNC_VERSION,
    SYNC_MIGRATION_KEY,
    SYNC_MIGRATION_VERSION,
    getExtensionApi,
    createStorage
  });

  root.AliasBuddy = root.AliasBuddy || {};
  root.AliasBuddy.core = root.AliasBuddy.core || {};
  root.AliasBuddy.core.storage = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
