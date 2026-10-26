# Database improvements

Planned small additions for MySQL 8.4:

| Feature | Change |
| --- | --- |
| NULL-safe equality | Add `<=>` to compare values, treating two NULLs as equal. |
| Boolean predicates | Add `IS TRUE`, `IS FALSE`, `IS NOT TRUE`, and `IS NOT FALSE`, with no value input. |
| Regular expressions | Add `REGEXP` and `NOT REGEXP`, accepting text or a field reference. |
| Character length | Add `CHAR_LENGTH` as a field modifier. Keep `LENGTH` for byte count. |
| Date modifiers | Add `YEAR`, `MONTH`, `DAYOFMONTH`, and `DATE` as field modifiers. |

Planned small additions for MariaDB 11.4:

| Feature | Change |
| --- | --- |
| Character length | Add `CHAR_LENGTH` as a field modifier. Keep `LENGTH` for byte count. |
| NULL-safe equality | Add `<=>` to compare values, treating two NULLs as equal. |
| Regular expressions | Add `REGEXP` and `NOT REGEXP`, accepting text or a field reference. Recognise `RLIKE` aliases on import. |
| Schema collations | Expand the schema-import allowlist with verified MariaDB 11.4 collations, including `utf8mb4_unicode_ci`. |

Planned small additions for SQLite 3.37+:

| Feature | Change |
| --- | --- |
| Storage type | Add `typeof` as a field modifier to filter by SQLite storage type. |
| Raw scalar functions | Allow `coalesce`, `ifnull`, `nullif`, `substr`, `instr`, and `replace` in Raw conditions, with argument-count and recursive argument validation. |
| Raw date/time functions | Allow `date`, `time`, `datetime`, `julianday`, and `strftime` in Raw conditions, keeping supported arguments and modifiers compatible with SQLite 3.37. |
| Boolean predicates | Add `IS TRUE`, `IS FALSE`, `IS NOT TRUE`, and `IS NOT FALSE`, with no value input. Preserve truth-test semantics rather than converting them to comparisons with numeric 1/0. |

Planned small additions for Elasticsearch:

| Feature | Change |
| --- | --- |
| Minimum words matched | Add `minimum_should_match` as an optional parameter on the existing Match operator. Use a number input labelled **Minimum words matched**, accepting nonnegative safe whole numbers only. No percentages, text expressions, or count/percentage switch. |
| Analyzed phrase prefix | Add `match_phrase_prefix` as a visual operator using the existing single-text value input. Analyze the input and treat the final term as a prefix, preserving phrase order by default. |
| Analyzed boolean prefix | Add `match_bool_prefix` as a visual operator using the existing single-text value input. Analyze the input and treat the final term as a prefix without requiring phrase order. |

Elasticsearch implementation details:

- Reuse the optional-parameters panel for Minimum words matched. Use a numeric input with minimum 0 and step 1; reject negative, fractional, unsafe, blank, or unfinished configured values rather than rounding or silently discarding them. Omission leaves Elasticsearch defaults unchanged.
- Explain that Minimum words matched applies to analyzed terms and is intended for OR; AND still requires every term. This is a condition parameter, not a group-level minimum.
- Store and export the configured minimum as a JSON number. Import supported nonnegative whole-number thresholds, including equivalent digit-only strings, and normalize them to numbers. Reject percentage and other expression forms in visual import rather than dropping them.
- Add operator definitions, JSON generation, and visual import support for both prefix operators. Reuse existing text inputs and validation; no new value type or query-tree structure.
- Keep the new prefix operators' optional parameters out of this addition; use Elasticsearch defaults. Preserve the existing root filter context and Raw JSON behavior.
- Relative-date presets, date/timezone parameters, scoring, and other Elasticsearch improvements are out of scope.

Planned small additions for MongoDB:

| Feature | Change |
| --- | --- |
| BSON type predicate | Add native `$type` as a visual operator, accepting a BSON type alias or numeric type code, or a list of aliases or codes. Reuse existing text/number and list inputs. |
| Regular expression options | Extend the existing `$regex` operator with optional yes/no controls for `i` (case-insensitive), `m` (multiline anchors), `s` (dot matches newlines), and `x` (ignore unescaped pattern whitespace and allow comments). |

MongoDB implementation details:

- Add `$type` generation, validation, and visual import support. Validate MongoDB's supported aliases and numeric codes, including the `number` alias; reject invalid types rather than coercing them. Preserve native query semantics, including array-element matching and `$type: "array"` matching the array itself.
- Reuse the optional-parameters panel for the four regex flags, with accessible labels and yes/no controls. These are separate controls in the editor but represent one native `$options` parameter, not four MongoDB parameters.
- Combine enabled flags into a single string alongside `$regex`, for example `{ "name": { "$regex": "^ben", "$options": "im" } }`. Omit `$options` when no flags are enabled.
- Import `$regex` and `$options` together into one visual condition and restore the selected flags. Accept the redundant native `u` flag without silently losing it on export; it does not need a checkbox. Reject unsupported flags such as `g`, non-string options, and `$options` without `$regex` in visual import.
- Preserve existing regex pattern strings and inline flags without rewriting them or validating them as JavaScript regular expressions. Keep existing Raw JSON behavior unchanged.
- Expose native MongoDB features only. Do not add contains/starts-with/ends-with wrappers, combined null-check shortcuts, new query-tree structures, or a generic expression abstraction.

## Scope

- Reuse existing controls, value types, and SQL/Query DSL handling; no new dependencies.
- Support SQL export, raw validation, and import back into the visual editor for each visual query addition. Preserve the SQLite Raw-only function additions as Raw on import and export; no new function-argument controls.
- Support Query DSL export and import back into the visual editor for the listed Elasticsearch additions, with accessible input labels and validation feedback.
- Support MongoDB filter JSON export and import back into the visual editor for `$type` and `$regex` with `$options`, with accessible input labels and validation feedback.
- Enable each database's listed additions only; leave other databases unchanged.
- Keep the MariaDB collation expansion limited to schema import; no new UI controls.
- Add brief help text and update the MySQL, MariaDB, SQLite, Elasticsearch, and MongoDB capabilities documentation.
