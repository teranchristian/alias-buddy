'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/core/aliases.js');
const { createStorage, STORAGE_KEY } = require('../src/core/storage.js');

function createChromeMock() {
  const values = {};
  const listeners = new Set();

  const chromeApi = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(key, callback) {
          callback({ [key]: values[key] });
        },
        set(update, callback) {
          Object.entries(update).forEach(([key, newValue]) => {
            const oldValue = values[key];
            values[key] = newValue;
            listeners.forEach(listener => listener({
              [key]: { oldValue, newValue }
            }, 'local'));
          });
          callback();
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

test('creates, updates, and removes entries in chrome.storage.local', async () => {
  const { chromeApi, values } = createChromeMock();
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

test('notifies subscribers and supports unsubscribing', async () => {
  const { chromeApi } = createChromeMock();
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
