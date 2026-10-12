# MongoDB Raw Condition Input

## Purpose

Implement raw MongoDB filter JSON input within an individual condition, including operators and structures unavailable in the visual editor.

## Scope and interface

- Enable the existing Raw option for MongoDB conditions.
- Opening Raw mode populates the textarea with the condition's generated filter JSON. If generation fails, start with empty input.
- Accept a filter object containing one or more top-level members, including multiple field predicates or a complete logical subtree.
- Use a MongoDB JSON example as the placeholder and provide an accessible label and error association.
- Retain existing Raw condition styling and preview.

Raw input is a filter document, not a command, complete request, shell expression or aggregation pipeline. Request-level sorting, pagination and projection are outside this feature.

## Input handling

- Use ordinary JSON parsing and require an object as the root value. Reject arrays, primitives and null at the root.
- Allow the empty object `{}` as an explicit empty filter. Distinguish it from an empty textarea, which is invalid.
- Allow multiple top-level members; do not copy Elasticsearch's single-clause-member restriction.
- Accept operators, nested documents, arrays and options beyond the visual editor's supported set.
- Do not validate operator-specific operands, operator placement, schema compatibility, server versions or execution validity.
- Use normal JSON parsing and serialization. Formatting changes and numeric precision loss are accepted; add no special precision checks or warnings for raw input.
- Empty text, malformed JSON or an invalid root value produces a concise inline error and prevents complete query generation. Never silently omit a raw condition.

## JSON and BSON boundary

- Support JSON syntax only. Do not parse shell expressions such as ObjectId(...), ISODate(...), regular-expression literals or db.collection.find(...).
- Preserve Extended JSON objects such as {"$oid":"..."} or {"$date":"..."} as ordinary JSON objects without interpreting or validating them.
- Do not add BSON conversion or an Extended JSON dependency.
- Explain briefly in help text that typed BSON values require Extended JSON decoding by the consuming tool; passing ordinary parsed JSON does not perform that conversion.
- Do not add recurring warnings or confirmation dialogs for this boundary.

## Query generation

- Embed the parsed raw filter as one child document at the condition's existing position in the group tree.
- Preserve its contents, subject to normal JSON parsing and serialization, without translating them into visual conditions or stripping unsupported members.
- Keep multiple predicates inside the same raw document; do not merge them into neighboring conditions.
- Apply existing all/any/none group behavior through `$and`, `$or` and `$nor`.
- Preserve an explicitly entered `{}` as a child filter, including in any/none groups where removing it could change meaning.
- Leave operator placement and execution restrictions to MongoDB. Do not rewrite raw filters to compensate for those restrictions.

## Switching modes

- Raw edits immediately update the condition's stored raw text.
- Switching from Raw to visual clears that condition and restores the normal blank visual condition.
- Preserve the condition's identity and position in its group.
- Do not attempt conversion, retain hidden previous values or add a confirmation dialog.
- Apply this behavior to MongoDB without changing other database modes.

## Import behavior

The existing whole-filter importer remains unchanged. This feature does not add automatic Raw fallback for unsupported imported filters. Permissive handling applies to JSON entered directly into a Raw condition.

## Implementation boundaries

Reuse existing condition-level Raw UI, storage, styling, preview and generation error handling. Reuse any applicable shared support already introduced for Elasticsearch Raw input, but do not assume it is present or introduce a dependency on an unfinished change.

Keep changes focused on MongoDB support and any small shared interface adjustments needed for JSON wording and clearing behavior. Add no dependencies or broad state-model refactoring. Update relevant help text and documentation, including a brief statement that raw input is checked as JSON rather than validated for MongoDB execution.

Follow applicable AGENTS.md instructions. Do not create or change tests, or run tests, formatting, linting, type checks or builds for this task.

## Example

The following raw filter should be accepted and embedded as one condition:

```json
{
  "items": {
    "$elemMatch": {
      "price": { "$gte": 10, "$lte": 20 },
      "available": true
    }
  },
  "status": "online"
}
```

## Acceptance criteria

- A visual MongoDB condition can be opened and edited as Raw JSON.
- Operators and structures unsupported by the visual editor can appear intact, subject to normal JSON serialization, in generated output.
- Multiple top-level predicates remain together within one raw condition.
- Raw and visual conditions work together inside nested all/any/none groups.
- An explicit `{}` remains in generated output; empty text is rejected.
- Malformed JSON or an invalid root value displays a concise actionable error and blocks output until corrected.
- Extended JSON objects are preserved without BSON conversion or additional validation.
- Switching back to visual produces a blank condition in the same position.
- Existing whole-filter import behavior and other database modes remain unchanged.
