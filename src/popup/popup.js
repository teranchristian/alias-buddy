(function initialisePopup(root) {
  'use strict';

  const storage = root.AliasBuddy.core.storage.createStorage(root.chrome);
  const aliasModel = root.AliasBuddy.core.aliases;
  const aliasCount = document.getElementById('alias-count');
  const aliasLabel = document.getElementById('alias-label');
  const groupCount = document.getElementById('group-count');
  const groupLabel = document.getElementById('group-label');
  const status = document.getElementById('status');

  function renderCounts(entries) {
    const people = entries.filter(entry => entry.type === aliasModel.ENTRY_TYPES.PERSON).length;
    const groups = entries.filter(entry => entry.type === aliasModel.ENTRY_TYPES.GROUP).length;

    aliasCount.textContent = String(people);
    aliasLabel.textContent = people === 1 ? 'alias' : 'aliases';
    groupCount.textContent = String(groups);
    groupLabel.textContent = groups === 1 ? 'group' : 'groups';
  }

  function showError(error) {
    status.textContent = error instanceof Error ? error.message : 'Could not read saved aliases.';
    status.hidden = false;
  }

  document.getElementById('add-alias').addEventListener('click', () => {
    const url = root.chrome.runtime.getURL('src/options/options.html#add-person');
    root.chrome.tabs.create({ url });
  });

  document.getElementById('add-group').addEventListener('click', () => {
    const url = root.chrome.runtime.getURL('src/options/options.html#add-group');
    root.chrome.tabs.create({ url });
  });

  document.getElementById('manage').addEventListener('click', () => {
    root.chrome.runtime.openOptionsPage();
  });

  storage.getAll().then(renderCounts).catch(showError);
  storage.subscribe(renderCounts);
})(globalThis);
