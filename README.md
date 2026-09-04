# AliasBuddy

AliasBuddy is a local-first, cross-browser extension that lets you use memorable nicknames when searching for people in supported web applications.

The first adapter supports Google Calendar. Type at least two characters of a saved nickname in Calendar's **Search for people to meet** field, choose the AliasBuddy result, and the extension asks Google's native PeopleKit autocomplete to select the real contact. AliasBuddy never creates a fake contact or selected-person chip.

## Features

- Person aliases: one nickname mapped to one email address
- Group aliases: one nickname mapped to several email addresses
- Exclusive individual and paste-list group views, with two-way email synchronization
- Group cloning that opens an unsaved copy with a unique nickname
- Versioned JSON backup export and validated restore
- Case-insensitive nickname matching after two characters
- Local storage with the standard WebExtensions storage API
- Full add, edit, and delete management UI
- Compact toolbar popup with alias and group totals
- Google Calendar adapter based on the working userscript behavior
- Sequential native selection for groups, including skips, retries, and a completion summary
- No server, account, analytics, or external API
- No broad host access: only `https://calendar.google.com/*`
- One WXT codebase with dedicated Chrome, Microsoft Edge, and Firefox builds

AliasBuddy starts empty. Add entries through its settings page; source-code editing is never required.

## Supported browsers

- **Google Chrome:** dedicated Manifest V3 build
- **Microsoft Edge:** dedicated Manifest V3 build
- **Mozilla Firefox 142+:** dedicated Manifest V3 desktop build
- **Other Chromium browsers:** Brave, Opera, Vivaldi, Arc, and Chromium itself can use the Chrome build

Safari is not currently packaged. It requires Apple-specific conversion, signing, and testing.

### Extension identities

- **Chrome, Edge, and other unpacked Chromium browsers:** `gpjnielbcjljbgipeglbkdigfdbbmokn`
- **Firefox:** `aliasbuddy@local.extension`

The Chromium builds include the same public key, so their development ID remains stable when the build directory moves or is replaced. The public key is intentionally committed; never commit or distribute its corresponding private key. Browser stores can assign separate catalog IDs to their published packages.

## Build and install locally

Install dependencies and create every browser build:

```bash
npm install
npm run build
```

Then load the appropriate output:

### Chrome and other Chromium browsers

1. Open `chrome://extensions` in Chrome, or the equivalent extensions page in your Chromium browser.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `.output/chrome-mv3`.
5. Pin AliasBuddy from Chrome's Extensions menu if you want quick access.
6. Click the AliasBuddy icon and select **Add alias**, **Add group**, or **Manage AliasBuddy**.
7. Reload any Google Calendar tab that was already open.

### Microsoft Edge

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose `.output/edge-mv3`.
4. Reload any Google Calendar tab that was already open.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose `.output/firefox-mv3/manifest.json`.
4. Reload any Google Calendar tab that was already open.

Temporary Firefox add-ons are removed when Firefox closes. Permanent Firefox installation requires a build signed by Mozilla Add-ons.

### Existing aliases and groups

Extension storage is separate for every browser and extension ID. Before migrating an older unpacked AliasBuddy installation that did not use the permanent Chromium ID, export a backup from **Manage AliasBuddy** and keep the old extension installed. Load the permanent-ID build separately, import the backup, verify the aliases and groups, and only then remove the old installation. Future builds that retain the configured IDs update without changing their storage identity.

## Development

Node.js 20 or newer is recommended for the local checks.

```bash
npm test
npm run build
npm run validate
npm run check
```

Run a specific browser during development:

```bash
npm run dev
npm run dev:edge
npm run dev:firefox
```

To create validated browser packages:

```bash
npm run package
```

The command writes these packages to `dist/`:

- `alias-buddy-v<version>-chrome.zip`
- `alias-buddy-v<version>-edge.zip`
- `alias-buddy-v<version>-firefox.zip`

The Firefox ZIP must be signed by Mozilla before it can be installed permanently in standard Firefox releases.

## Automated releases

