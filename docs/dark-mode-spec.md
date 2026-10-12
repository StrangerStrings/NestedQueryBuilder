# Dark Mode Specification

## Purpose and scope

Add a consistent dark appearance across the query builder, all tabs, and database-specific editors. Preserve the existing light appearance, query behaviour, layouts, and field colour identities. Use the existing Vue and Pinia structure without new dependencies.

Estimated effort: 1–2 developer days, including visual review. Most work is replacing scattered colour values and tuning the condition palette.

## Theme selection and persistence

- Add an Appearance fieldset in Settings with labelled System, Light, and Dark radio options. Default to System.
- Store the preference in `src/stores/settingsStore.ts`; distinguish the selected preference from the resolved light or dark appearance.
- Persist only the theme preference in local storage. Missing or invalid values fall back to System; unavailable storage must not prevent the app from loading or switching themes.
- In System mode, respond immediately to operating-system appearance changes. Explicit Light or Dark selections override the system setting.
- Apply the resolved theme to the document root before the first visible render to avoid a light flash. Keep startup resolution and the store consistent.
- Switching themes must preserve query contents, field colour assignments, active tab, editor state, and keyboard focus.

## Shared application colours

Introduce a global theme stylesheet with semantic CSS custom properties and light and dark values. Cover page and panel backgrounds, navigation, inputs, primary and muted text, placeholders, borders, accents, errors, success messages, focus indicators, hover, selection, disabled states, and shadows.

Replace hard-coded component colours with these variables, including colours supplied through inline styles and fallback values. Name tokens by their purpose rather than their current colour. Existing scoped component styles can inherit the global variables.

Set the root `color-scheme` to match the resolved theme so native form controls and browser-managed surfaces use the appropriate appearance. Use distinct dark surfaces and borders to retain the hierarchy of nested query groups.

## Condition cards and editor panels

- Extend `src/colours/palette.ts` with dark appearances for the existing colour families and variants. Use darker tinted backgrounds and contrasting accents while retaining each family's hue identity.
- Keep colour IDs and assignment rules stable. Resolve appearance from the current theme without rewriting the query or reallocating colours.
- Provide matching dark treatments for raw conditions, blank or invalid conditions, selection, and drag indicators.
- Keep cards and their editor panels consistent, including the panel's blended background tint. Choose text and accent colours that remain readable on every variant.
- Preserve useful distinctions between variants and nested groups. Retain labels, borders, and other cues so meaning does not depend solely on colour.

## Query syntax highlighting

Extend the shared Shiki highlighter in `src/utils/queryHighlighter.ts` to load a matching dark theme alongside `github-light`. Update `src/components/QueryDisplay.vue` so both SQL and JSON highlighting follow theme changes without requiring query edits.

Match the surrounding preview background to the syntax theme. Preserve lazy highlighter reuse, stale-result protection, and the readable plain-text fallback when highlighting is loading or fails.

## Accessibility and visual review

Keep the theme selector keyboard accessible with a fieldset, legend, and associated labels. Review text contrast, placeholders, errors, disabled controls, focus indicators, selected cards, hover states, suggestion menus, and drag states in both themes.

Cover Builder, Output, Import, Schema, Databases, and Settings, plus database-specific controls, raw editors, tooltips, help panels, and native inputs. Review long queries, nested groups, empty states, and validation messages at narrow and wide viewport sizes.

## Implementation sequence

1. Introduce semantic colour variables and migrate component styles while preserving the current light appearance.
2. Add preference state, persistence, initial theme application, system-change handling, and the Settings controls.
3. Add the dark application palette, condition colours, and syntax highlighting.
4. Review both appearances against the acceptance criteria and adjust contrast and visual hierarchy.

Keep changes focused and add short comments above created or changed functions. Follow `AGENTS.md`: do not create or change tests unless asked; run tests, formatting, linting, type checks, or builds only when requested.

## Acceptance criteria

- System, Light, and Dark apply immediately and the selected preference survives reloads.
- System follows operating-system changes; explicit preferences remain unchanged by them.
- Initial loading uses the resolved appearance without a visible light flash in dark mode.
- All application surfaces, native controls, and SQL and JSON previews reflect the selected appearance.
- Condition colour identities remain stable, with readable cards, matching panels, and clear nested-group boundaries.
- Keyboard focus, selection, errors, hover, and drag states remain distinguishable in both themes.
- Switching themes leaves query data and editing context intact.
- The light appearance remains visually consistent with the existing application, and unavailable local storage does not break theme selection.
