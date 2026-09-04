# AliasBuddy

AliasBuddy is a local-first, cross-browser extension that lets you use memorable nicknames when searching for people in supported web applications.

The first adapter supports Google Calendar. Type at least two characters of a saved nickname in Calendar's **Search for people to meet** field, choose the AliasBuddy result, and the extension asks Google's native PeopleKit autocomplete to select the real contact. AliasBuddy never creates a fake contact or selected-person chip.

## Features

- Person aliases: one nickname mapped to one email address
- Group aliases: one nickname mapped to several email addresses
- Exclusive individual and paste-list group views, with two-way email synchronization
- Group cloning that opens an unsaved copy with a unique nickname
- Automatic same-browser-family synchronization through the browser's `storage.sync` API when available
- Local cache/fallback through `storage.local`
- Versioned JSON backup export and validated restore for durable and cross-browser backups
- Case-insensitive nickname matching after two characters
- Full add, edit, and delete management UI
- Compact toolbar popup with alias and group totals
- Google Calendar adapter based on the working userscript behavior
- Sequential native selection for groups, including skips, retries, and a completion summary
- No AliasBuddy server, account, analytics, or custom sync API
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

Stable extension identities are also important for browser-native extension storage and sync.

## Browser sync

AliasBuddy keeps the active dataset in local extension storage and mirrors aliases/groups into the browser's built-in `storage.sync` area when that API is available.

This requires no AliasBuddy account, OAuth application, API key, or backend. The browser vendor handles account sync.

Browser sync is **not cross-browser**:

- Chrome/Chromium installations use their browser sync ecosystem.
- Edge installations use Edge sync.
- Firefox installations use Firefox Sync when extension-data sync is available and enabled.
- Chrome, Edge, and Firefox do not automatically share one AliasBuddy dataset with each other.

Each alias/group is stored as an individual sync item instead of writing the entire AliasBuddy dataset as one large object. Existing local-only users are migrated automatically on first run of the sync-enabled version.

Browser-native sync is a convenience, not a guaranteed uninstall-safe backup. Use JSON export/import for a durable copy or to move data between browser families.

See [Browser-native sync](docs/browser-sync.md) for migration, conflict behavior, failure handling, and the manual sync testing checklist.

## Build and install locally

Install dependencies and create every browser build:

```bash
npm install
npm run build
```

Then load the appropriate output.

### Chrome and other Chromium browsers

1. Open `chrome://extensions` in Chrome, or the equivalent extensions page in your Chromium browser.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `.output/chrome-mv3`.
5. Pin AliasBuddy from the Extensions menu if you want quick access.
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

If an older AliasBuddy installation used a different extension ID, its storage is a different namespace. Export a backup before removing the old extension, load the stable-ID build, import the backup, verify the aliases/groups, and only then remove the old installation.

When upgrading an existing installation that already uses AliasBuddy's configured stable ID, the sync-enabled storage layer preserves the local dataset and performs a one-time migration into browser sync.

## Development

Node.js 20 or newer is recommended for local checks.

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

Create validated browser packages with:

```bash
npm run package
```

The command writes:

- `dist/alias-buddy-v<version>-chrome.zip`
- `dist/alias-buddy-v<version>-edge.zip`
- `dist/alias-buddy-v<version>-firefox.zip`

The Firefox ZIP must be signed by Mozilla before permanent installation in standard Firefox releases.

## Architecture

```text
entrypoints/
  google-calendar.content.js  WXT content-script entrypoint
  popup/                      Toolbar popup entrypoint
  options/                    Management-page entrypoint
src/
  core/
    aliases.js          Data normalization and validation
    storage.js          Local cache + browser-native sync repository
    backup.js           Versioned JSON backup/restore format
    resolver.js         Nickname-only matching and duplicate filtering
  adapters/
    adapter.js          Adapter contract and registry
    google-calendar.js  PeopleKit discovery and native selection
    google-calendar.css Injected Calendar result and toast styles
  popup/
  options/
  content.js            Generic adapter bootstrap and storage subscription
icons/
tests/
docs/
scripts/
wxt.config.mjs          Shared manifest and browser-specific settings
```

