# AliasBuddy

AliasBuddy is a local-first Chrome extension that lets you use memorable nicknames when searching for people in supported web applications.

The first adapter supports Google Calendar. Type at least two characters of a saved nickname in Calendar's **Search for people to meet** field, choose the AliasBuddy result, and the extension asks Google's native PeopleKit autocomplete to select the real contact. AliasBuddy never creates a fake contact or selected-person chip.

## Features

- Person aliases: one nickname mapped to one email address
- Group aliases: one nickname mapped to several email addresses
- Individual or paste-list group editing, with comma, semicolon, and new-line support
- Group cloning that opens an unsaved copy with a unique nickname
- Case-insensitive nickname matching after two characters
- Local storage with `chrome.storage.local`
- Full add, edit, and delete management UI
- Compact toolbar popup with alias and group totals
- Google Calendar adapter based on the working userscript behavior
- Sequential native selection for groups, including skips, retries, and a completion summary
- No server, account, analytics, or external API
- No broad host access: only `https://calendar.google.com/*`

AliasBuddy starts empty. Add entries through its settings page; source-code editing is never required.

## Install in Chrome

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository root—the directory containing `manifest.json`.
6. Pin AliasBuddy from Chrome's Extensions menu if you want quick access.
7. Click the AliasBuddy icon and select **Add alias**, **Add group**, or **Manage AliasBuddy**.
8. Reload any Google Calendar tab that was already open.

No build step is required. Chrome loads the checked-in JavaScript, HTML, and CSS directly.

## Development

Node.js 20 or newer is recommended for the local checks.

```bash
npm test
npm run validate
npm run check
```

To create a Chrome Web Store-ready zip:

```bash
npm run package
```

The package is written to `dist/` and intentionally excludes tests, development scripts, and repository metadata.

## Architecture

```text
manifest.json
src/
  core/
    aliases.js          Data normalization and validation
    storage.js          chrome.storage.local repository
    resolver.js         Nickname-only matching and duplicate filtering
  adapters/
    adapter.js          Adapter contract and registry
    google-calendar.js  PeopleKit discovery and native selection
    google-calendar.css Injected Calendar result and toast styles
  popup/
    popup.html
    popup.js
    popup.css
  options/
    options.html
    options.js
    options.css
  content.js            Generic adapter bootstrap and storage subscription
icons/
tests/
scripts/
```

The core has no Google Calendar selectors or behavior. The popup and settings page know only about the shared data model and storage repository. Application-specific DOM work lives inside adapters.

### Data model

Person alias:

```json
{
  "id": "generated-id",
  "type": "person",
  "nickname": "sunshine",
  "email": "person@example.com"
}
```

Group alias:

```json
{
  "id": "generated-id",
  "type": "group",
  "nickname": "book-club",
  "emails": [
    "member.one@example.com",
    "member.two@example.com"
  ]
}
```

Nicknames must be unique case-insensitively across people and groups. Group emails must also be unique case-insensitively within that group.

## Google Calendar behavior

The adapter preserves the important mechanics from the reference userscript:

- It recognizes `aria-label="Search for people to meet"`.
- It matches nickname prefixes only; it does not match email addresses or real names.
- AliasBuddy results appear above and align with the complete visible PeopleKit input container.
- Selecting a result replaces the search with the real email, waits for Google's `[role="option"]`, and clicks that native option.
- Success is accepted only after Google's selected-people list contains a chip with the target `data-email`.
- Already-selected emails are removed from AliasBuddy results.
- An exact already-selected email query suppresses Google's duplicate result.
- Unmodified Up and Down remain Google's controls. Shift+Up and Shift+Down navigate AliasBuddy, Enter selects the highlighted alias, and Escape clears only the AliasBuddy highlight.
- Dynamic inputs and listboxes are reacquired because PeopleKit can rerender them.
- Groups add one member at a time and continue after a member cannot be resolved.

The known Calendar-specific hooks are documented in `src/adapters/google-calendar.js`. Semantic attributes are preferred. One legacy wrapper selector from the reference script remains as a compatibility fallback, not a sole dependency.

