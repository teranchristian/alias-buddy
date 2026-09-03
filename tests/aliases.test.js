'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const aliases = require('../src/core/aliases.js');

test('normalizes nicknames and emails without changing the displayed nickname case', () => {
  const entry = aliases.normalizeEntry({
    id: 'one',
    type: 'person',
    nickname: '  Sunny   Day ',
    email: ' PERSON@EXAMPLE.COM '
  });

  assert.equal(entry.nickname, 'Sunny Day');
  assert.equal(entry.email, 'person@example.com');
  assert.equal(aliases.normalizeNickname(entry.nickname), 'sunny day');
});

test('rejects an empty nickname and invalid person email', () => {
  const result = aliases.validateEntry({
    id: 'one',
    type: 'person',
    nickname: ' ',
    email: 'not-an-email'
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.nickname, 'Nickname is required.');
  assert.equal(result.errors.email, 'Enter a valid email address.');
});

test('prevents case-insensitive duplicate nicknames across entry types', () => {
  const existing = [{
    id: 'one',
    type: 'person',
    nickname: 'Sunshine',
    email: 'person@example.com'
  }];

  const result = aliases.validateEntry({
    id: 'two',
    type: 'group',
    nickname: 'SUNSHINE',
    emails: ['member@example.com']
  }, existing);

  assert.equal(result.valid, false);
  assert.equal(result.errors.nickname, 'That nickname is already in use.');
});

test('allows an existing entry to retain its own nickname while editing', () => {
  const existing = [{
    id: 'one',
    type: 'person',
    nickname: 'Sunshine',
    email: 'person@example.com'
  }];

  const result = aliases.validateEntry({
    ...existing[0],
    nickname: 'sunshine'
  }, existing);

  assert.equal(result.valid, true);
});

test('prevents duplicate group members case-insensitively', () => {
  const result = aliases.validateEntry({
    id: 'group-one',
    type: 'group',
    nickname: 'Book club',
    emails: ['member@example.com', 'MEMBER@example.com']
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.emails, 'The same email cannot appear twice in a group.');
});

test('parses pasted email lists separated by commas, semicolons, or new lines', () => {
  const parsed = aliases.parseEmailList([
    'MEMBER.ONE@example.com, member.two@example.com',
    'member.three@example.com; member.four@example.com'
  ].join('\n'));

  assert.deepEqual(parsed, [
    'member.one@example.com',
    'member.two@example.com',
    'member.three@example.com',
    'member.four@example.com'
  ]);
  assert.equal(aliases.formatEmailList(parsed), parsed.join(', '));
});
