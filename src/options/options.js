(function initialiseOptions(root) {
  'use strict';

  const aliasModel = root.AliasBuddy.core.aliases;
  const storage = root.AliasBuddy.core.storage.createStorage(root.chrome);
  const backup = root.AliasBuddy.core.backup;
  const elements = {
    peopleList: document.getElementById('people-list'),
    groupsList: document.getElementById('groups-list'),
    peopleEmpty: document.getElementById('people-empty'),
    groupsEmpty: document.getElementById('groups-empty'),
    personTotal: document.getElementById('person-total'),
    groupTotal: document.getElementById('group-total'),
    pageStatus: document.getElementById('page-status'),
    dialog: document.getElementById('entry-dialog'),
    form: document.getElementById('entry-form'),
    entryId: document.getElementById('entry-id'),
    entryType: document.getElementById('entry-type'),
    dialogKicker: document.getElementById('dialog-kicker'),
    dialogTitle: document.getElementById('dialog-title'),
    nicknameLabel: document.getElementById('nickname-label'),
    nickname: document.getElementById('nickname'),
    nicknameError: document.getElementById('nickname-error'),
    personFields: document.getElementById('person-fields'),
    personEmail: document.getElementById('person-email'),
    emailError: document.getElementById('email-error'),
    groupFields: document.getElementById('group-fields'),
    memberList: document.getElementById('member-list'),
    memberTextarea: document.getElementById('member-textarea'),
    memberModeIndividual: document.getElementById('member-mode-individual'),
    memberModePaste: document.getElementById('member-mode-paste'),
    addMember: document.getElementById('add-member'),
    membersError: document.getElementById('members-error'),
    formStatus: document.getElementById('form-status'),
    importBackupFile: document.getElementById('import-backup-file')
  };

  let entries = [];
  let statusTimer = null;
  let memberInputMode = 'individual';

  function setPageStatus(message, kind = 'error') {
    if (statusTimer) {
      root.clearTimeout(statusTimer);
      statusTimer = null;
    }

    elements.pageStatus.textContent = message;
    elements.pageStatus.dataset.kind = kind;
    elements.pageStatus.hidden = false;

    if (kind === 'success') {
      statusTimer = root.setTimeout(() => {
        elements.pageStatus.hidden = true;
      }, 3500);
    }
  }

  function createButton(label, className, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  function createEntryCard(entry) {
    const card = document.createElement('article');
    card.className = 'entry-card';

    const avatar = document.createElement('div');
    avatar.className = 'entry-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = entry.type === aliasModel.ENTRY_TYPES.GROUP
      ? '👥'
      : entry.nickname.charAt(0).toUpperCase();

    const copy = document.createElement('div');
    copy.className = 'entry-copy';

    const nickname = document.createElement('strong');
    nickname.textContent = entry.nickname;

    const detail = document.createElement('span');
    if (entry.type === aliasModel.ENTRY_TYPES.GROUP) {
      const count = entry.emails.length;
      detail.textContent = `${count} ${count === 1 ? 'member' : 'members'} · ${entry.emails.join(', ')}`;
    } else {
      detail.textContent = entry.email;
    }

    copy.append(nickname, detail);

    const actions = document.createElement('div');
    actions.className = 'entry-actions';
    if (entry.type === aliasModel.ENTRY_TYPES.GROUP) {
      actions.appendChild(
        createButton('Clone', 'small-button', () => cloneGroup(entry))
      );
    }

    actions.append(
      createButton('Edit', 'small-button', () => openEditor(entry.type, entry)),
      createButton('Delete', 'small-button small-button--danger', () => deleteEntry(entry))
    );

    card.append(avatar, copy, actions);
    return card;
  }

  function render(nextEntries = entries) {
    entries = aliasModel.sortEntries(nextEntries);
    const people = entries.filter(entry => entry.type === aliasModel.ENTRY_TYPES.PERSON);
    const groups = entries.filter(entry => entry.type === aliasModel.ENTRY_TYPES.GROUP);

    elements.personTotal.textContent = String(people.length);
    elements.groupTotal.textContent = String(groups.length);
    elements.peopleList.replaceChildren(...people.map(createEntryCard));
    elements.groupsList.replaceChildren(...groups.map(createEntryCard));
    elements.peopleEmpty.hidden = people.length > 0;
    elements.groupsEmpty.hidden = groups.length > 0;
  }

  function clearFormErrors() {
    elements.nicknameError.textContent = '';
    elements.emailError.textContent = '';
    elements.membersError.textContent = '';
    elements.formStatus.textContent = '';
    elements.formStatus.hidden = true;
    elements.nickname.removeAttribute('aria-invalid');
    elements.personEmail.removeAttribute('aria-invalid');
    elements.memberTextarea.removeAttribute('aria-invalid');
    elements.memberTextarea.setCustomValidity('');
    elements.memberList.querySelectorAll('input').forEach(input => {
      input.removeAttribute('aria-invalid');
      input.setCustomValidity('');
    });
  }

  function addMemberRow(email = '') {
    const row = document.createElement('div');
    row.className = 'member-row';

    const input = document.createElement('input');
    input.type = 'email';
    input.inputMode = 'email';
    input.autocomplete = 'email';
    input.placeholder = 'member@example.com';
    input.value = email;
    input.required = true;
    input.setAttribute('aria-label', `Group member email ${elements.memberList.children.length + 1}`);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-member';
    removeButton.setAttribute('aria-label', 'Remove member');
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => {
      row.remove();
      updateMemberLabels();
    });

    row.append(input, removeButton);
    elements.memberList.appendChild(row);
  }

  function updateMemberLabels() {
    elements.memberList.querySelectorAll('input').forEach((input, index) => {
      input.setAttribute('aria-label', `Group member email ${index + 1}`);
    });
  }

  function getIndividualMemberValues() {
    return [...elements.memberList.querySelectorAll('input')].map(input => input.value);
  }

  function replaceIndividualMembers(emails) {
    elements.memberList.replaceChildren();
    const values = emails.length ? emails : [''];
    values.forEach(addMemberRow);
  }

  function setMemberInputMode(mode, { sync = true } = {}) {
    if (mode !== 'individual' && mode !== 'paste') {
      return;
    }

    if (sync && mode === 'paste' && memberInputMode === 'individual') {
      elements.memberTextarea.value = aliasModel.formatEmailList(getIndividualMemberValues());
    } else if (sync && mode === 'individual' && memberInputMode === 'paste') {
      replaceIndividualMembers(aliasModel.parseEmailList(elements.memberTextarea.value));
    }

    memberInputMode = mode;
    const isIndividual = mode === 'individual';
    elements.memberList.hidden = !isIndividual;
    elements.memberTextarea.hidden = isIndividual;
    elements.addMember.hidden = !isIndividual;
    elements.memberModeIndividual.setAttribute('aria-pressed', String(isIndividual));
    elements.memberModePaste.setAttribute('aria-pressed', String(!isIndividual));
    clearFormErrors();
  }

  function uniqueCloneNickname(nickname) {
    const usedNicknames = new Set(entries.map(entry => aliasModel.normalizeNickname(entry.nickname)));
    const base = `${nickname} copy`;
    let candidate = base;
    let suffix = 2;

    while (usedNicknames.has(aliasModel.normalizeNickname(candidate))) {
      candidate = `${base} ${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  function cloneGroup(entry) {
    openEditor(aliasModel.ENTRY_TYPES.GROUP, {
      id: aliasModel.createId(),
      type: aliasModel.ENTRY_TYPES.GROUP,
      nickname: uniqueCloneNickname(entry.nickname),
      emails: [...entry.emails]
    }, { clone: true });
  }

  function openEditor(type, entry = null, { clone = false } = {}) {
    const isGroup = type === aliasModel.ENTRY_TYPES.GROUP;
    elements.form.reset();
    elements.memberList.replaceChildren();
    clearFormErrors();

    elements.entryId.value = entry?.id || aliasModel.createId();
    elements.entryType.value = type;
    elements.nickname.value = entry?.nickname || '';
    elements.nicknameLabel.textContent = isGroup ? 'Group nickname' : 'Nickname';
    elements.dialogKicker.textContent = isGroup ? 'Group alias' : 'Person alias';
    elements.dialogTitle.textContent = entry
      ? clone
        ? 'Clone group'
        : `Edit ${isGroup ? 'group' : 'alias'}`
      : `Add ${isGroup ? 'group' : 'alias'}`;

    elements.personFields.hidden = isGroup;
    elements.groupFields.hidden = !isGroup;
    elements.personEmail.required = !isGroup;

    if (isGroup) {
      const emails = entry?.emails?.length ? entry.emails : [''];
      replaceIndividualMembers(emails);
      elements.memberTextarea.value = aliasModel.formatEmailList(emails);
      setMemberInputMode('individual', { sync: false });
    } else {
      elements.personEmail.value = entry?.email || '';
    }

    elements.dialog.showModal();
    root.requestAnimationFrame(() => elements.nickname.focus());
  }

  function closeEditor() {
    elements.dialog.close();
  }

  async function deleteEntry(entry) {
    const confirmed = root.confirm(`Delete “${entry.nickname}”?`);
    if (!confirmed) {
      return;
    }

    try {
      await storage.remove(entry.id);
      setPageStatus(`Deleted “${entry.nickname}”.`, 'success');
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : 'Could not delete this entry.');
    }
  }

  function collectCandidate() {
    const type = elements.entryType.value;
    const candidate = {
      id: elements.entryId.value,
      type,
      nickname: elements.nickname.value
    };

    if (type === aliasModel.ENTRY_TYPES.GROUP) {
      candidate.emails = memberInputMode === 'paste'
        ? aliasModel.parseEmailList(elements.memberTextarea.value)
        : getIndividualMemberValues();
    } else {
      candidate.email = elements.personEmail.value;
    }

    return candidate;
  }

  function markGroupMemberErrors(candidate) {
    const normalizedEmails = candidate.emails.map(aliasModel.normalizeEmail);
    const counts = new Map();
    normalizedEmails.forEach(email => counts.set(email, (counts.get(email) || 0) + 1));

    if (memberInputMode === 'paste') {
      const invalid = normalizedEmails.length === 0
        || normalizedEmails.some(email => !aliasModel.looksLikeEmail(email))
        || [...counts.values()].some(count => count > 1);
      elements.memberTextarea.setAttribute('aria-invalid', String(invalid));
      elements.memberTextarea.setCustomValidity(invalid ? 'Enter unique, valid email addresses.' : '');
      return;
    }

    elements.memberList.querySelectorAll('input').forEach((input, index) => {
      const normalized = normalizedEmails[index];
      const invalid = !aliasModel.looksLikeEmail(normalized) || counts.get(normalized) > 1;
      input.setAttribute('aria-invalid', String(invalid));
      input.setCustomValidity(invalid ? 'Enter a unique, valid email address.' : '');
    });
  }

  function displayValidationErrors(validation, candidate) {
    clearFormErrors();
    const { errors } = validation;

    if (errors.nickname) {
      elements.nicknameError.textContent = errors.nickname;
      elements.nickname.setAttribute('aria-invalid', 'true');
    }

    if (errors.email) {
      elements.emailError.textContent = errors.email;
      elements.personEmail.setAttribute('aria-invalid', 'true');
    }

    if (errors.emails) {
      elements.membersError.textContent = errors.emails;
      markGroupMemberErrors(candidate);
    }
  }

  async function saveEntry(event) {
    event.preventDefault();
    const candidate = collectCandidate();
    const validation = aliasModel.validateEntry(candidate, entries);

    if (!validation.valid) {
      displayValidationErrors(validation, candidate);
      return;
    }

    clearFormErrors();

    try {
      const saved = await storage.upsert(validation.entry);
      closeEditor();
      setPageStatus(`Saved “${saved.nickname}”.`, 'success');
    } catch (error) {
      if (error instanceof aliasModel.AliasValidationError) {
        displayValidationErrors({ errors: error.errors }, candidate);
        return;
      }

      elements.formStatus.textContent = error instanceof Error
        ? error.message
        : 'Could not save this entry.';
      elements.formStatus.hidden = false;
    }
  }

  async function exportBackup() {
    try {
      const savedEntries = await storage.getAll();
      const contents = backup.stringifyBackup(savedEntries);
      const url = root.URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
      const download = document.createElement('a');
      download.href = url;
      download.download = backup.createBackupFilename();
      download.hidden = true;
      document.body.appendChild(download);
      download.click();
      download.remove();
      root.setTimeout(() => root.URL.revokeObjectURL(url), 0);
      setPageStatus('Backup exported. Save the downloaded file somewhere private.', 'success');
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : 'Could not export the backup.');
    }
  }

  async function importBackup(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new backup.BackupValidationError('The backup file is too large.');
      }

      const restoredEntries = backup.parseBackup(await file.text());
      const personCount = restoredEntries.filter(
        entry => entry.type === aliasModel.ENTRY_TYPES.PERSON
      ).length;
      const groupCount = restoredEntries.filter(
        entry => entry.type === aliasModel.ENTRY_TYPES.GROUP
      ).length;
      const confirmed = root.confirm(
        `Replace your current data with ${personCount} ${personCount === 1 ? 'alias' : 'aliases'} and ${groupCount} ${groupCount === 1 ? 'group' : 'groups'} from this backup?`
      );

      if (!confirmed) {
        return;
      }

      await storage.replaceAll(restoredEntries);
      setPageStatus('Backup imported successfully.', 'success');
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : 'Could not import the backup.');
    } finally {
      elements.importBackupFile.value = '';
    }
  }

  document.getElementById('add-person').addEventListener('click', () => {
    openEditor(aliasModel.ENTRY_TYPES.PERSON);
  });
  document.getElementById('empty-add-person').addEventListener('click', () => {
    openEditor(aliasModel.ENTRY_TYPES.PERSON);
  });
  document.getElementById('add-group').addEventListener('click', () => {
    openEditor(aliasModel.ENTRY_TYPES.GROUP);
  });
  document.getElementById('empty-add-group').addEventListener('click', () => {
    openEditor(aliasModel.ENTRY_TYPES.GROUP);
  });
  elements.addMember.addEventListener('click', () => addMemberRow());
  elements.memberModeIndividual.addEventListener('click', () => setMemberInputMode('individual'));
  elements.memberModePaste.addEventListener('click', () => setMemberInputMode('paste'));
  document.getElementById('export-backup').addEventListener('click', exportBackup);
  document.getElementById('import-backup').addEventListener('click', () => {
    elements.importBackupFile.click();
  });
  elements.importBackupFile.addEventListener('change', importBackup);
  document.getElementById('close-dialog').addEventListener('click', closeEditor);
  document.getElementById('cancel-dialog').addEventListener('click', closeEditor);
  elements.form.addEventListener('submit', saveEntry);

  elements.dialog.addEventListener('click', event => {
    if (event.target === elements.dialog) {
      const rect = elements.dialog.getBoundingClientRect();
      const inside = event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
      if (!inside) {
        closeEditor();
      }
    }
  });

  storage.subscribe(render);
  storage.getAll()
    .then(savedEntries => {
      render(savedEntries);

      if (root.location.hash === '#add-person') {
        openEditor(aliasModel.ENTRY_TYPES.PERSON);
        root.history.replaceState(null, '', root.location.pathname);
      } else if (root.location.hash === '#add-group') {
        openEditor(aliasModel.ENTRY_TYPES.GROUP);
        root.history.replaceState(null, '', root.location.pathname);
      }
    })
    .catch(error => setPageStatus(error instanceof Error ? error.message : 'Could not load aliases.'));
})(globalThis);