See [Google Calendar reference behavior](docs/google-calendar-reference.md) for the regression-sensitive mapping from the supplied userscript to the adapter.

## Add another application adapter

1. Create an adapter file under `src/adapters/`.
2. Implement the contract from `adapter.js`:
   - `isSupportedPage()`
   - `findPeopleInput()`
   - `renderAliasResults()`
   - `selectPerson(email)`
   - `getSelectedEmails()`
3. Register a factory with `AliasBuddy.adapters.contract.register(...)`.
4. Add only that application's precise host pattern and adapter script to `manifest.json`.
5. Use the shared resolver and storage modules. Do not add application selectors to the core.
6. Make `selectPerson` finish through the application's real result and verify its real selected-person UI before reporting success.
7. Add adapter-specific manual tests and cleanup for listeners, observers, and injected UI.

The popup, settings page, data model, storage, and generic `content.js` bootstrap do not need to change.

## Google Calendar manual testing checklist

- [ ] Add a person alias in settings and confirm it appears after reopening the page.
- [ ] Type one nickname character in Calendar; no AliasBuddy result appears.
- [ ] Type two or more nickname-prefix characters in different letter cases; the alias appears.
- [ ] Search by the saved email or contact's real name; AliasBuddy does not match it.
- [ ] Confirm the custom result is above and aligned with the complete people input container.
- [ ] Confirm the result displays only the nickname and email.
- [ ] Click the alias and confirm Google's native selected-person chip appears.
- [ ] Confirm no manually constructed AliasBuddy chip exists.
- [ ] With the alias list open, press normal Up and Down; Google keeps its normal navigation.
- [ ] Press Shift+Up and Shift+Down; the AliasBuddy highlight moves as expected.
- [ ] Press Enter on a highlighted alias; the native Google contact is selected.
- [ ] Press Escape; the AliasBuddy highlight clears and Google's Escape behavior still runs.
- [ ] Select the person, then search the nickname again; that alias is not offered.
- [ ] Type the exact email of an already-selected person; duplicate results are suppressed.
- [ ] Edit and delete aliases in settings; an open Calendar tab reflects storage changes.
- [ ] Resize and scroll with results open; the popup stays aligned.
- [ ] Navigate within Calendar until its event UI rerenders; AliasBuddy does not duplicate listeners or popups.
- [ ] Reload the extension and then reload Calendar; AliasBuddy starts once and continues working.

## Group-testing checklist

- [ ] Create a group with two or more valid, unique email addresses.
- [ ] Switch to **Paste list**, paste comma-separated addresses, save, and confirm every member is retained.
- [ ] Switch between **Individual fields** and **Paste list** and confirm no member is lost.
- [ ] Confirm empty nicknames, invalid emails, and duplicate group emails are rejected.
- [ ] Clone a group and confirm the form opens with copied members, a new ID, and a unique copy nickname.
- [ ] Save the clone and confirm the original group remains unchanged.
- [ ] Type two characters of the group nickname and confirm the group result appears.
- [ ] Select the group and verify each member is searched and selected sequentially, never simultaneously.
- [ ] Confirm every successful member appears as Google's native selected-person chip before the next search begins.
- [ ] Preselect one group member, choose the group, and confirm that member is skipped.
- [ ] Preselect every member and confirm the group result is no longer offered.
- [ ] Include one address that Google cannot resolve; remaining members are still attempted.
- [ ] Confirm the final toast reports how many people were added and lists unresolved addresses.
- [ ] Close or rerender the Calendar event editor during insertion and confirm the operation fails safely without fake chips.

## Privacy

AliasBuddy stores aliases and group membership only in `chrome.storage.local`. It does not transmit them anywhere. See [PRIVACY.md](PRIVACY.md) for a Chrome Web Store-ready disclosure.

## Troubleshooting

- Reload the Calendar tab after installing or reloading the unpacked extension.
- Confirm the page is served from `https://calendar.google.com/`.
- Confirm the event editor currently shows **Search for people to meet**.
- If Google changes PeopleKit's DOM, inspect the semantic attributes documented in the Calendar adapter before introducing generated CSS selectors.
- Open the Calendar tab's DevTools console for the local startup error if the adapter cannot initialize.
