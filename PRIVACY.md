# AliasBuddy Privacy Disclosure

**Last updated:** September 4, 2026

## Single purpose

AliasBuddy lets users create their own nicknames and groups for people, then use those nicknames to locate and select the corresponding real contacts in supported web applications.

## Data handled

AliasBuddy stores only information the user enters into the extension:

- Nicknames
- Email addresses mapped to person aliases
- Email addresses included in group aliases

AliasBuddy keeps a local copy of this information with the browser's WebExtensions storage API. On browsers that provide `storage.sync`, AliasBuddy also mirrors the alias data into that browser's built-in extension sync storage so it can be synchronized between installations of the same browser family when the user has browser account sync enabled.

Browser-native sync is handled by the browser vendor. AliasBuddy does not receive the user's browser account credentials and does not operate a sync server. Chrome/Chromium sync, Microsoft Edge sync, and Firefox Sync are separate ecosystems; AliasBuddy does not automatically sync data from one browser family to another.

## Data use and sharing

AliasBuddy uses saved aliases only to match text typed into a supported people-search field and to ask that website's native contact search to select the corresponding email address.

AliasBuddy:

- does not operate a server;
- does not create an AliasBuddy account;
- does not use analytics or tracking;
- does not sell user data;
- does not share user data with the developer;
- does not transmit aliases to the developer;
- does not call an AliasBuddy-hosted external API; and
- does not use saved data for advertising, credit decisions, or unrelated purposes.

If browser account sync is enabled, the browser vendor may process AliasBuddy's synced extension data as part of that browser's sync service and according to the vendor's own privacy terms.

Users can explicitly export their data to a JSON backup file and import it later. Exported files are created locally and are not uploaded by AliasBuddy. If a user stores an exported file in Google Drive or another service, that service processes the file according to its own privacy policy.

When the user selects an alias, the mapped email is entered into the supported website's native contact-search interface. That website processes the search according to its own privacy policy, just as it would if the user typed the email manually.

## Permissions

AliasBuddy requests:

- **Storage:** to save aliases and groups locally and, where supported, use the browser's built-in extension sync storage.
- **Host access to `https://calendar.google.com/*`:** to detect Google Calendar's people-search field, display matching aliases, and select Google Calendar's native contact result.

AliasBuddy does not request access to all websites. New applications will require explicit, limited host permissions in a future extension version.

## Retention, sync, and deletion

The local cache remains on a device until the user edits or deletes the data, clears extension data, or removes the extension. Browser-synced extension data follows the retention and deletion behavior of the browser's sync service.

Browser sync is a convenience for keeping installations of the same browser family aligned; it is not a guaranteed long-term backup. Removing an extension can clear its synced extension data. For an uninstall-safe or cross-browser backup, users should export the AliasBuddy JSON file and keep it outside the extension, such as in a private cloud-storage folder.

AliasBuddy retains an explicit empty-dataset marker when all aliases are intentionally deleted. If browser sync metadata unexpectedly disappears while another installed AliasBuddy instance still has local data, that instance can republish its local copy instead of treating the missing metadata as an intentional delete-all.

## Remote code

AliasBuddy does not load or execute remote code. All extension JavaScript is packaged with the extension.

## Contact

Support and privacy questions can be submitted through the repository's GitHub issue tracker.
