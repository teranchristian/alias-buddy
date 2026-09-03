# AliasBuddy Privacy Disclosure

**Last updated:** September 3, 2026

## Single purpose

AliasBuddy lets users create their own nicknames and groups for people, then use those nicknames to locate and select the corresponding real contacts in supported web applications.

## Data handled

AliasBuddy stores only information the user enters into the extension:

- Nicknames
- Email addresses mapped to person aliases
- Email addresses included in group aliases

This information is stored locally on the user's device with `chrome.storage.local`.

## Data use and sharing

AliasBuddy uses saved aliases only to match text typed into a supported people-search field and to ask that website's native contact search to select the corresponding email address.

AliasBuddy:

- does not operate a server;
- does not create an AliasBuddy account;
- does not use analytics or tracking;
- does not sell user data;
- does not share user data with third parties;
- does not transmit aliases to the developer;
- does not call external APIs; and
- does not use saved data for advertising, credit decisions, or unrelated purposes.

When the user selects an alias, the mapped email is entered into the supported website's native contact-search interface. That website processes the search according to its own privacy policy, just as it would if the user typed the email manually.

## Permissions

AliasBuddy requests:

- **Storage:** to save aliases and groups locally on the user's device.
- **Host access to `https://calendar.google.com/*`:** to detect Google Calendar's people-search field, display matching aliases, and select Google Calendar's native contact result.

AliasBuddy does not request access to all websites. New applications will require explicit, limited host permissions in a future extension version.

## Retention and deletion

Saved aliases remain in Chrome's local extension storage until the user edits or deletes them, clears extension data, or removes the extension. Users can delete individual aliases and groups from AliasBuddy's management page.

## Remote code

AliasBuddy does not load or execute remote code. All extension JavaScript is packaged with the extension.

## Contact

Support and privacy questions can be submitted through the repository's GitHub issue tracker.
