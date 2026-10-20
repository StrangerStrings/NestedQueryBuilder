# Undo and redo

## Approach

- Store query snapshots in the Pinia query store, with up to 25 undo actions.
- Include condition edits, operator and value type changes, optional parameters, adding/deleting conditions or groups, group logic, drag and drop, and query imports.
- Restore the complete query, including identifiers, raw input, and colour assignments.
- Exclude schema imports, display preferences, and panel selection from history.
- Keep history in memory only. Clear undo and redo history on a successful database switch; reloading starts fresh.

## Grouping edits

- Keep existing live updates and previews while typing.
- Group changes to one input into one undo action, remembering the query before its first change.
- End that editing session on blur, Enter, or another query action. Pausing while typing does not split the action.
- Treat each list item and range endpoint as a separate input session. Enter in a multiline editor keeps its normal newline behavior.
- Include any final input normalization on blur or Enter in the same action.
- Treat an operator/type change and its automatic value conversions or parameter removals as one action.
- Treat each add, delete, drag, list item addition/removal, group logic change, or successful query import as one action.
- Ignore unchanged results and editing sessions that return to their original state.

## Keyboard shortcuts

- Undo: `Cmd+Z` on macOS; `Ctrl+Z` elsewhere.
- Redo: `Cmd+Shift+Z` on macOS; `Ctrl+Shift+Z` or `Ctrl+Y` elsewhere.
- Use unified query undo inside query-editing inputs as well as outside inputs, overriding native text undo there.
- Undo during an active editing session finishes and immediately reverses that session.
- Leave native text undo available in query-import and schema-import text areas, whose drafts are outside query history.
- Do not intercept shortcuts during IME composition.
- Add no Undo or Redo buttons. If the relevant history is empty, query shortcuts do nothing.

## History and editor behavior

- Undo makes the reversed action available to redo; redo restores it.
- A new query edit after undo clears redo history.
- Restoring a snapshot must not create another history entry or allow stale input drafts to overwrite the restored query.
- Keep the selected condition open if it still exists. Otherwise close its editor and move focus to the query builder.
- Announce completed undo/redo actions through an accessible status message, such as “Undid delete group.”
