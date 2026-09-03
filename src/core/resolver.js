(function initialiseAliasResolver(root) {
  'use strict';

  const aliasModel = root.AliasBuddy?.core?.aliases;
  const MIN_QUERY_LENGTH = 2;

  function requireAliasModel() {
    if (!aliasModel) {
      throw new Error('AliasBuddy alias model must load before the resolver.');
    }
  }

  function getEntryEmails(entry) {
    requireAliasModel();

    if (entry?.type === aliasModel.ENTRY_TYPES.PERSON) {
      const email = aliasModel.normalizeEmail(entry.email);
      return email ? [email] : [];
    }

    if (entry?.type === aliasModel.ENTRY_TYPES.GROUP) {
      return [...new Set((entry.emails || []).map(aliasModel.normalizeEmail).filter(Boolean))];
    }

    return [];
  }

  function normalizeSelectedEmails(selectedEmails) {
    requireAliasModel();
    return new Set([...selectedEmails].map(aliasModel.normalizeEmail).filter(Boolean));
  }

  function getRemainingEmails(entry, selectedEmails = new Set()) {
    const selected = normalizeSelectedEmails(selectedEmails);
    return getEntryEmails(entry).filter(email => !selected.has(email));
  }

  function resolve(query, entries, selectedEmails = new Set()) {
    requireAliasModel();
    const normalizedQuery = aliasModel.normalizeNickname(query);

    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      return [];
    }

    return entries
      .filter(entry => (
        aliasModel.normalizeNickname(entry.nickname).startsWith(normalizedQuery)
        && getRemainingEmails(entry, selectedEmails).length > 0
      ))
      .map(entry => ({
        nickname: entry.nickname,
        entry
      }));
  }

  function shouldSuppressNativeDuplicate(query, selectedEmails = new Set()) {
    requireAliasModel();
    const normalizedQuery = aliasModel.normalizeEmail(query);
    return Boolean(normalizedQuery) && normalizeSelectedEmails(selectedEmails).has(normalizedQuery);
  }

  const api = Object.freeze({
    MIN_QUERY_LENGTH,
    getEntryEmails,
    getRemainingEmails,
    resolve,
    shouldSuppressNativeDuplicate
  });

  root.AliasBuddy = root.AliasBuddy || {};
  root.AliasBuddy.core = root.AliasBuddy.core || {};
  root.AliasBuddy.core.resolver = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
