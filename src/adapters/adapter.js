(function initialiseAdapterContract(root) {
  'use strict';

  const REQUIRED_METHODS = Object.freeze([
    'isSupportedPage',
    'findPeopleInput',
    'renderAliasResults',
    'selectPerson',
    'getSelectedEmails'
  ]);
  const registrations = [];

  function assertAdapter(adapter) {
    const missing = REQUIRED_METHODS.filter(method => typeof adapter?.[method] !== 'function');

    if (missing.length) {
      throw new Error(`Adapter is missing required methods: ${missing.join(', ')}`);
    }

    return adapter;
  }

  function register(id, create) {
    if (!id || typeof create !== 'function') {
      throw new Error('Adapter registration requires an id and factory.');
    }

    if (registrations.some(registration => registration.id === id)) {
      return;
    }

    registrations.push(Object.freeze({ id, create }));
  }

  function createSupported(options) {
    for (const registration of registrations) {
      const adapter = assertAdapter(registration.create(options));
      if (adapter.isSupportedPage()) {
        return adapter;
      }
    }

    return null;
  }

  const api = Object.freeze({ REQUIRED_METHODS, assertAdapter, register, createSupported });

  root.AliasBuddy = root.AliasBuddy || {};
  root.AliasBuddy.adapters = root.AliasBuddy.adapters || {};
  root.AliasBuddy.adapters.contract = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
