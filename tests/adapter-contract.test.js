'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const contract = require('../src/adapters/adapter.js');

function completeAdapter(supported) {
  return {
    isSupportedPage: () => supported,
    findPeopleInput() {},
    renderAliasResults() {},
    selectPerson() {},
    getSelectedEmails() {}
  };
}

test('rejects adapters that do not implement the contract', () => {
  assert.throws(() => contract.assertAdapter({}), /missing required methods/i);
});

test('selects the registered adapter that supports the current page', () => {
  contract.register('unsupported-test', () => completeAdapter(false));
  contract.register('supported-test', () => completeAdapter(true));
  assert.equal(contract.createSupported({}).isSupportedPage(), true);
});
