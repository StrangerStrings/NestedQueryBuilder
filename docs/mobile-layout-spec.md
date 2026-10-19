# Phone layout

## Goal

Make the query builder comfortable to use on phone screens while preserving the existing desktop layout.

## Navigation and settings

- Collapse the main navigation into a burger menu on phones.
- Selecting a screen closes the menu and opens that screen.
- Place builder settings at the bottom of the mobile menu.
- Reuse `BuilderSettings.vue` for both the mobile menu and the existing bottom-left desktop controls. This component has already been extracted.
- Settings use the same saved state in both locations.

## Query builder

- Use the available screen width for the query tree.
- Selecting a condition opens the existing condition editor as a full-screen panel on phones.
- Show a clear “Back to builder” control to close the panel.
- Retain the existing editing behaviour; closing the panel does not discard edits.
- Preserve the builder’s scroll position when returning from the editor.
- Keep the current side-by-side builder and condition panel on desktop.

## Other screens

Keep the schema input, query import, query output, and database selection screens broadly unchanged. Adjust spacing, wrapping, and scrolling where needed to fit phone screens.

## Usability

- Provide comfortable touch targets and accessible labels for navigation and controls.
- Keep keyboard focus within the full-screen editor while open, then return focus to the selected condition when closed.
- Ensure long queries and nested groups remain usable without widening the whole page.
- Allow the condition editor to scroll when content or the on-screen keyboard reduces available space.

## Implementation notes

- Choose the mobile breakpoint based on where the existing layout becomes cramped.
- The reusable settings component is complete; mobile navigation and full-screen condition editing remain to be implemented.