Every push to `main`, including a merged pull request, runs the release workflow. It reads the version from `package.json` and checks for the corresponding `v<version>` GitHub release. If that release does not exist, the workflow runs the tests, builds and validates all browser packages, creates the Git tag, and publishes a GitHub release containing separate Chrome, Edge, and Firefox ZIP files.

Increment the version in `package.json` before merging a release. Commits that retain an already-published version pass without creating a duplicate tag or release.

## Architecture

```text
entrypoints/
  google-calendar.content.js  WXT content-script entrypoint
  popup/                      Toolbar popup entrypoint
    index.html
    main.js
  options/                    Management-page entrypoint
    index.html
    main.js
src/
  core/
    aliases.js          Data normalization and validation
    storage.js          Cross-browser extension storage repository
    resolver.js         Nickname-only matching and duplicate filtering
  adapters/
    adapter.js          Adapter contract and registry
    google-calendar.js  PeopleKit discovery and native selection
    google-calendar.css Injected Calendar result and toast styles
  popup/
    popup.js
    popup.css
  options/
    options.js
    options.css
  content.js            Generic adapter bootstrap and storage subscription
icons/
tests/
scripts/
wxt.config.mjs          Shared manifest and browser-specific settings
```

WXT generates each browser's `manifest.json` under `.output/<browser>-mv3/`. The application logic and saved-data schema remain shared.

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
4. Add only that application's precise host pattern to `wxt.config.mjs` and register its WXT content-script entrypoint.
5. Use the shared resolver and storage modules. Do not add application selectors to the core.
6. Make `selectPerson` finish through the application's real result and verify its real selected-person UI before reporting success.
7. Add adapter-specific manual tests and cleanup for listeners, observers, and injected UI.

The popup, settings page, data model, storage, and generic `content.js` bootstrap do not need to change.

## Backup and restore

Open **Manage AliasBuddy** and use the **Backup** section:

- **Export backup** downloads a dated `aliasbuddy-backup-YYYY-MM-DD.json` file. Move that file into a private Google Drive folder or another safe location.
- **Import backup** validates a selected AliasBuddy backup and shows its alias/group totals before asking permission to replace the current data.

Import is atomic: AliasBuddy validates every entry before writing anything. Cancelling the confirmation or selecting an invalid file leaves the current data unchanged. Backup files contain readable nicknames and email addresses, so keep them private.

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

## Backup-testing checklist

- [ ] Export a populated dataset and confirm a dated JSON file downloads.
- [ ] Inspect the JSON and confirm it contains the backup format, version, export timestamp, and entries.
- [ ] Cancel an import at the confirmation prompt and confirm current data remains unchanged.
- [ ] Import a valid backup and confirm aliases and groups are restored.
- [ ] Try malformed JSON, an unsupported backup version, duplicate nicknames, and invalid emails; each must be rejected without changing current data.
- [ ] Export an empty dataset and confirm it can be restored intentionally after confirmation.

## Group-testing checklist

- [ ] Create a group with two or more valid, unique email addresses.
- [ ] Confirm only one member-entry view is visible at a time.
- [ ] Enter addresses individually, switch to **Paste emails**, and confirm every address appears in the text area.
- [ ] Update the pasted list, switch to **Add individually**, and confirm every pasted address becomes its own field.
- [ ] Switch between both views again and confirm no email is lost.
- [ ] Paste comma-, semicolon-, and new-line-separated addresses, save, and confirm every member is retained.
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

AliasBuddy stores aliases and group membership only in the browser's local extension storage. It does not transmit them anywhere. See [PRIVACY.md](PRIVACY.md) for the store-ready disclosure.

## Troubleshooting

- Reload the Calendar tab after installing or reloading the unpacked extension.
- Confirm the page is served from `https://calendar.google.com/`.
- Confirm the event editor currently shows **Search for people to meet**.
- If Google changes PeopleKit's DOM, inspect the semantic attributes documented in the Calendar adapter before introducing generated CSS selectors.
- Open the Calendar tab's DevTools console for the local startup error if the adapter cannot initialize.
