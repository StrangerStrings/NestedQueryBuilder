# Database orchestrator

Run these commands from the original repository in an interactive terminal.

```sh
# Start a new database run.
npm run db:add -- "SQLite"

# Continue the newest saved run for this database.
npm run db:add -- "SQLite" --resume

# Request a pause from a second terminal.
npm run db:add -- "SQLite" --pause

# Select a particular run instead of the newest timestamp folder.
npm run db:add -- "SQLite" --resume --run-id 2026-10-08T10-49-29-591Z
```

The script uses the existing `jiti` development dependency. The `codex` executable
must be on PATH and signed in using ChatGPT (`codex login`). Set `CODEX_BIN` to
its absolute path if needed. Child processes remove API-key overrides and require
ChatGPT authentication; there is no API billing fallback or model substitution.

## Workflow

1. Create `codex/database-<database>` and a worktree from the current `HEAD`.
2. Research the database and current application to produce requirements.
3. Prepare a high-level plan and ask meaningful architectural questions.
4. Save your answers and revise the plan, then wait for your explicit approval.
5. For each stage: Detailed Planner → Implementer → Mini Reviewer.
6. A mini-review FAIL goes back through detailed planning, implementation and
   review, with up to three repair attempts after the initial implementation.
7. After every stage passes, perform the final review once. Its verdict never
   triggers a repair loop or an architectural-decision loop.

Scope is query generation, parsing, schema handling and popular operators that
fit existing capabilities. Live query execution, new backends and major new UI
capabilities remain outside scope.

There are no commits, merges or pushes. No tests are created or changed; tests,
formatting, linting, type checks and builds are disabled. PASS means a source
review found no unresolved issues, not that runtime behavior was verified.

## Architectural decisions during implementation

A Detailed Planner requiring a decision, an Implementer returning BLOCKED, or a
Mini Reviewer returning BLOCKED opens a saved architectural checkpoint:

1. The Design Question Agent reads the blocker and existing approved contract.
2. You select an option or provide a custom answer. Each answer is saved immediately.
3. The High-Level Planner performs a **targeted impact assessment**. It proposes
   amendments to existing stages and requirements; it does not regenerate the
   full plan, renumber stages or restart research.
4. The terminal shows the proposed changes and any completed stages to reopen.
   Choose Approve, Revise or Pause. Proposed answers do not become authoritative
   until the amendment is approved.
5. Continue with detailed planning for the earliest affected incomplete stage.

Unchanged completed stages remain completed. A changed completed stage and its
completed dependents are listed for reopening before approval. Existing code is
preserved when a stage reopens; agents adapt it to the new decisions. Research
is limited to evidence needed for the particular blocker.

The planner can update existing stages only. A change requiring an entirely
different stage structure should be handled as a separate workflow change.

## Pause and resume

- **Ctrl+C once during an agent:** request a pause after that agent finishes.
  It can still use tokens while finishing. The result and next position are saved.
- **Ctrl+C twice:** interrupt the agent immediately and preserve partial work.
- **At a question or approval:** choose `p`, or press Ctrl+C. Saved answers remain.
- **From another terminal:** use `--pause`. The next boundary stops the run. If
  the runner is waiting at a question, choose `p` there to exit immediately.
- **Usage-limit errors:** the run stops with a saved cursor. Resume manually
  after your allowance is available; there is no polling or scheduled restart.

`--resume` reuses the worktree, completed stages, accepted decisions and saved
agent results. If an agent did not finish, a fresh session gets its prior logs and
instructions to inspect partial changes before continuing the remaining task.
It does not blindly reapply the entire implementation. A finished final review
is displayed again without another model call.

The cursor is stored atomically in `run.json` after each agent handoff and human
answer. Agent logs have unique numbers across resumes. A process lock prevents
concurrent runs against the same saved workflow and detects surviving CLI
processes after an abrupt exit.

Do not edit the database worktree or approved workflow files outside this process
while a run is active or paused. Resume checks the branch, original commit,
staging area, source fingerprint and approved documents. Unexpected changes stop
resume without discarding files. Changes from an interrupted Implementer are
preserved and explicitly inspected by its replacement session.

Older runs are migrated when first resumed, with the old `run.json` backed up as
`legacy-run.json`. The existing SQLite run's Stage 1, attempt 2 BLOCKED report is
recognized and opens the architectural-decision checkpoint. Its research,
approved plan, prior answers and attempts are reused. Older unfinished planning
phases may need a new question pass because they did not record a precise cursor.

CLI failures are not automatically retried. Explicit resume retries the unfinished
agent. If the stage repair limit is exhausted, increase `maxStageRepairAttempts`
before resuming to authorize another repair. An approved architectural amendment
starts a fresh repair allowance under the revised contract.

## Files and Git

Source is in `scripts/db-orchestrator/`. Generated files are Git-ignored:

```text
.codex-orchestrator/
  worktrees/<database>/
  runs/<database>/<timestamp>/
    run.json                       # Durable workflow cursor and active agent
    legacy-run.json                # Backup when migrating an older run
    runner.lock                    # Active process IDs; removed on normal exit
    pause.request                  # Request to pause at the next boundary
    models.json
    requirements.md
    plan.md
    plan.json
    decisions.json
    plans/revision-1/               # Plan, questions and partial answers
    stages/01/
      before.patch                 # Historical baseline for this stage
      after.patch                  # Latest stage state
      instructions.md             # Latest attempt, with JSON counterparts
      implementation.md
      review.md
      attempts/01/                 # Preserved instructions, reports and snapshots
      attempts/02/
    architecture/001/
      blocker.json
      before-requirements.md
      before-plan.json
      before-plan.md
      before-decisions.json
      completed-stages.json
      questions.json
      answers.json                 # Proposed answers, saved one at a time
      feedback.json
      revision-1/                  # Impact report, proposed plan and reopen list
      approval.json
    final.patch
    final-review.md
    final-review.json
    logs/                          # Prompts, schemas, responses and raw CLI logs
```

New worktrees start from committed HEAD, excluding uncommitted changes in the
original checkout. Open the reported **worktree folder** to review generated
changes: switching branches in the original folder will not bring its uncommitted
edits across. Resume always keeps the original run's base commit even if the
original checkout has advanced. The current root `AGENTS.md` is included in prompts.

The orchestrator owns all workflow documents. Agents return structured results;
their task prompts are never executed as shell commands. Implementation agents
may edit application files in the worktree. Research, planning and review agents
use a read-only sandbox. Live documentation search is enabled. Implementation
uses workspace-write with network access and permits necessary dependency
installation with `--ignore-scripts`. Existing machine/account policies apply.

## Configuration

Edit `config.ts` to configure roles independently. The impact assessment is a
separate invocation of the High-Level Planner, with the same default model.

| Role | Model | Effort |
| --- | --- | --- |
| Researcher | GPT-6.1 Sol | high |
| High-level planner / impact assessment | GPT-6 Astra | high |
| Design questions | GPT-6.1 Sol | medium |
| Detailed planner | GPT-6.1 Sol | high |
| Implementer | GPT-6.1 Sol | selected by the detailed planner |
| Mini reviewer | GPT-6.1 Sol | medium |
| Final reviewer | GPT-6 Astra | xhigh |

Set `plannerChoosesImplementationEffort` to `false` to use the Implementer's
configured effort. `maxStageRepairAttempts` counts corrections after the initial
implementation; `0` stops at the first failed mini review. Resumed agent calls use
the current configuration; existing completed results are retained.

Sources: [Codex non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode)
and [ChatGPT authentication](https://learn.chatgpt.com/docs/auth).
