# Task orchestrator

A general coding-task version of `scripts/db-orchestrator`, scoped to this
repository. The database runner and its saved runs remain independent.

Run from the original repository in an interactive terminal:

```sh
# Start a task. The name identifies its branch and saved run.
npm run task:run -- "Implement dark mode" --name dark-mode

# Supply a longer task brief from a UTF-8 file instead.
npm run task:run -- --task-file ./task.md --name dark-mode

# Resume using the saved brief, answers and completed stages.
npm run task:run -- --name dark-mode --resume

# Request a pause from another terminal.
npm run task:run -- --name dark-mode --pause

# Select a specific saved run instead of the newest for that name.
npm run task:run -- --name dark-mode --resume --run-id <timestamp>
```

`--name` is optional for a new task. Without it, the runner derives a name from
its description, prints it at startup and includes it in the resume command on
failure. Explicit names use lowercase letters, numbers and single hyphens, up to
60 characters. Use a distinct name for each task; an existing branch or worktree
is never overwritten. Briefs support up to 50,000 characters. File paths are
relative to the terminal's current directory. Resume always uses the saved brief;
passing a new description does not revise an existing task.

The script uses the existing `jiti` dependency. It requires the `codex` executable
on PATH and a saved ChatGPT CLI login. Set `CODEX_BIN` to an absolute path if needed.
It retains the database runner's authentication and model configuration approach,
with no API-billing fallback or model substitution. No new dependencies are added.

## Workflow

1. Create `codex/task-<name>` and an isolated worktree from committed `HEAD`.
2. Research the task and relevant existing code, producing requirements and
   acceptance criteria. External research is used when relevant.
3. Assess whether existing code or dependencies are enough. If they are, record
   that recommendation without unnecessary package discovery. Otherwise compare
   at most three credible approaches and recommend the smallest suitable one.
4. Produce a plan sized to the task. Small features may need only 1–3 stages.
5. Ask meaningful unresolved product, design or architectural questions. Save
   each answer, revise the plan and repeat until no questions remain. Display
   the plan for explicit approval before implementation.
6. Run Detailed Planner → Implementer → Mini Reviewer for each stage. Failed
   reviews return for focused repairs, with up to three repairs by default.
7. Run the Simplicity Checker (GPT-6 Astra, extra-high effort) over the entire
   cumulative change. It offers worthwhile simplifications as multiple-choice
   questions, each with advantages, disadvantages, exact behaviour changes and
   a keep-current option. Preserving all behaviour is preferred; losing a
   capability must be explicit and selected by you.
8. If you select changes, the Impact Planner proposes a targeted amendment for
   approval. Reopen affected stages and their completed dependents, then run
   Detailed Planner → Implementer → Mini Reviewer for those stages. Unaffected
   work stays complete. No research or package-discovery phase is repeated.
9. Perform one final review of the entire result. This reports findings without
   starting another automatic repair loop.

The simplicity pass runs once. An empty report or choosing keep-current for every
finding proceeds directly to final review. Selected changes are batched into one
amendment; behaviour reductions appear in the requirements and revised acceptance
criteria before implementation. A custom answer is treated as a requested change
and goes through the same amendment approval. Choices are saved individually, so
pause/resume also works partway through these questions. The full selected option,
including its tradeoffs, is supplied to subsequent implementation agents.

After simplifications pass their mini-reviews, the final reviewer checks the whole
result against the amended requirements. The simplicity checker does not run again
or repeatedly propose options you declined. The final review uses Astra high.

For example, the dark-mode task can raise decisions about theme selection or
preference persistence when the repository and brief do not settle them. It does
not assume these choices or force a theme library into the implementation.

The original brief is saved in `task.md` and in `run.json`, and is supplied to
every agent. Approved decisions and amendments refine that brief. Agents receive
the current root `AGENTS.md` and must follow applicable repository instructions.

## Scope and review limits

This runner implements repository changes. It does not publish, deploy or modify
external services. It does not commit, merge or push. Only implementation agents
may edit application files; research, planning and review use read-only sandboxes.
Necessary dependency installation uses `--ignore-scripts`.

As in the database runner, tests are not created or changed, and tests, formatting,
linting, type checks and builds are not run. This version retains that fixed policy;
it does not provide an option for automated validation. `PASS` means source review
found no unresolved findings. It does not confirm runtime behaviour, rendered
appearance or visual contrast. Review the result in the reported worktree.

New worktrees exclude uncommitted changes in the original checkout. Commit any
application changes you want included in the starting point before launching a
task. The runner itself executes from the original checkout, so its new files do
not need to be present in the target worktree to launch it.

## Pause, resume and blockers

- Press Ctrl+C once during an agent to pause after it finishes and saves its result.
- Press Ctrl+C twice to interrupt immediately, preserving partial changes.
- At a question or approval, choose Pause or press Ctrl+C. Answers already entered
  remain saved.
- `--pause` prevents the next agent from starting. At a terminal question, choose
  Pause there to exit immediately.
- Usage-limit or CLI failures stop the run with saved progress. Resume manually;
  there is no scheduled retry or polling.

Resume reuses completed agent results, decisions, stages and the original base
commit. An interrupted implementation receives its previous logs and must inspect
partial changes before continuing. A completed final review is displayed again
without another model call. Locks prevent overlapping processes for the same run.

Do not edit a task worktree or its workflow artifacts outside the runner while the
run is active or paused. Resume checks Git state, source fingerprints and approved
documents, and stops on unexpected changes without discarding files.

Architectural blockers open a saved question-and-amendment checkpoint. The planner
proposes targeted changes to existing stages and identifies completed stages to
reopen, including affected dependents. You approve, revise or pause the proposal.
Unaffected completed stages remain complete. Amendments preserve stage numbering
and count; restructuring the entire plan during implementation is not supported.

## Files and configuration

Generated files are Git-ignored and separate from database runs:

```text
.codex-task-orchestrator/
  worktrees/<name>/
  runs/<name>/<timestamp>/
    task.md
    run.json
    models.json
    requirements.md
    dependencies.md
    plan.md / plan.json
    decisions.json
    plans/                 # Planning rounds, questions and saved answers
    stages/                # Instructions, implementations, reviews and attempts
    architecture/          # Blockers, proposed amendments and approvals
    simplicity/            # Whole-change snapshot, findings, questions and answers
    logs/                  # Prompts, structured responses and CLI events
    final.patch
    final-review.md / final-review.json
```

Edit this folder's `config.ts` to configure models, reasoning effort and repair
limits independently of the database runner. The initial defaults are copied from
that runner. The detailed planner chooses implementation effort unless disabled.
Resumed sessions use the current configuration for future agent calls and retain
completed results. Changes to prompts require restarting the runner with `--resume`;
they do not retroactively rewrite an approved plan.

Existing runs still in planning or implementation enter the simplicity step when
their stages finish. A saved run waiting to start final review also enters it.
A final review that has already started or finished is preserved on resume.
