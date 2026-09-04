'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/core/aliases.js');
const {
  createStorage,
  STORAGE_KEY,
  SYNC_META_KEY,
  SYNC_ENTRY_PREFIX,
  SYNC_MIGRATION_KEY
} = require('../src/core/storage.js');

function createArea(values, listeners, areaName) {
  return {
    QUOTA_BYTES: 102400,
    async get(key) {
      if (key === null) {
        return { ...values };
      }
      return { [key]: values[key] };
    },
    async set(update) {
      const changes = {};
      for (const [key, newValue] of Object.entries(update)) {
        const oldValue = values[key];
        values[key] = newValue;
        changes[key] = { oldValue, newValue };
      }
      listeners.forEach(listener => listener(changes, areaName));
    },
    async remove(keys) {
      const changes = {};
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (!Object.hasOwn(values, key)) {
          continue;
        }
        changes[key] = { oldValue: values[key], newValue: undefined };
        delete values[key];
      }
      if (Object.keys(changes).length) {
        listeners.forEach(listener => listener(changes, areaName));
      }
    },
    async clear() {
      const changes = {};
      for (const [key, oldValue] of Object.entries(values)) {
        changes[key] = { oldValue, newValue: undefined };
        delete values[key];
      }
      listeners.forEach(listener => listener(changes, areaName));
    },
    async getBytesInUse() {
      return Object.entries(values).reduce(
        (total, [key, value]) => total + key.length + JSON.stringify(value).length,
        0
      );
    }
  };
}

function createBrowserMock({ withSync = true } = {}) {
  const localValues = {};
  const syncValues = {};
  const listeners = new Set();
  const storage = {
    local: createArea(localValues, listeners, 'local'),
    onChanged: {
      addListener(listener) {
        listeners.add(listener);
      },
      removeListener(listener) {
        listeners.delete(listener);
      }
    }
  };

  if (withSync) {
    storage.sync = createArea(syncValues, listeners, 'sync');
  }

  return {
    api: { runtime: { id: 'test-extension' }, storage },
    localValues,
    syncValues
  };
}

const sunshine = {
  id: 'one',
  type: 'person',
  nickname: 'Sunshine',
  email: 'person@example.com'
};

function flush() {
  return new Promise(resolve => setImmediate(resolve));
}

test('migrates existing local aliases into browser sync without changing the local schema', async () => {
  const { api, localValues, syncValues } = createBrowserMock();
  localValues[STORAGE_KEY] = { version: 1, entries: [sunshine] };
  const storage = createStorage(api);

  assert.deepEqual(await storage.getAll(), [sunshine]);
  assert.equal(syncValues[SYNC_META_KEY].version, 1);
  assert.deepEqual(syncValues[`${SYNC_ENTRY_PREFIX}one`].entry, sunshine);
  assert.equal(localValues[SYNC_MIGRATION_KEY].version, 1);
});

test('syncs edits and deletions while retaining explicit empty-dataset metadata', async () => {
  const { api, syncValues } = createBrowserMock();
  const storage = createStorage(api);

  await storage.upsert(sunshine);
  assert.deepEqual(syncValues[`${SYNC_ENTRY_PREFIX}one`].entry, sunshine);

  await storage.remove('one');
  assert.equal(syncValues[`${SYNC_ENTRY_PREFIX}one`], undefined);
  assert.equal(syncValues[SYNC_META_KEY].version, 1);
  assert.deepEqual(await storage.getAll(), []);
});

test('applies remote changes from the same browser sync ecosystem', async () => {
  const { api, syncValues } = createBrowserMock();
  const storage = createStorage(api);
  storage.subscribe(() => {});
  await storage.getAll();
  const generation = syncValues[SYNC_META_KEY].generation;
  const remote = {
    id: 'two',
    type: 'person',
    nickname: 'Remote',
    email: 'remote@example.com'
  };

  await api.storage.sync.set({
    [`${SYNC_ENTRY_PREFIX}two`]: {
      version: 1,
      generation,
      updatedAt: new Date().toISOString(),
      entry: remote
    }
  });
  await flush();
  await flush();

  assert.deepEqual(await storage.getAll(), [remote]);
});

test('does not treat missing sync metadata as an intentional delete-all', async () => {
  const { api, syncValues } = createBrowserMock();
  const storage = createStorage(api);
  storage.subscribe(() => {});
  await storage.upsert(sunshine);

  await api.storage.sync.clear();
  await flush();
  await flush();

  assert.deepEqual(await storage.getAll(), [sunshine]);
  assert.equal(syncValues[SYNC_META_KEY].version, 1);
  assert.deepEqual(syncValues[`${SYNC_ENTRY_PREFIX}one`].entry, sunshine);
});

test('falls back to local-only storage when sync storage is unavailable', async () => {
  const { api, localValues } = createBrowserMock({ withSync: false });
  const storage = createStorage(api);
  await storage.upsert(sunshine);

  assert.deepEqual(localValues[STORAGE_KEY].entries, [sunshine]);
  assert.deepEqual(await storage.getAll(), [sunshine]);
  assert.equal((await storage.getSyncStatus()).available, false);
});

test('validates and atomically replaces local entries before mirroring to sync', async () => {
  const { api, syncValues } = createBrowserMock();
  const storage = createStorage(api);
  const replacement = [
    {
      id: 'group-one',
      type: 'group',
      nickname: 'Book club',
      emails: ['member@example.com']
    }
  ];

  await storage.replaceAll(replacement);
  assert.deepEqual(await storage.getAll(), replacement);
  const generation = syncValues[SYNC_META_KEY].generation;
  assert.equal(syncValues[`${SYNC_ENTRY_PREFIX}group-one`].generation, generation);

  await assert.rejects(() => storage.replaceAll([
    replacement[0],
    { ...replacement[0], nickname: 'Another group' }
  ]), /invalid/i);
  assert.deepEqual(await storage.getAll(), replacement);
});
