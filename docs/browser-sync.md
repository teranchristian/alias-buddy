# Browser-native sync

AliasBuddy uses the WebExtensions `storage.sync` API when the browser provides it. This gives users automatic same-browser-family synchronization without an AliasBuddy account, OAuth client, backend, or API key.

## What syncs

AliasBuddy mirrors aliases and groups into browser sync storage. Each alias/group is stored as its own sync item rather than serializing the entire dataset into one value. The browser remains responsible for transporting those items between signed-in browser installations.

A local copy is kept in `storage.local` on every installed browser. AliasBuddy reads from the local copy during normal operation and updates it when sync changes arrive.

## Browser boundaries

Browser sync is not cross-browser storage.

- Chrome/Chromium installations use their browser sync ecosystem.
- Microsoft Edge installations use Edge sync.
- Firefox installations use Firefox Sync when extension-data sync is available and enabled.
- Moving data between different browser families still requires AliasBuddy JSON export/import.

The extension IDs must remain stable. AliasBuddy already configures a stable Chromium key and a fixed Firefox add-on ID.

## First-run migration

Existing users may already have aliases in `storage.local` before browser sync is introduced.

On the first run of this sync version:

1. If no AliasBuddy sync dataset exists, the existing local dataset is published to sync.
2. If a sync dataset already exists, AliasBuddy merges legacy local entries that do not conflict by ID or normalized nickname.
3. The merged dataset becomes the local copy and the synced dataset.
4. A local migration marker prevents future startup from repeatedly treating stale local data as unsynced legacy data.

When the same nickname or ID already exists in the synced dataset, the synced entry wins during this one-time merge.

## Deletes and empty datasets

A sync metadata item identifies the current AliasBuddy dataset generation. Entries belong to that generation.

This distinction matters for deletion:

- Intentionally deleting all aliases keeps sync metadata with zero entries, so an empty dataset can propagate to another device.
- If the sync metadata itself unexpectedly disappears, AliasBuddy does not interpret that as an intentional delete-all. An installed device with a local copy republishes its local dataset.

That behavior protects an installed device from treating missing sync state as a destructive command.

## Conflict behavior

Different aliases/groups are separate sync items, so edits to unrelated entries do not overwrite one giant database object.

If the same entry is edited concurrently on two devices, the browser's sync service ultimately determines which value is delivered last. AliasBuddy does not currently expose a manual conflict-resolution UI.

Nicknames are still validated locally as unique. Invalid or conflicting remote entries are ignored when a sync snapshot is rebuilt.

## Failure behavior

Local saves happen before sync writes. If browser sync is temporarily unavailable or over quota, the local AliasBuddy operation still succeeds. A later browser/session can continue using the local data.

The storage layer exposes sync status/error information for future UI diagnostics.

## Sync is not backup

Browser-native sync is a convenience for keeping active installations aligned. It is not a guaranteed long-term or uninstall-safe backup and does not provide AliasBuddy version history.

For a durable copy:

1. Open **Manage AliasBuddy**.
2. Choose **Export backup**.
3. Store the JSON file somewhere outside the extension, such as a private cloud folder or external drive.

The JSON import/export format remains browser-independent and is the supported way to move data between Chrome/Chromium, Edge, and Firefox.

## Manual sync testing

### Existing-user migration

- [ ] Install the previous local-only build and create several aliases/groups.
- [ ] Replace it with the sync branch while retaining the same extension ID.
- [ ] Confirm all existing entries remain available.
- [ ] Confirm a second installation in the same browser sync account receives them.

### Two-device changes

- [ ] Add an alias on device A and confirm it appears on device B.
- [ ] Edit that alias on device B and confirm the edit appears on device A.
- [ ] Add unrelated aliases on both devices and confirm both remain.
- [ ] Delete one entry and confirm that deletion propagates.
- [ ] Import a JSON backup and confirm the replacement dataset propagates.

### Empty and missing state

- [ ] Intentionally replace the dataset with an empty backup and confirm the other device becomes empty.
- [ ] Clear only the browser sync storage while leaving an installed device's local data intact and confirm the local data is republished rather than erased.

### Browser boundaries

- [ ] Confirm Chrome-to-Chrome (or equivalent Chromium sync) works when browser sync is enabled.
- [ ] Confirm Edge-to-Edge is treated as its own ecosystem.
- [ ] Confirm Firefox-to-Firefox behavior with Firefox Sync enabled.
- [ ] Confirm Chrome data does not magically appear in Firefox; use JSON export/import for that migration.

### Failure cases

- [ ] Disable/sign out of browser sync and confirm AliasBuddy still works locally.
- [ ] Re-enable browser sync and confirm normal synchronization resumes.
- [ ] Test a dataset large enough to approach browser sync quota and confirm local writes are not lost if sync rejects a write.