WXT generates each browser's `manifest.json` under `.output/<browser>-mv3/`. Application logic and the saved-data schema remain shared.

The core has no Google Calendar selectors or behavior. The popup and settings page know only about the shared data model and storage repository. Application-specific DOM work lives inside adapters.

### Storage model

The local document remains versioned under `aliasBuddyData`. Browser sync additionally uses one metadata item and one item per alias/group.

The metadata distinguishes an intentional empty dataset from unexpectedly missing sync state. If all aliases are deliberately removed, zero entries with valid metadata can propagate. If sync metadata unexpectedly disappears while an installed instance still has local data, that instance can republish its local copy instead of treating missing metadata as an intentional delete-all.

Local writes happen first. If browser sync is unavailable or rejects a write, AliasBuddy remains usable from its local copy.

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

## Backup and restore

Open **Manage AliasBuddy** and use **Sync & backup**:

- Browser sync automatically mirrors active data within the same browser ecosystem when available.
- **Export backup** downloads a dated `aliasbuddy-backup-YYYY-MM-DD.json` file. Keep it somewhere private and outside the extension.
- **Import backup** validates the selected AliasBuddy backup and shows its alias/group totals before asking permission to replace the current dataset.

Import is atomic: AliasBuddy validates every entry before writing anything. Cancelling the confirmation or selecting an invalid file leaves current data unchanged.

Backup files contain readable nicknames and email addresses. Keep them private. JSON backup is the durable and cross-browser recovery mechanism; browser sync is not a replacement for it.

## Manual testing

### Google Calendar

- [ ] Add a person alias in settings and confirm it appears after reopening the page.
- [ ] Type one nickname character in Calendar; no AliasBuddy result appears.
- [ ] Type two or more nickname-prefix characters in different letter cases; the alias appears.
- [ ] Search by the saved email or contact's real name; AliasBuddy does not match it.
- [ ] Click the alias and confirm Google's native selected-person chip appears.
- [ ] Confirm no manually constructed AliasBuddy chip exists.
- [ ] Press Shift+Up / Shift+Down and confirm AliasBuddy navigation works while normal Up/Down remain Google's controls.
- [ ] Edit and delete aliases in settings; an open Calendar tab reflects storage changes.
- [ ] Reload the extension and Calendar; AliasBuddy starts once and continues working.

### Backup

- [ ] Export a populated dataset and confirm a dated JSON file downloads.
- [ ] Cancel an import confirmation and confirm current data remains unchanged.
- [ ] Import a valid backup and confirm aliases and groups are restored.
- [ ] Try malformed JSON, unsupported backup version, duplicate nicknames, and invalid emails; each must be rejected without changing current data.
- [ ] Export an empty dataset and confirm it can be restored intentionally after confirmation.

### Groups

- [ ] Create a group with two or more valid, unique email addresses.
- [ ] Switch between individual and paste views and confirm email values are retained both ways.
- [ ] Clone a group and confirm the form opens with copied members, a new ID, and a unique copy nickname.
- [ ] Select a group in Calendar and verify each member is selected sequentially using Google's native result.
- [ ] Preselect one member and confirm that member is skipped.
- [ ] Include one unresolved address and confirm remaining members are still attempted.

For multi-device and migration checks, use the checklist in [docs/browser-sync.md](docs/browser-sync.md).

## Privacy

Aliases and group email addresses are stored locally. When the browser provides extension sync and browser account sync is enabled, AliasBuddy also mirrors those values through the browser vendor's `storage.sync` service. AliasBuddy does not operate its own server or receive browser account credentials.

Browser sync and JSON backup behavior are described in [PRIVACY.md](PRIVACY.md).

## Troubleshooting

- Reload the Calendar tab after installing or reloading the unpacked extension.
- Confirm the page is served from `https://calendar.google.com/`.
- Confirm the event editor currently shows **Search for people to meet**.
- If Google changes PeopleKit's DOM, inspect the semantic attributes documented in the Calendar adapter before introducing generated CSS selectors.
- Open the Calendar tab's DevTools console for the local startup error if the adapter cannot initialize.
- If browser sync is unavailable or signed out, AliasBuddy should continue operating from local storage. Use JSON export/import for cross-browser transfer or durable recovery.
