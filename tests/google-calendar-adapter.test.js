'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/core/aliases.js');
require('../src/core/resolver.js');
const { GoogleCalendarAdapter } = require('../src/adapters/google-calendar.js');

test('finishing a group does not reopen Google results with an empty search', async () => {
  const adapter = new GoogleCalendarAdapter();
  const originalSetTimeout = global.setTimeout;
  let clearSearchCalls = 0;

  adapter.getSelectedEmails = () => new Set();
  adapter.isEmailAlreadySelected = () => false;
  adapter.selectPerson = async () => true;
  adapter.clearSearchInput = () => {
    clearSearchCalls += 1;
  };
  adapter.showToast = () => {};
  global.setTimeout = callback => {
    callback();
    return 0;
  };

  try {
    const result = await adapter.selectGroup({
      type: 'group',
      nickname: 'Test group',
      emails: ['one@example.com', 'two@example.com']
    });

    assert.deepEqual(result.added, ['one@example.com', 'two@example.com']);
    assert.equal(clearSearchCalls, 0);
  } finally {
    global.setTimeout = originalSetTimeout;
  }
});
