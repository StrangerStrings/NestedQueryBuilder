# Database orchestrator

Run from this repository in an interactive terminal:

```sh
npm run db:add -- "SQLite"
```

The database name is the input; names containing spaces can be quoted. Use
`npm run db:add -- --help` for usage. This uses the existing `jiti` development
dependency, so install the repository's dependencies first if needed.

The `codex` executable must be on your PATH and already signed in using ChatGPT
(`codex login`). Set `CODEX_BIN` to its absolute path if necessary. The script
checks the saved login, removes API-key environment overrides from child
processes, and requires ChatGPT authentication for each session. There is no
API billing fallback or model substitution. Your account must have access to
the configured models.

## Workflow

1. Create `codex/database-<database>` and its worktree from the current `HEAD`.
2. Research the database and existing application to produce requirements.
3. Produce a high-level plan and identify important design questions.
4. Collect numbered choices or custom answers, then revise the plan around them.
5. Display the plan and offer **Approve and implement / Revise / Stop**.
6. For each approved stage, create detailed instructions, implement them, and
   perform an independent source review. A mini-review **FAIL** sends the findings
   back to the Detailed Planner for correction instructions, then to the
   Implementer, then to another mini review. Advance only after **PASS**.
7. Perform the final source review once and leave everything for human review.
   Its verdict never starts a repair loop.

Scope is query generation, query parsing, schema handling, and popular operators
that fit the application's existing capabilities. Live query execution, new
backends, and major new UI capabilities are outside scope.

No tests are created or changed. Tests, formatting, linting, type checks and
builds are disabled. A review PASS means the source review found no unresolved
issues; it does not mean behavior has been verified by execution.

Mini reviews allow up to **three repair attempts per stage** after the initial
implementation (four mini reviews total). Each attempt preserves its instructions,
implementation report, snapshots and review. A **BLOCKED** result, architectural
decision, exhausted repair limit, failed final review, CLI error or malformed
handoff stops the run and preserves its files. Repairs keep the approved plan and
decisions fixed; reviewers reassess the entire stage, including its original
acceptance criteria, after every correction.

There are no commits, merges, pushes, CLI-error retries, resume support, or
usage-limit management. Human-requested plan revisions are supported before
implementation. Existing database branches and worktrees are never overwritten.

## Files

Tracked orchestrator source lives in `scripts/db-orchestrator/`. Generated files
live beneath the Git-ignored `.codex-orchestrator/` directory:

```text
.codex-orchestrator/
  worktrees/<database>/             # Application changes on a separate branch
  runs/<database>/<timestamp>/
    run.json                       # Progress and paths, for inspection only
    models.json                    # Model settings used for this run
    requirements.md
    plan.md
    plan.json
    decisions.json                 # Answers, feedback and explicit plan approval
    plans/1.md                     # Prior plan revisions
    stages/01/
      instructions.md              # Latest attempt (also retained below)
      instructions.json
      implementation.md
      implementation.json
      before.patch                 # Original stage baseline, never overwritten
      after.patch
      review.md
      review.json
      attempts/01/                 # Initial implementation and review
        instructions.md
        instructions.json
        implementation.md
        implementation.json
        before.patch               # Baseline for this attempt
        after.patch
        review.md
        review.json
      attempts/02/                 # First repair, when needed; same file layout
    final.patch                    # Tracked and untracked cumulative changes
    final-review.md
    final-review.json
    logs/
      001-researcher.prompt.md
      001-researcher.schema.json
      001-researcher.invocation.json
      001-researcher.response.json
      001-researcher.events.jsonl
      001-researcher.stderr.log
```

The orchestrator saves agent responses itself and gives sessions absolute paths
to previous outputs. Each role runs in a fresh `codex exec` session. The detailed
planner produces a task prompt; its output is never executed as a shell command.

Worktrees start from the committed `HEAD`: staged changes, unstaged changes and
untracked files in the original checkout are not copied. The root `AGENTS.md`
is also captured in agent prompts so current shared rules are available.
Do not manually edit the database worktree while its run is active.

Open the reported worktree in the Codex app or your editor to review its files.
**Uncommitted changes belong to that worktree**, so simply switching the original
checkout to the branch will not display them. The script leaves the worktree in
place; decide what to commit or remove yourself after review.

## Configuration

Edit `config.ts` to change each role's model and reasoning effort:

| Role | Model | Effort |
| --- | --- | --- |
| Researcher | GPT-6.1 Sol | high |
| High-level planner | GPT-6 Astra | high |
| Design questions | GPT-6.1 Sol | medium |
| Detailed planner | GPT-6.1 Sol | high |
| Implementer | GPT-6.1 Sol | selected by the detailed planner |
| Mini reviewer | GPT-6.1 Sol | medium |
| Final reviewer | GPT-6 Astra | xhigh |

Set `plannerChoosesImplementationEffort` to `false` to use the implementer's
configured effort for every stage instead.

Set `maxStageRepairAttempts` to change the repair limit. It counts corrections
after the initial implementation; `0` stops at the first failed mini review.
The final reviewer always runs once, regardless of this setting.

Research and review sessions use a read-only sandbox. Implementation uses
workspace-write with network access enabled. Live documentation search is
enabled for every role. Necessary dependency installation is permitted within
the worktree, using `--ignore-scripts` to avoid indirectly invoking forbidden
checks. Noninteractive sessions do not request routine approvals; operations
blocked by local Codex permissions are reported to the agent. Existing account,
organization and machine restrictions still apply.

Source: [Codex non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode)
and [ChatGPT authentication](https://learn.chatgpt.com/docs/auth).
