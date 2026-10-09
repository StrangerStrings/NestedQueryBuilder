# Elasticsearch optional parameters

Implement optional parameters for Elasticsearch conditions in the existing query builder. Allow multiple parameters per condition, without duplicates. Follow the repository's AGENTS.md instructions and keep changes focused.

| Operator | Supported parameter | Input |
|---|---|---|
| Match | Any/all words (`operator`) | Any / All dropdown |
| Match | Fuzziness (`fuzziness`) | Auto / 0 / 1 / 2 dropdown |
| Match phrase | Slop (`slop`) | Integer input, minimum 0 |
| Term, Prefix, Wildcard | Case insensitive (`case_insensitive`) | On/off toggle |

## Interface

- In the condition editor, show a muted grey settings icon and **Optional Parameters** label when the operator supports parameters.
- Clicking expands a dedicated component below and darkens the control.
- Each parameter row contains a parameter dropdown, its corresponding input and a minus button.
- A plus button below adds a row. Prevent duplicate parameters and disable adding when all available parameters are selected.
- **Collapsing clears all parameters**, removes the rows and restores the muted appearance. Reopening starts fresh.
- In `QueryCondition`, display only one `*` beside the operator per configured parameter—no label or summary.

## Behaviour

- Store parameters on the condition alongside its operator and value.
- Remove unsupported parameters when the operator changes.
- Validate values and support the parameters in Elasticsearch JSON import and export.
- Leave omitted parameters to Elasticsearch defaults.
- Provide accessible labels, keyboard controls and expanded-state information. State clearly that collapsing clears parameters.
- Keep PostgreSQL behaviour unchanged. Custom fuzziness thresholds and other optional parameters are out of scope.
