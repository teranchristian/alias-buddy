'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/core/aliases.js');
const backup = require('../src/core/backup.js');

const entries = [
  {
    id: 'one',
    type: 'person',
    nickname: 'Sunshine',
    email: 'person@example.com'
  },
  {
    id: 'two',
    type: 'group',
    nickname: 'Book club',
    emails: ['member.one@example.com', 'member.two@example.com']
  }
];

test('round-trips a versioned backup document', () => {
  const text = backup.stringifyBackup(entries, '2026-01-02T03:04:05.000Z');
  const document = JSON.parse(text);

  assert.equal(document.format, 'aliasbuddy-backup');
  assert.equal(document.version, 1);
  assert.equal(document.exportedAt, '2026-01-02T03:04:05.000Z');
  assert.deepEqual(backup.parseBackup(text), [entries[1], entries[0]]);
});

test('creates a dated backup filename', () => {
  assert.equal(
    backup.createBackupFilename(new Date('2026-01-02T12:00:00.000Z')),
    'aliasbuddy-backup-2026-01-02.json'
  );
});

test('rejects unrelated and unsupported backup files', () => {
  assert.throws(() => backup.parseBackup('{"entries":[]}'), /not an AliasBuddy backup/i);
  assert.throws(
    () => backup.parseBackup('{"format":"aliasbuddy-backup","version":2,"entries":[]}'),
    /version 2 is not supported/i
  );
});

test('rejects invalid entries before import', () => {
  const text = JSON.stringify({
    format: 'aliasbuddy-backup',
    version: 1,
    entries: [
      entries[0],
      { ...entries[1], nickname: 'SUNSHINE' }
    ]
  });

  assert.throws(() => backup.parseBackup(text), /nickname is already in use/i);
});
