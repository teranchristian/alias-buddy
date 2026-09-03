(function initialiseBackupFormat(root) {
  'use strict';

  const aliasModel = root.AliasBuddy?.core?.aliases;
  const BACKUP_FORMAT = 'aliasbuddy-backup';
  const BACKUP_VERSION = 1;

  class BackupValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BackupValidationError';
    }
  }

  function requireAliasModel() {
    if (!aliasModel) {
      throw new Error('AliasBuddy alias model must load before backup support.');
    }
  }

  function validateEntries(entries) {
    requireAliasModel();

    if (!Array.isArray(entries)) {
      throw new BackupValidationError('The backup does not contain an entries list.');
    }

    const normalizedEntries = [];
    const entryIds = new Set();

    entries.forEach((entry, index) => {
      if (!entry || !Object.values(aliasModel.ENTRY_TYPES).includes(entry.type)) {
        throw new BackupValidationError(`Entry ${index + 1} has an unsupported type.`);
      }

      const normalized = aliasModel.normalizeEntry(entry);
      if (entryIds.has(normalized.id)) {
        throw new BackupValidationError(`Entry ${index + 1} uses a duplicate ID.`);
      }

      const validation = aliasModel.validateEntry(normalized, normalizedEntries);
      if (!validation.valid) {
        const reason = Object.values(validation.errors)[0] || 'Invalid entry.';
        throw new BackupValidationError(`Entry ${index + 1}: ${reason}`);
      }

      entryIds.add(normalized.id);
      normalizedEntries.push(validation.entry);
    });

    return aliasModel.sortEntries(normalizedEntries);
  }

  function createBackupDocument(entries, exportedAt = new Date().toISOString()) {
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      entries: validateEntries(entries)
    };
  }

  function stringifyBackup(entries, exportedAt) {
    return `${JSON.stringify(createBackupDocument(entries, exportedAt), null, 2)}\n`;
  }

  function parseBackup(text) {
    let document;

    try {
      document = JSON.parse(String(text || ''));
    } catch {
      throw new BackupValidationError('This is not a valid JSON backup file.');
    }

    if (!document || document.format !== BACKUP_FORMAT) {
      throw new BackupValidationError('This file is not an AliasBuddy backup.');
    }

    if (document.version !== BACKUP_VERSION) {
      throw new BackupValidationError(`Backup version ${document.version} is not supported.`);
    }

    return validateEntries(document.entries);
  }

  function createBackupFilename(date = new Date()) {
    const day = date.toISOString().slice(0, 10);
    return `aliasbuddy-backup-${day}.json`;
  }

  const api = Object.freeze({
    BACKUP_FORMAT,
    BACKUP_VERSION,
    BackupValidationError,
    validateEntries,
    createBackupDocument,
    stringifyBackup,
    parseBackup,
    createBackupFilename
  });

  root.AliasBuddy = root.AliasBuddy || {};
  root.AliasBuddy.core = root.AliasBuddy.core || {};
  root.AliasBuddy.core.backup = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
