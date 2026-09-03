'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/core/aliases.js');
const { createStorage, STORAGE_KEY } = require('../src/core/storage.js');

function createChromiumMock() {
  const values = {};
  const listeners = new Set();

  const chromeApi = {
    runtime: { lastError: null },
    storage: {
      local: {
        async get(key) {
          return { [key]: values[key] };
        },
        async set(update) {
          Object.entries(update).forEach(([key, newValue]) => {
            const oldValue = values[key];
            values[key] = newValue;
            listeners.forEach(listener => listener({
              [key]: { oldValue, newValue }
            }, 'local'));
          });
        }
      },
      onChanged: {
        addListener(listener) {
          listeners.add(listener);
        },
        removeListener(listener) {
          listeners.delete(listener);
        }
      }
    }
  };

  return { chromeApi, values };
}

test('creates, updates, and removes entries with Chromium extension storage', async () => {
  const { chromeApi, values } = createChromiumMock();
  const storage = createStorage(chromeApi);

  await storage.upsert({
    id: 'one',
    type: 'person',
    nickname: 'Sunshine',
    email: 'person@example.com'
  });

  assert.equal(values[STORAGE_KEY].version, 1);
  assert.equal((await storage.getAll()).length, 1);

  await storage.upsert({
    id: 'one',
    type: 'person',
    nickname: 'Bright day',
    email: 'person@example.com'
  });

  assert.equal((await storage.getById('one')).nickname, 'Bright day');
  assert.equal(await storage.remove('one'), true);
  assert.equal(await storage.remove('missing'), false);
  assert.deepEqual(await storage.getAll(), []);
});

test('supports promise-based extension storage used by Firefox', async () => {
  const values = {};
  const listeners = new Set();
  const browserApi = {
    runtime: { id: 'test-extension' },
    storage: {
      local: {
        async get(key) {
          return { [key]: values[key] };
        },
        async set(update) {
          Object.entries(update).forEach(([key, newValue]) => {
            const oldValue = values[key];
            values[key] = newValue;
            listeners.forEach(listener => listener({
              [key]: { oldValue, newValue }
            }, 'local'));
          });
        }
      },
      onChanged: {
        addListener(listener) {
          listeners.add(listener);
        },
        removeListener(listener) {
          listeners.delete(listener);
        }
      }
    }
  };
  const storage = createStorage(browserApi);

  await storage.upsert({
    id: 'firefox-person',
    type: 'person',
    nickname: 'Promise storage',
    email: 'person@example.com'
  });

  assert.equal((await storage.getAll())[0].nickname, 'Promise storage');
  assert.equal(await storage.remove('firefox-person'), true);
  assert.deepEqual(await storage.getAll(), []);
});

test('notifies subscribers and supports unsubscribing', async () => {
  const { chromeApi } = createChromiumMock();
  const storage = createStorage(chromeApi);
  const snapshots = [];
  const unsubscribe = storage.subscribe(nextEntries => snapshots.push(nextEntries));

  await storage.upsert({
    id: 'one',
    type: 'person',
    nickname: 'Sunshine',
    email: 'person@example.com'
  });
  unsubscribe();
  await storage.remove('one');

  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0][0].nickname, 'Sunshine');
});

test('validates and atomically replaces all entries during restore', async () => {
  const { chromeApi } = createChromiumMock();
  const storage = createStorage(chromeApi);
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

  await assert.rejects(() => storage.replaceAll([
    replacement[0],
    { ...replacement[0], nickname: 'Another group' }
  ]), /invalid/i);
  assert.deepEqual(await storage.getAll(), replacement);
});
