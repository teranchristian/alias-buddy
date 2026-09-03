(function initialiseAliasModel(root) {
  'use strict';

  const ENTRY_TYPES = Object.freeze({
    PERSON: 'person',
    GROUP: 'group'
  });

  class AliasValidationError extends Error {
    constructor(errors) {
      super('Alias entry is invalid.');
      this.name = 'AliasValidationError';
      this.errors = errors;
    }
  }

  function normalizeNickname(nickname) {
    return String(nickname || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function cleanNickname(nickname) {
    return String(nickname || '').trim().replace(/\s+/g, ' ');
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function looksLikeEmail(email) {
    const normalized = normalizeEmail(email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  }

  function createId() {
    if (root.crypto?.randomUUID) {
      return root.crypto.randomUUID();
    }

    return `alias-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeEntry(entry) {
    const type = entry?.type === ENTRY_TYPES.GROUP
      ? ENTRY_TYPES.GROUP
      : ENTRY_TYPES.PERSON;

    const normalized = {
      id: String(entry?.id || createId()),
      type,
      nickname: cleanNickname(entry?.nickname)
    };

    if (type === ENTRY_TYPES.GROUP) {
      normalized.emails = Array.isArray(entry?.emails)
        ? entry.emails.map(normalizeEmail).filter(Boolean)
        : [];
    } else {
      normalized.email = normalizeEmail(entry?.email);
    }

    return normalized;
  }

  function validateEntry(entry, existingEntries = []) {
    const normalized = normalizeEntry(entry);
    const errors = {};

    if (!normalized.nickname) {
      errors.nickname = 'Nickname is required.';
    }

    const duplicateNickname = existingEntries.some(candidate => (
      String(candidate.id) !== normalized.id
      && normalizeNickname(candidate.nickname) === normalizeNickname(normalized.nickname)
    ));

    if (normalized.nickname && duplicateNickname) {
      errors.nickname = 'That nickname is already in use.';
    }

    if (normalized.type === ENTRY_TYPES.PERSON) {
      if (!looksLikeEmail(normalized.email)) {
        errors.email = 'Enter a valid email address.';
      }
    } else {
      if (!normalized.emails.length) {
        errors.emails = 'Add at least one group member.';
      } else if (normalized.emails.some(email => !looksLikeEmail(email))) {
        errors.emails = 'Every group member must have a valid email address.';
      } else if (new Set(normalized.emails).size !== normalized.emails.length) {
        errors.emails = 'The same email cannot appear twice in a group.';
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      entry: normalized
    };
  }

  function sortEntries(entries) {
    return [...entries].sort((left, right) => (
      left.nickname.localeCompare(right.nickname, undefined, { sensitivity: 'base' })
    ));
  }

  const api = Object.freeze({
    ENTRY_TYPES,
    AliasValidationError,
    normalizeNickname,
    cleanNickname,
    normalizeEmail,
    looksLikeEmail,
    createId,
    normalizeEntry,
    validateEntry,
    sortEntries
  });

  root.AliasBuddy = root.AliasBuddy || {};
  root.AliasBuddy.core = root.AliasBuddy.core || {};
  root.AliasBuddy.core.aliases = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
