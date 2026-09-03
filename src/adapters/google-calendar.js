(function initialiseGoogleCalendarAdapter(root) {
  'use strict';

  const aliasModel = root.AliasBuddy?.core?.aliases;
  const resolver = root.AliasBuddy?.core?.resolver;

  const PEOPLE_INPUT_LABEL = 'Search for people to meet';
  const INPUT_CONTAINER_JSNAME = 'oA4zhb';
  const POPUP_GAP = 5;
  const GROUPS_ENABLED = true;

  function sleep(milliseconds) {
    return new Promise(resolve => root.setTimeout(resolve, milliseconds));
  }

  function isVisible(element) {
    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && root.getComputedStyle(element).visibility !== 'hidden';
  }

  class GoogleCalendarAdapter {
    constructor({ entries = [], enableGroups = GROUPS_ENABLED } = {}) {
      if (!aliasModel || !resolver) {
        throw new Error('AliasBuddy core modules must load before the Google Calendar adapter.');
      }

      this.entries = entries;
      this.enableGroups = enableGroups;
      this.popup = null;
      this.activeInput = null;
      this.currentMatches = [];
      this.rowElements = [];
      this.selectedIndex = -1;
      this.selectingNativeContact = false;
      this.suppressGoogleResults = false;
      this.hiddenGooglePopup = null;
      this.toast = null;
      this.toastTimer = null;
      this.duplicateHideTimers = new Set();
      this.observer = null;
      this.started = false;
      this.destroyed = false;

      this.handleInput = this.handleInput.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handlePointerdown = this.handlePointerdown.bind(this);
      this.reposition = this.reposition.bind(this);
      this.handleMutations = this.handleMutations.bind(this);
    }

    isSupportedPage() {
      return root.location.protocol === 'https:' && root.location.hostname === 'calendar.google.com';
    }

    start() {
      if (this.started || !this.isSupportedPage()) {
        return false;
      }

      this.started = true;
      this.destroyed = false;

      document.addEventListener('input', this.handleInput, true);
      document.addEventListener('keydown', this.handleKeydown, true);
      document.addEventListener('pointerdown', this.handlePointerdown, true);
      root.addEventListener('resize', this.reposition);
      root.addEventListener('scroll', this.reposition, true);

      this.observer = new MutationObserver(this.handleMutations);
      this.observer.observe(document.body, { childList: true, subtree: true });
      return true;
    }

    destroy() {
      if (!this.started) {
        return;
      }

      this.destroyed = true;
      this.started = false;
      document.removeEventListener('input', this.handleInput, true);
      document.removeEventListener('keydown', this.handleKeydown, true);
      document.removeEventListener('pointerdown', this.handlePointerdown, true);
      root.removeEventListener('resize', this.reposition);
      root.removeEventListener('scroll', this.reposition, true);
      this.observer?.disconnect();
      this.observer = null;
      this.clearDuplicateHideTimers();
      this.removePopup();
      this.removeToast();
      this.restoreGoogleResults();
      this.activeInput = null;
    }

    setEntries(entries) {
      this.entries = Array.isArray(entries) ? entries : [];

      if (this.activeInput?.isConnected && !this.selectingNativeContact) {
        this.processPeopleInput(this.activeInput);
      }
    }

    isPeopleInput(input) {
      return input instanceof HTMLInputElement
        && input.getAttribute('aria-label') === PEOPLE_INPUT_LABEL;
    }

    findPeopleInput() {
      const inputs = [...document.querySelectorAll(
        `input[aria-label="${PEOPLE_INPUT_LABEL}"][role="combobox"]`
      )];

      return inputs.find(input => input.isConnected && isVisible(input) && !input.disabled)
        || inputs.find(input => input.isConnected && !input.disabled)
        || null;
    }

    async waitForPeopleInput(timeout = 3000) {
      const started = Date.now();

      while (!this.destroyed && Date.now() - started < timeout) {
        const input = this.findPeopleInput();
        if (input) {
          return input;
        }

        await sleep(50);
      }

      return null;
    }

    getSelectedEmails() {
      const emails = new Set();

      // This semantic listbox and data attribute are stable PeopleKit hooks from the reference script.
      document.querySelectorAll(
        '[role="listbox"][aria-label="Selected people"] [data-email]'
      ).forEach(element => {
        const email = aliasModel.normalizeEmail(element.getAttribute('data-email'));
        if (email) {
          emails.add(email);
        }
      });

      return emails;
    }

    isEmailAlreadySelected(email) {
      return this.getSelectedEmails().has(aliasModel.normalizeEmail(email));
    }

    getInputContainer(input) {
      // jsname is retained because it is the proven way to align with the complete visible PeopleKit field.
      return input.closest(`[jsname="${INPUT_CONTAINER_JSNAME}"]`)
        || input.parentElement
        || input;
    }

    removePopup() {
      this.popup?.remove();
      this.popup = null;
      this.currentMatches = [];
      this.rowElements = [];
      this.selectedIndex = -1;
    }

    positionPopup(input) {
      if (!this.popup || !input?.isConnected) {
        return;
      }

      const inputRect = this.getInputContainer(input).getBoundingClientRect();
      const popupRect = this.popup.getBoundingClientRect();

      this.popup.style.left = `${inputRect.left}px`;
      this.popup.style.width = `${inputRect.width}px`;
      this.popup.style.top = `${inputRect.top - popupRect.height - POPUP_GAP}px`;
    }

    updateSelection() {
      this.rowElements.forEach((row, index) => {
        const selected = index === this.selectedIndex;
        row.dataset.selected = String(selected);
        row.setAttribute('aria-selected', String(selected));
      });
    }

    createResult(match, index) {
      const { nickname, entry } = match;
      const row = document.createElement('div');
      row.className = 'alias-buddy-calendar-result';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.dataset.selected = 'false';

      const avatar = document.createElement('div');
      avatar.className = 'alias-buddy-calendar-avatar';
      avatar.setAttribute('aria-hidden', 'true');

      if (entry.type === aliasModel.ENTRY_TYPES.GROUP) {
        avatar.classList.add('alias-buddy-calendar-avatar--group');
        avatar.textContent = '👥';
      } else {
        avatar.textContent = nickname.charAt(0).toUpperCase();
      }

      const textContainer = document.createElement('div');
      textContainer.className = 'alias-buddy-calendar-copy';

      const nicknameElement = document.createElement('div');
      nicknameElement.className = 'alias-buddy-calendar-nickname';
      nicknameElement.textContent = nickname;

      const detailsElement = document.createElement('div');
      detailsElement.className = 'alias-buddy-calendar-details';

      if (entry.type === aliasModel.ENTRY_TYPES.PERSON) {
        detailsElement.textContent = entry.email;
      } else {
        const total = resolver.getEntryEmails(entry).length;
        const remaining = resolver.getRemainingEmails(entry, this.getSelectedEmails()).length;
        detailsElement.textContent = remaining === total
          ? `${total} ${total === 1 ? 'person' : 'people'}`
          : `${remaining} of ${total} people remaining`;
      }

      textContainer.append(nicknameElement, detailsElement);
      row.append(avatar, textContainer);

      row.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.updateSelection();
      });

      row.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        void this.selectAlias(index);
      });

      return row;
    }

    renderAliasResults(input, matches) {
      this.removePopup();

      if (!matches.length) {
        return;
      }

      this.activeInput = input;
      this.currentMatches = matches;
      this.selectedIndex = -1;

      const popup = document.createElement('div');
      popup.className = 'alias-buddy-calendar-popup';
      popup.setAttribute('role', 'listbox');
      popup.setAttribute('aria-label', 'AliasBuddy results');

      this.rowElements = matches.map((match, index) => {
        const row = this.createResult(match, index);
        popup.appendChild(row);
        return row;
      });

      this.popup = popup;
      document.body.appendChild(popup);
      this.positionPopup(input);
    }

    findGoogleResultsPopup(input) {
      const listboxId = input?.getAttribute('aria-controls');
      const listbox = listboxId ? document.getElementById(listboxId) : null;

      if (!listbox) {
        return null;
      }

      // Prefer the semantic listbox parent. The known wrapper selector is a compatibility fallback
      // retained from the working userscript, not the sole dependency.
      return listbox.closest('.OFaVze.RuSUmb') || listbox.parentElement;
    }

    hideGoogleResults(input) {
      if (!this.suppressGoogleResults) {
        return;
      }

      const googlePopup = this.findGoogleResultsPopup(input);
      if (!googlePopup) {
        return;
      }

      if (this.hiddenGooglePopup?.element !== googlePopup) {
        this.restoreGoogleResults();
        this.hiddenGooglePopup = {
          element: googlePopup,
          value: googlePopup.style.getPropertyValue('display'),
          priority: googlePopup.style.getPropertyPriority('display')
        };
      }

      googlePopup.style.setProperty('display', 'none', 'important');
    }

    restoreGoogleResults() {
      if (!this.hiddenGooglePopup) {
        return;
      }

      const { element, value, priority } = this.hiddenGooglePopup;
      if (element.isConnected) {
        if (value) {
          element.style.setProperty('display', value, priority);
        } else {
          element.style.removeProperty('display');
        }
      }

      this.hiddenGooglePopup = null;
    }

    setInputValue(input, value) {
      if (!input?.isConnected) {
        return;
      }

      input.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

      if (setter) {
        setter.call(input, value);
      } else {
        input.value = value;
      }

      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: value
      }));
    }

    clearSearchInput(input) {
      if (input?.isConnected) {
        this.setInputValue(input, '');
      }
    }

    waitForGooglePerson(input, email, timeout = 5000) {
      const targetEmail = aliasModel.normalizeEmail(email);

      return new Promise(resolve => {
        const started = Date.now();

        const check = () => {
          if (this.destroyed) {
            resolve(null);
            return;
          }

          // PeopleKit can replace both the input and its listbox during a search.
          const currentInput = this.findPeopleInput() || input;
          const listboxId = currentInput?.getAttribute('aria-controls');
          const listbox = listboxId ? document.getElementById(listboxId) : null;

          if (listbox) {
            const options = [...listbox.querySelectorAll('[role="option"]')];
            const match = options.find(option => {
              const pkdTarget = (option.getAttribute('pkd-target') || '').toLowerCase();
              const hovercardEmail = (
                option.querySelector('[data-hovercard-id]')?.getAttribute('data-hovercard-id') || ''
              ).toLowerCase();
              const text = (option.textContent || '').toLowerCase();

              return pkdTarget.includes(targetEmail)
                || hovercardEmail === targetEmail
                || text.includes(targetEmail);
            });

            if (match) {
              resolve(match);
              return;
            }
          }

          if (Date.now() - started >= timeout) {
            resolve(null);
            return;
          }

          root.requestAnimationFrame(check);
        };

        check();
      });
    }

    async waitForSelectedEmail(email, timeout = 5000) {
      const targetEmail = aliasModel.normalizeEmail(email);
      const started = Date.now();

      while (!this.destroyed && Date.now() - started < timeout) {
        if (this.isEmailAlreadySelected(targetEmail)) {
          return true;
        }

        await sleep(50);
      }

      return false;
    }

    clickGoogleOption(option) {
      option.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse'
      }));
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      option.click();
    }

    async selectPerson(email, maxAttempts = 3) {
      const normalizedEmail = aliasModel.normalizeEmail(email);

      if (this.isEmailAlreadySelected(normalizedEmail)) {
        return true;
      }

      for (let attempt = 1; attempt <= maxAttempts && !this.destroyed; attempt += 1) {
        let input = await this.waitForPeopleInput(3000);
        if (!input) {
          await sleep(400);
          continue;
        }

        this.clearSearchInput(input);
        await sleep(150);
        input = this.findPeopleInput() || input;
        this.setInputValue(input, normalizedEmail);

        const option = await this.waitForGooglePerson(input, normalizedEmail, 5000);
        if (!option) {
          this.clearSearchInput(this.findPeopleInput());
          await sleep(500);
          continue;
        }

        this.clickGoogleOption(option);
        if (await this.waitForSelectedEmail(normalizedEmail, 5000)) {
          await sleep(700);
          return true;
        }

        this.clearSearchInput(this.findPeopleInput());
        await sleep(600);
      }

      return false;
    }

    async addPerson(entry) {
      const email = aliasModel.normalizeEmail(entry.email);
      if (!email || this.isEmailAlreadySelected(email)) {
        return;
      }

      if (!await this.selectPerson(email, 3)) {
        this.showToast(`Could not add ${email}`, 4000);
      }
    }

    async selectGroup(entry) {
      if (!this.enableGroups) {
        return { added: [], skipped: [], failed: resolver.getEntryEmails(entry) };
      }

      const emails = resolver.getEntryEmails(entry);
      const initiallySelected = this.getSelectedEmails();
      const remaining = emails.filter(email => !initiallySelected.has(email));
      const added = [];
      const failed = [];
      const skipped = emails.filter(email => initiallySelected.has(email));

      if (!remaining.length) {
        this.showToast(`${entry.nickname} is already added`);
        return { added, skipped, failed };
      }

      // Groups intentionally use the same native selection path one member at a time.
      for (const email of remaining) {
        if (this.isEmailAlreadySelected(email)) {
          skipped.push(email);
          continue;
        }

        if (await this.selectPerson(email, 3)) {
          added.push(email);
        } else {
          failed.push(email);
        }

        await sleep(700);
      }

      if (!failed.length) {
        this.showToast(`Added ${added.length} ${added.length === 1 ? 'person' : 'people'} from ${entry.nickname}`);
      } else {
        this.showToast(
          `Added ${added.length} of ${remaining.length} people. Could not find ${failed.join(', ')}`,
          6500
        );
      }

      return { added, skipped, failed };
    }

    async selectAlias(index) {
      const match = this.currentMatches[index];
      if (!match) {
        return;
      }

      const { entry } = match;
      this.removePopup();
      this.selectingNativeContact = true;
      this.suppressGoogleResults = false;
      this.clearDuplicateHideTimers();
      this.restoreGoogleResults();

      try {
        if (entry.type === aliasModel.ENTRY_TYPES.GROUP) {
          await this.selectGroup(entry);
        } else {
          await this.addPerson(entry);
        }
      } finally {
        this.selectingNativeContact = false;
      }
    }

    clearDuplicateHideTimers() {
      this.duplicateHideTimers.forEach(timer => root.clearTimeout(timer));
      this.duplicateHideTimers.clear();
    }

    scheduleDuplicateResultHiding(input) {
      this.clearDuplicateHideTimers();
      [0, 50, 150, 300].forEach(delay => {
        const timer = root.setTimeout(() => {
          this.duplicateHideTimers.delete(timer);
          this.hideGoogleResults(input);
        }, delay);
        this.duplicateHideTimers.add(timer);
      });
    }

    processPeopleInput(input) {
      this.activeInput = input;
      const query = input.value.trim().toLowerCase();
      const selectedEmails = this.getSelectedEmails();

      if (resolver.shouldSuppressNativeDuplicate(query, selectedEmails)) {
        this.removePopup();
        this.suppressGoogleResults = true;
        this.hideGoogleResults(input);
        this.scheduleDuplicateResultHiding(input);
        return;
      }

      this.clearDuplicateHideTimers();
      this.suppressGoogleResults = false;
      this.restoreGoogleResults();

      const matches = resolver.resolve(query, this.entries, selectedEmails)
        .filter(match => this.enableGroups || match.entry.type !== aliasModel.ENTRY_TYPES.GROUP);

      if (!matches.length) {
        this.removePopup();
        return;
      }

      this.renderAliasResults(input, matches);
    }

    handleInput(event) {
      if (!this.isPeopleInput(event.target) || this.selectingNativeContact) {
        return;
      }

      this.processPeopleInput(event.target);
    }

    handleKeydown(event) {
      if (!this.isPeopleInput(event.target)) {
        return;
      }

      if (event.shiftKey && event.key === 'ArrowUp' && this.currentMatches.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.selectedIndex = this.selectedIndex === -1
          ? this.currentMatches.length - 1
          : Math.max(0, this.selectedIndex - 1);
        this.updateSelection();
        return;
      }

      if (event.shiftKey && event.key === 'ArrowDown' && this.currentMatches.length) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (this.selectedIndex === -1) {
          return;
        }

        this.selectedIndex = this.selectedIndex < this.currentMatches.length - 1
          ? this.selectedIndex + 1
          : -1;
        this.updateSelection();
        return;
      }

      // Unmodified arrow keys remain entirely owned by Google's native listbox.
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (this.selectedIndex !== -1) {
          this.selectedIndex = -1;
          this.updateSelection();
        }
        return;
      }

      if (event.key === 'Enter' && this.selectedIndex >= 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void this.selectAlias(this.selectedIndex);
        return;
      }

      // Clear only AliasBuddy's highlight and allow Google to handle Escape normally.
      if (event.key === 'Escape') {
        this.selectedIndex = -1;
        this.updateSelection();
      }
    }

    handlePointerdown(event) {
      if (this.popup
        && !this.popup.contains(event.target)
        && event.target !== this.activeInput) {
        this.removePopup();
      }
    }

    handleMutations() {
      // Google can recreate PeopleKit after an input event; re-hide only exact selected-email results.
      if (this.suppressGoogleResults && this.activeInput) {
        this.hideGoogleResults(this.activeInput);
      }
    }

    removeToast() {
      if (this.toastTimer) {
        root.clearTimeout(this.toastTimer);
        this.toastTimer = null;
      }

      this.toast?.remove();
      this.toast = null;
    }

    showToast(message, duration = 3000) {
      this.removeToast();
      const toast = document.createElement('div');
      toast.className = 'alias-buddy-calendar-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.textContent = message;
      document.body.appendChild(toast);
      this.toast = toast;

      this.toastTimer = root.setTimeout(() => this.removeToast(), duration);
    }

    reposition() {
      if (this.popup && this.activeInput) {
        this.positionPopup(this.activeInput);
      }
    }
  }

  root.AliasBuddy = root.AliasBuddy || {};
  root.AliasBuddy.adapters = root.AliasBuddy.adapters || {};
  root.AliasBuddy.adapters.GoogleCalendarAdapter = GoogleCalendarAdapter;
  root.AliasBuddy.adapters.contract?.register(
    'google-calendar',
    options => new GoogleCalendarAdapter(options)
  );

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleCalendarAdapter, GROUPS_ENABLED };
  }
})(globalThis);
