# Google Calendar Reference Behavior

The Google Calendar adapter was extracted from the supplied working userscript rather than redesigned. This note records the behavior that should be treated as regression-sensitive when the adapter changes.

| Proven behavior | Adapter implementation |
| --- | --- |
| Detect the PeopleKit input by `aria-label="Search for people to meet"` | `isPeopleInput()` and `findPeopleInput()` |
| Match nickname prefixes only after two characters | Core `resolver.resolve()` |
| Exclude already-selected mapped emails | `getSelectedEmails()` plus the core resolver |
| Place AliasBuddy results above the complete input container | `getInputContainer()` and `positionPopup()` |
| Let Google select the real contact | `setInputValue()`, `waitForGooglePerson()`, and `clickGoogleOption()` |
| Verify Google's real chip before success | `waitForSelectedEmail()` |
| Hide an exact selected-email duplicate | `processPeopleInput()` and `hideGoogleResults()` |
| Keep normal Up and Down owned by Google | `handleKeydown()` |
| Use Shift+Up and Shift+Down for aliases | `handleKeydown()` |
| Add group members sequentially and continue after failure | `selectGroup()` |
| Reacquire PeopleKit after dynamic rerenders | `findPeopleInput()`, `waitForGooglePerson()`, and the mutation observer |

Selectors based on roles, ARIA attributes, `pkd-target`, `data-hovercard-id`, and `data-email` should be preferred. The known PeopleKit wrapper class remains only as a compatibility fallback inherited from the reference implementation.

Do not replace native contact selection with custom selected-person DOM. Any future change to selection must still wait for the native option and verify the native selected-person chip.
