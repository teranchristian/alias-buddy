'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/core/aliases.js');
const resolver = require('../src/core/resolver.js');

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

test('requires at least two nickname characters', () => {
  assert.deepEqual(resolver.resolve('s', entries), []);
});

test('matches nickname prefixes case-insensitively', () => {
  const matches = resolver.resolve('SUN', entries);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].nickname, 'Sunshine');
});

test('does not match by email address', () => {
  assert.deepEqual(resolver.resolve('person@', entries), []);
});

test('excludes a person alias when its email is already selected', () => {
  const matches = resolver.resolve('sun', entries, new Set(['PERSON@example.com']));
  assert.deepEqual(matches, []);
});

test('keeps a group visible while at least one member remains', () => {
  const matches = resolver.resolve('book', entries, new Set(['member.one@example.com']));
  assert.equal(matches.length, 1);
  assert.deepEqual(
    resolver.getRemainingEmails(matches[0].entry, new Set(['member.one@example.com'])),
    ['member.two@example.com']
  );
});

test('suppresses only an exact selected email query', () => {
  const selected = new Set(['person@example.com']);
  assert.equal(resolver.shouldSuppressNativeDuplicate('PERSON@example.com', selected), true);
  assert.equal(resolver.shouldSuppressNativeDuplicate('person', selected), false);
});
