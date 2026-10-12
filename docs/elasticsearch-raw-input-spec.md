# Elasticsearch Raw Condition Input

## Purpose

Implement raw Elasticsearch Query DSL input within an individual condition, including clauses and options unavailable in the visual editor.

## Scope and interface

- Enable the existing Raw option for Elasticsearch conditions.
- Opening Raw mode populates the textarea with the condition's generated JSON. If generation fails, start with empty input.
- Accept one query clause per condition, including a complete Boolean subtree.
- Use a JSON example as the placeholder and provide an accessible label and error association.
- Retain existing Raw condition styling and preview.

Raw input is a clause, not a complete search request. Request-level options such as sorting, pagination and aggregations are outside this feature.

## Input handling

- Parse input as JSON and require a nonempty object containing exactly one top-level clause member.
- Allow clause names and options beyond the visual editor's supported set.
- Do not validate clause-specific options, mappings, cluster compatibility or execution validity.
- Use normal JSON parsing and serialization. Formatting changes and numeric precision loss are accepted; add no special precision checks or warnings for raw input.
- Invalid JSON, empty input or an invalid outer structure produces a concise inline error and prevents generation of the complete query. Never silently omit the condition.

## Query generation

- Embed the parsed raw clause wherever the condition appears in the existing group tree.
- Preserve its contents, subject to normal JSON parsing and serialization, without translating them into visual conditions or stripping unsupported options.
- Apply existing all/any/none group behavior.
- Retain the current root filter context. Raw mode does not introduce control over result scoring.

## Switching modes

- Raw edits immediately update the condition's stored raw text.
- Switching from Raw to visual clears that condition and restores the normal blank visual condition.
- Preserve the condition's identity and position in its group.
- Do not attempt conversion, retain hidden previous values or add a confirmation dialog.
- Apply this clearing behavior to Elasticsearch; preserve other database modes.

## Import behavior

The existing whole-query importer remains unchanged. This feature does not add automatic Raw fallback for unsupported imported clauses. Permissive handling applies to JSON entered into a Raw condition.

## Implementation boundaries

Reuse existing condition-level Raw UI, storage and generation error handling. Keep changes focused on Elasticsearch support and the small shared interface adjustments needed for JSON wording and clearing behavior. Add no dependencies or broad state-model refactoring. Update relevant help text and documentation.

Follow applicable AGENTS.md instructions. Do not create or change tests, or run tests, formatting, linting, type checks or builds for this task.

## Acceptance criteria

- A visual Elasticsearch condition can be opened and edited as Raw JSON.
- A clause unsupported by the visual editor can appear intact, subject to normal JSON serialization, in generated output.
- Raw and visual conditions work together inside nested groups.
- Malformed input displays a concise actionable error and blocks output until corrected.
- Switching back to visual produces a blank condition in the same position.
- Existing query import behavior and other database modes remain unchanged.
