# MongoDB visual filter capabilities

The visual editor generates native MongoDB filter JSON. Conditions combine through all (`$and`), any (`$or`) and none (`$nor`) groups. It does not execute filters or infer BSON types from values.

| Editor choice | Native predicate | Operand |
| --- | --- | --- |
| equals / does not equal | `$eq` / `$ne` | Text, number or Boolean |
| greater / less than, with inclusive variants | `$gt`, `$gte`, `$lt`, `$lte` | Text or number |
| in list / not in list / contains all | `$in`, `$nin`, `$all` | Nonempty homogeneous text, number or Boolean list |
| has type | `$type` | BSON type alias or numeric code |
| has any listed type | `$type` | Nonempty homogeneous alias list or numeric-code list |
| matches regex | `$regex` with optional `$options` | Pattern string, preserved including inline flags; yes/no controls for `i`, `m`, `s` and `x` |
| array size | `$size` | Nonnegative safe integer |
| exists / missing | `$exists: true` / `$exists: false` | No value |
| equals null / does not equal null | `$eq: null` / `$ne: null` | No value |

## BSON type predicates

Use Text for an exact, case-sensitive alias: `double`, `string`, `object`, `array`, `binData`, `undefined`, `objectId`, `bool`, `date`, `null`, `regex`, `dbPointer`, `javascript`, `symbol`, `javascriptWithScope`, `int`, `timestamp`, `long`, `decimal`, `minKey`, `maxKey`, or `number`. The `number` alias matches double, int, long and decimal BSON types. Use Number for code `-1`, `1`–`19`, or `127`.

Both choices generate native `$type`, preserving operand types and scalar/list shape:

```json
{"name":{"$type":"string"}}
{"age":{"$type":2}}
{"value":{"$type":"number"}}
{"items":{"$type":"array"}}
{"value":{"$type":["string","int"]}}
{"value":{"$type":[2,16]}}
```

Native array-element matching applies: an array field can match when an element has a requested type. `$type: "array"` matches the array itself. The builder adds no wrappers or `$expr` layer. These predicates concern stored BSON types, not schema declarations or conversion of values.

Visual import selects **has type** for scalars and **has any listed type** for lists. Lists must contain only aliases or only numeric codes. Mixed lists such as `["string",16]` are rejected atomically; use a Raw condition to retain native mixed-list syntax. Empty lists, invalid aliases, numeric strings such as `"2"`, unsupported codes, fractions, Booleans, actual JSON null, documents and nested lists are rejected without coercion. The alias `"null"` is valid. Every list item is validated, and invalid editor operands block generation with the existing accessible validation feedback.

## Regular expression options

The **matches regex** operator's **Optional Parameters** panel offers four separate yes/no controls. They form one native `$options` string alongside the unchanged `$regex` pattern:

| Flag | Meaning |
| --- | --- |
| `i` | Case-insensitive matching |
| `m` | Multiline anchors: `^` and `$` can match the start and end of each line |
| `s` | Dot matches newline characters |
| `x` | Ignore unescaped pattern whitespace and allow comments |

For example, enabling `i` and `m` generates `{"name":{"$regex":"^ben","$options":"im"}}`. No enabled or retained flags means `$options` is omitted. Selection and navigation preserve configured controls. Explicitly collapsing the panel clears these four controls, following the existing optional-parameter convention.

Visual import pairs `$regex` with `$options` regardless of member order and preserves other supported predicates on the same field. Imported `u` is accepted and retained through export, flag edits and explicit panel clearing; this redundant native Unicode flag has no checkbox. Orphan `$options`, non-string options and unsupported flags such as `g` reject the entire import with source-aware feedback. Invalid visual parameter state blocks generation through the existing condition feedback. Pattern strings and inline flags are preserved verbatim without JavaScript regex compilation, added wildcards or wrappers.

## Import and Raw boundaries

Whole-filter import accepts supported predicates and logical groups, preserves primitive operand types, and rejects unsupported input without partial import or automatic Raw fallback. Consumed numbers must be finite, with safe integer values; overflowing and nonzero underflowing source tokens are rejected. Field paths must be nonempty without surrounding whitespace, NUL, line breaks, empty segments or dollar-prefixed segments. Field references and modifiers are unsupported.

MongoDB equality can match array elements; null equality also matches missing fields. Null inequality requires an existing non-null value. `$all` matches array contents rather than exact-array equality. Regex strings are preserved without JavaScript regex validation or added wildcards.

[MongoDB Raw Condition Input](mongodb-raw-input-spec.md) remains the Raw-specific contract. Raw accepts filter objects beyond this visual subset, checks JSON syntax and root shape, and does not validate MongoDB execution semantics. Typed BSON and Extended JSON are not decoded by the builder.

This document describes source behavior; no runtime or automated verification was performed for this addition.
