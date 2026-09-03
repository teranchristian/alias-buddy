(function initialiseAliasStorage(root) {
  'use strict';

  const aliasModel = root.AliasBuddy?.core?.aliases;
  const STORAGE_KEY = 'aliasBuddyData';
  const STORAGE_VERSION = 1;

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

  function callStorage(extensionApi, method, argument) {
    return extensionApi.storage.local[method](argument);
  }

  function createStorage(api) {
    requireAliasModel();
    const extensionApi = getExtensionApi(api);

    if (!extensionApi?.storage?.local || !extensionApi.storage.onChanged) {
      throw new Error('The browser storage API is unavailable.');
    }

    async function readDocument() {
      const result = await callStorage(extensionApi, 'get', STORAGE_KEY);
      const stored = result?.[STORAGE_KEY];

      if (!stored || stored.version !== STORAGE_VERSION || !Array.isArray(stored.entries)) {
        return { version: STORAGE_VERSION, entries: [] };
      }

      return {
        version: STORAGE_VERSION,
        entries: stored.entries.map(aliasModel.normalizeEntry)
      };
    }

    async function writeEntries(entries) {
      const document = {
        version: STORAGE_VERSION,
        entries: aliasModel.sortEntries(entries.map(aliasModel.normalizeEntry))
      };

      await callStorage(extensionApi, 'set', { [STORAGE_KEY]: document });
      return document.entries;
    }

    async function getAll() {
      const document = await readDocument();
      return aliasModel.sortEntries(document.entries);
    }

    async function getById(id) {
      const entries = await getAll();
      return entries.find(entry => entry.id === String(id)) || null;
    }

    async function upsert(entry) {
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

      await writeEntries(entries);
      return validation.entry;
    }

    async function remove(id) {
      const entries = await getAll();
      const nextEntries = entries.filter(entry => entry.id !== String(id));

      if (entries.length === nextEntries.length) {
        return false;
      }

      await writeEntries(nextEntries);
      return true;
    }

    async function replaceAll(nextEntries) {
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

      return writeEntries(validatedEntries);
    }

    function subscribe(listener) {
      const handleChange = (changes, areaName) => {
        if (areaName !== 'local' || !changes[STORAGE_KEY]) {
          return;
        }

        const nextValue = changes[STORAGE_KEY].newValue;
        const entries = Array.isArray(nextValue?.entries)
          ? aliasModel.sortEntries(nextValue.entries.map(aliasModel.normalizeEntry))
          : [];

        listener(entries);
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
      subscribe
    });
  }

  const api = Object.freeze({
    STORAGE_KEY,
    STORAGE_VERSION,
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
