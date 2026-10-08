import { spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { agents, settings } from './config.ts'
import type { Effort, Role } from './config.ts'
import { schemas, validate, validatePlan, validateQuestions, validateReview } from './contracts.ts'
import type { Decision, Outputs, Plan, Review } from './contracts.ts'
import { agentPrompt } from './prompts.ts'
import type { Context } from './prompts.ts'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
let context: Context | undefined
let child: ChildProcess | undefined
let questionController: AbortController | undefined
let interrupted = false
let callNumber = 0
let phase = 'setup'
const completedStages: number[] = []

// Run local commands without shell interpolation and surface failures directly.
function command(executable: string, args: string[], cwd = repository, allowedCodes = [0]): string {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: cliEnvironment(),
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (!allowedCodes.includes(result.status ?? -1)) {
    throw new Error(`${executable} ${args[0]} failed: ${result.stderr || result.stdout}`)
  }
  return result.stdout
}

// Remove API credential overrides so child sessions use the saved ChatGPT login.
function cliEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env }
  delete environment.OPENAI_API_KEY
  delete environment.CODEX_API_KEY
  return environment
}

// Save human-readable JSON artifacts without requiring agents to write files.
function saveJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

// Record progress for inspection; this first version deliberately has no resume command.
function saveState(status: string, detail = ''): void {
  if (!context) return
  saveJson(join(context.runDir, 'run.json'), {
    database: context.database,
    branch: context.branch,
    worktree: context.worktree,
    baseCommit: context.baseCommit,
    status,
    phase,
    completedStages,
    detail,
    updatedAt: new Date().toISOString(),
    validation: 'Not run: tests, formatting, linting, type checks and builds are disabled.',
  })
}

// Request a terminal answer and treat Ctrl+C or a closed terminal as a stop.
async function ask(message: string): Promise<string> {
  if (interrupted) throw new Error('Stopped by user.')
  const terminal = createInterface({ input: process.stdin, output: process.stdout })
  const controller = new AbortController()
  questionController = controller
  terminal.once('SIGINT', () => controller.abort())
  terminal.once('close', () => controller.abort())
  try {
    return (await terminal.question(message, { signal: controller.signal })).trim()
  } catch {
    throw new Error('Stopped by user or terminal closed.')
  } finally {
    terminal.close()
    questionController = undefined
  }
}

// Require nonempty text for custom decisions and revision feedback.
async function askText(message: string): Promise<string> {
  while (true) {
    const answer = await ask(message)
    if (answer) return answer
    console.log('Please enter an answer.')
  }
}

// Render the structured plan consistently for both disk and terminal approval.
function renderPlan(plan: Plan): string {
  const stages = plan.stages.map((stage, index) =>
    `## ${index + 1}. ${stage.title}\n\n${stage.objective}\n\n` +
    `Dependencies: ${stage.dependencies.join(', ') || 'None'}\n\n` +
    `Acceptance criteria:\n${stage.acceptanceCriteria.map((item) => `- ${item}`).join('\n')}`,
  )
  return `# Database implementation plan\n\n${plan.overview}\n\n${stages.join('\n\n')}\n`
}

// Render reviews as Markdown while retaining their structured JSON counterparts.
function renderReview(review: Review): string {
  return `# ${review.status}\n\n${review.summary}\n\n` +
    `${review.findings.map((finding) => `- ${finding}`).join('\n')}\n` +
    '\nSource review only. No tests, formatting, linting, type checks or builds were run.\n'
}

// Capture all current source changes, including newly created files, without staging them.
function snapshot(path: string): void {
  const current = context!
  let patch = command('git', ['diff', '--binary', '--no-ext-diff', '--no-textconv', current.baseCommit, '--'], current.worktree)
  const untracked = command('git', ['ls-files', '--others', '--exclude-standard', '-z'], current.worktree)
  for (const file of untracked.split('\0').filter(Boolean)) {
    patch += command('git', ['diff', '--no-index', '--binary', '--no-ext-diff', '--no-textconv', '--', '/dev/null', file], current.worktree, [0, 1])
  }
  writeFileSync(path, patch)
}

// Detect changes to the approved contract after each implementation or review session.
function contractDigest(): string {
  const hash = createHash('sha256')
  for (const file of ['requirements.md', 'plan.md', 'plan.json', 'decisions.json']) {
    hash.update(readFileSync(join(context!.runDir, file)))
  }
  return hash.digest('hex')
}

// Refuse to continue if an agent changed the branch, committed, or staged changes.
function assertGitState(): void {
  const current = context!
  const head = command('git', ['rev-parse', 'HEAD'], current.worktree).trim()
  const branch = command('git', ['branch', '--show-current'], current.worktree).trim()
  const staged = command('git', ['diff', '--cached', '--name-only'], current.worktree).trim()
  if (head !== current.baseCommit || branch !== current.branch || staged) {
    throw new Error('The worktree Git state changed unexpectedly. Inspect it manually; no rollback was attempted.')
  }
}

// Show useful activity from the event stream while preserving complete raw logs.
function showEvent(line: string, role: Role): void {
  try {
    const event = JSON.parse(line)
    if (event.type === 'item.started' && event.item?.type === 'command_execution') {
      console.log(`[${role}] Inspecting or updating the workspace…`)
    } else if (event.type === 'item.completed' && event.item?.type === 'web_search') {
      console.log(`[${role}] Researched database documentation.`)
    } else if (event.type === 'turn.failed' || event.type === 'error') {
      console.log(`[${role}] Reported an error; details are in the event log.`)
    }
  } catch {
    // Non-JSON diagnostics remain available in the raw log.
  }
}

// Launch one independent CLI session and wait for it to exit before handing off.
async function executeAgent(args: string[], prompt: string, logPrefix: string, role: Role): Promise<void> {
  if (interrupted) throw new Error('Stopped by user.')
  const events = openSync(`${logPrefix}.events.jsonl`, 'w')
  const diagnostics = openSync(`${logPrefix}.stderr.log`, 'w')
  let pending = ''
  const startedAt = Date.now()
  const heartbeat = setInterval(() => {
    console.log(`[${role}] Working (${Math.floor((Date.now() - startedAt) / 1000)}s). Logs: ${logPrefix}.events.jsonl`)
  }, 30_000)
  try {
    await new Promise<void>((resolveExit, rejectExit) => {
      child = spawn(settings.codexExecutable, args, {
        cwd: context!.worktree,
        env: cliEnvironment(),
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', diagnostics],
      })
      child.once('error', rejectExit)
      child.stdout!.setEncoding('utf8')
      child.stdout!.on('data', (chunk: string) => {
        writeSync(events, chunk)
        pending += chunk
        let newline: number
        while ((newline = pending.indexOf('\n')) !== -1) {
          showEvent(pending.slice(0, newline), role)
          pending = pending.slice(newline + 1)
        }
      })
      child.stdin!.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EPIPE') rejectExit(error)
      })
      child.once('close', (code, signal) => {
        if (interrupted) rejectExit(new Error('Stopped by user.'))
        else if (code !== 0) rejectExit(new Error(`${role} exited with ${signal || code}. See ${logPrefix}.stderr.log`))
        else resolveExit()
      })
      child.stdin!.end(prompt)
    })
  } finally {
    clearInterval(heartbeat)
    child = undefined
    closeSync(events)
    closeSync(diagnostics)
  }
}

// Run a role with an explicit model, schema and task, then validate its final response.
async function runAgent<R extends Role>(role: R, task: string, effort?: Effort, approvedDigest?: string): Promise<Outputs[R]> {
  const current = context!
  assertGitState()
  if (approvedDigest && contractDigest() !== approvedDigest) {
    throw new Error('An approved workflow document changed before the next agent started.')
  }
  phase = role
  saveState('running')
  const agent = agents[role]
  const selectedEffort = effort ?? agent.effort
  const prefix = join(current.runDir, 'logs', `${String(++callNumber).padStart(3, '0')}-${role}`)
  const outputPath = `${prefix}.response.json`
  const schemaPath = `${prefix}.schema.json`
  const prompt = agentPrompt(role, current, task)
  writeFileSync(`${prefix}.prompt.md`, prompt)
  saveJson(schemaPath, schemas[role])
  const args = [
    '--search', '--ask-for-approval', 'never',
    'exec', '--cd', current.worktree,
    '--model', agent.model,
    '--config', `model_reasoning_effort=${JSON.stringify(selectedEffort)}`,
    '--config', 'model_provider="openai"',
    '--config', 'forced_login_method="chatgpt"',
    '--config', 'sandbox_workspace_write.network_access=true',
    '--sandbox', role === 'implementer' ? 'workspace-write' : 'read-only',
    '--json', '--color', 'never',
    '--output-schema', schemaPath,
    '--output-last-message', outputPath,
    '-',
  ]
  saveJson(`${prefix}.invocation.json`, { executable: settings.codexExecutable, args })
  console.log(`\n[${role}] ${agent.model} / ${selectedEffort}`)
  await executeAgent(args, prompt, prefix, role)
  assertGitState()
  if (approvedDigest && contractDigest() !== approvedDigest) {
    throw new Error('An approved workflow document changed. Inspect the artifacts before continuing.')
  }
  const result: unknown = JSON.parse(readFileSync(outputPath, 'utf8'))
  validate(result, schemas[role])
  return result as Outputs[R]
}

// Collect human architecture decisions, including recommended or custom answers.
async function collectDecisions(questions: Outputs['questions'], answers: Decision[], persist: () => void): Promise<void> {
  phase = 'awaiting-design-decisions'
  saveState('awaiting-user')
  for (const question of questions.questions) {
    console.log(`\n${question.question}`)
    question.options.forEach((option, index) => {
      console.log(`${index + 1}. ${option.label}${index === question.recommendedIndex ? ' (recommended)' : ''}\n   ${option.tradeoff}`)
    })
    console.log('c. Custom answer\ns. Stop')
    while (true) {
      const choice = await ask(`Choose [Enter = ${question.recommendedIndex + 1}]: `)
      if (choice.toLowerCase() === 's') throw new Error('Stopped by user.')
      const index = choice === '' ? question.recommendedIndex : Number(choice) - 1
      let answer: string
      if (choice.toLowerCase() === 'c') answer = await askText('Your answer: ')
      else if (/^\d+$/.test(choice) || choice === '') {
        if (!Number.isInteger(index) || !question.options[index]) continue
        answer = question.options[index]!.label
      } else {
        console.log('Enter an option number, c, or s.')
        continue
      }
      answers.push({ ...question, answer })
      persist()
      break
    }
  }
}

// Revise the plan around human decisions until the user explicitly approves it.
async function approvePlan(): Promise<Plan> {
  const current = context!
  const answers: Decision[] = []
  const feedback: string[] = []
  const decisionsPath = join(current.runDir, 'decisions.json')
  // Persist every response immediately so stopping does not lose human input.
  const persist = () => saveJson(decisionsPath, { answers, feedback, approved: false })
  persist()
  let revision = 0
  while (true) {
    const plan = await runAgent('planner', 'Produce the current plan. All saved answers and revision feedback in decisions.json are authoritative.')
    validatePlan(plan)
    const markdown = renderPlan(plan)
    saveJson(join(current.runDir, 'plan.json'), plan)
    writeFileSync(join(current.runDir, 'plan.md'), markdown)
    writeFileSync(join(current.runDir, 'plans', `${++revision}.md`), markdown)
    const questions = await runAgent('questions', 'Identify any important design questions still unresolved in this version of the plan.')
    validateQuestions(questions)
    if (questions.questions.length) {
      await collectDecisions(questions, answers, persist)
      console.log('\nUpdating the plan to incorporate your answers…')
      continue
    }
    console.log(`\n${markdown}\nSaved plan: ${join(current.runDir, 'plan.md')}`)
    phase = 'awaiting-plan-approval'
    saveState('awaiting-user')
    let revise = false
    while (!revise) {
      const action = (await ask('Approve and implement / Revise / Stop [a/r/s]: ')).toLowerCase()
      if (action === 'a') {
        saveJson(decisionsPath, { answers, feedback, approved: true, approvedAt: new Date().toISOString() })
        return plan
      }
      if (action === 's') throw new Error('Stopped by user.')
      if (action === 'r') {
        feedback.push(await askText('What should change? '))
        persist()
        revise = true
      }
    }
  }
}

// Repair failed mini reviews within each stage, then run the final review exactly once.
async function implementPlan(plan: Plan): Promise<void> {
  const current = context!
  const approvedDigest = contractDigest()
  for (const [index, stage] of plan.stages.entries()) {
    const number = index + 1
    const stageDir = join(current.runDir, 'stages', String(number).padStart(2, '0'))
    mkdirSync(stageDir)
    console.log(`\nStage ${number}/${plan.stages.length}: ${stage.title}`)
    snapshot(join(stageDir, 'before.patch'))
    const task = `Stage ${number}: ${JSON.stringify(stage)}\nStage artifact directory: ${stageDir}`
    let previousAttemptDir: string | undefined
    for (let attempt = 0; ; attempt++) {
      const attemptDir = join(stageDir, 'attempts', String(attempt + 1).padStart(2, '0'))
      mkdirSync(attemptDir, { recursive: true })
      snapshot(join(attemptDir, 'before.patch'))
      const feedback = previousAttemptDir
        ? `Repair the failed mini review. Read ${previousAttemptDir}/review.json and its instructions.md,
implementation.md and change snapshots. Address every finding using the current code, preserving
the original stage requirements and approved decisions. This is a correction, not a new stage.`
        : 'Implement this stage for the first time.'
      const attemptTask = `${task}\nAttempt ${attempt + 1} artifacts: ${attemptDir}\n${feedback}`
      const details = await runAgent('detailedPlanner', attemptTask, undefined, approvedDigest)
      for (const directory of [stageDir, attemptDir]) {
        saveJson(join(directory, 'instructions.json'), details)
        writeFileSync(join(directory, 'instructions.md'), details.instructions)
      }
      if (details.requiresDecision) {
        throw new Error(`Stage ${number} requires an architectural decision: ${details.decisionReason || details.instructions}`)
      }
      const effort = settings.plannerChoosesImplementationEffort ? details.effort : agents.implementer.effort
      const result = await runAgent('implementer', `${attemptTask}\nRead and carry out ${attemptDir}/instructions.md.`, effort, approvedDigest)
      for (const directory of [stageDir, attemptDir]) {
        saveJson(join(directory, 'implementation.json'), result)
        writeFileSync(join(directory, 'implementation.md'), `# ${result.status}\n\n${result.summary}\n\nChanged files:\n${result.changedFiles.map((file) => `- ${file}`).join('\n')}\n\nConcerns:\n${result.concerns.map((concern) => `- ${concern}`).join('\n')}\n`)
      }
      snapshot(join(stageDir, 'after.patch'))
      copyFileSync(join(stageDir, 'after.patch'), join(attemptDir, 'after.patch'))
      if (result.status === 'BLOCKED') throw new Error(`Stage ${number} blocked: ${result.summary}`)
      const reviewTask = `${task}\nReview attempt ${attempt + 1} using ${attemptDir}/instructions.md,
implementation.md, before.patch and after.patch. Also read the original instructions at
${stageDir}/attempts/01/instructions.md and compare ${stageDir}/before.patch with
${stageDir}/after.patch to review the entire stage against its original acceptance criteria.
${previousAttemptDir ? `Verify every finding in ${previousAttemptDir}/review.json is resolved and inspect for regressions introduced by the repair.` : ''}`
      const review = await runAgent('miniReviewer', reviewTask, undefined, approvedDigest)
      validateReview(review)
      for (const directory of [stageDir, attemptDir]) {
        saveJson(join(directory, 'review.json'), review)
        writeFileSync(join(directory, 'review.md'), renderReview(review))
      }
      console.log(`[stage ${number}, attempt ${attempt + 1}] ${review.status}: ${review.summary}`)
      if (review.status === 'PASS') break
      if (review.status === 'BLOCKED') {
        throw new Error(`Stage ${number} review BLOCKED. See ${attemptDir}/review.md`)
      }
      if (attempt >= settings.maxStageRepairAttempts) {
        throw new Error(`Stage ${number} still fails after ${settings.maxStageRepairAttempts} repair attempts. See ${attemptDir}/review.md`)
      }
      previousAttemptDir = attemptDir
      console.log(`Returning findings to the Detailed Planner for repair ${attempt + 1}/${settings.maxStageRepairAttempts}.`)
    }
    completedStages.push(number)
    saveState('running')
  }
  snapshot(join(current.runDir, 'final.patch'))
  const review = await runAgent('finalReviewer', `Review all ${plan.stages.length} stages and ${current.runDir}/final.patch.`, undefined, approvedDigest)
  validateReview(review)
  saveJson(join(current.runDir, 'final-review.json'), review)
  writeFileSync(join(current.runDir, 'final-review.md'), renderReview(review))
  if (review.status !== 'PASS') throw new Error(`Final review ${review.status}. See ${current.runDir}/final-review.md`)
  phase = 'ready-for-human-review'
  saveState('complete')
  console.log(`\nReady for your review. Nothing was committed, merged or pushed.\nBranch: ${current.branch}\nWorktree: ${current.worktree}\nReview: ${current.runDir}/final-review.md\nAutomated validation was not run.`)
}

// Verify the saved login method without reading or printing authentication secrets.
function requireChatGptLogin(): void {
  const result = spawnSync(settings.codexExecutable, ['login', 'status'], {
    cwd: repository, env: cliEnvironment(), encoding: 'utf8',
  })
  if (result.error) throw new Error(`Cannot start Codex. Install the CLI or set CODEX_BIN. ${result.error.message}`)
  const status = `${result.stdout}\n${result.stderr}`
  if (result.status !== 0 || !/logged in using chatgpt/i.test(status)) {
    throw new Error('A saved ChatGPT CLI login is required. Run codex login in your terminal, then try again. API authentication is not used.')
  }
}

// Create a new database worktree from HEAD, never copying or changing existing local edits.
function prepareRun(database: string): Context {
  const slug = database.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  if (!slug) throw new Error('The database name must include an ASCII letter or number.')
  const storage = join(repository, '.codex-orchestrator')
  const worktree = join(storage, 'worktrees', slug)
  const branch = `codex/database-${slug}`
  if (existsSync(worktree)) throw new Error(`A worktree for this database already exists: ${worktree}. Existing runs are never overwritten; resume is not implemented.`)
  const branches = command('git', ['branch', '--list', branch]).trim()
  if (branches) throw new Error(`Branch ${branch} already exists. Review or rename it before starting a new run.`)
  const baseCommit = command('git', ['rev-parse', 'HEAD']).trim()
  const projectRules = readFileSync(join(repository, 'AGENTS.md'), 'utf8')
  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const runDir = join(storage, 'runs', slug, runId)
  const dirty = command('git', ['status', '--porcelain']).trim()
  if (dirty) console.log('The current checkout has local changes. The new worktree starts from HEAD and excludes those changes.')
  mkdirSync(join(runDir, 'logs'), { recursive: true })
  mkdirSync(join(runDir, 'plans'))
  mkdirSync(join(runDir, 'stages'))
  mkdirSync(dirname(worktree), { recursive: true })
  command('git', ['worktree', 'add', '-b', branch, worktree, baseCommit])
  return {
    database, worktree, branch, runDir, baseCommit, projectRules,
  }
}

// Stop the active CLI process group so interruption does not leave an implementer running.
function stop(): void {
  interrupted = true
  questionController?.abort()
  if (!child?.pid) return
  try {
    if (process.platform === 'win32') child.kill('SIGTERM')
    else process.kill(-child.pid, 'SIGTERM')
  } catch {
    // The child may already have exited before the signal was delivered.
  }
}

// Accept the database as the only required argument and run the seven-role workflow.
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: npm run db:add -- "SQLite"\n\nCreates a database worktree from HEAD and leaves uncommitted changes for review.\nModels and mini-review repair limit: scripts/db-orchestrator/config.ts\nRequires an interactive terminal and codex login using ChatGPT.\nFailed mini reviews return to planning and implementation; final review runs once.\nNo tests, formatting, linting, type checks, builds, commits, merging or interrupted-run recovery.')
    return
  }
  const database = args.join(' ').trim()
  if (!database || database.length > 120 || /[\x00-\x1f\x7f]/.test(database) || args.some((arg) => arg.startsWith('-'))) {
    throw new Error('Provide a database name, for example: npm run db:add -- "SQLite"')
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run this command in an interactive terminal for design questions and plan approval.')
  if (!Number.isInteger(settings.maxStageRepairAttempts) || settings.maxStageRepairAttempts < 0) {
    throw new Error('maxStageRepairAttempts must be a nonnegative integer.')
  }
  requireChatGptLogin()
  context = prepareRun(database)
  saveState('running')
  saveJson(join(context.runDir, 'models.json'), { agents, settings })
  console.log(`Database: ${database}\nWorktree: ${context.worktree}\nArtifacts: ${context.runDir}`)
  const requirements = await runAgent('researcher', 'Inspect the existing code and research the target database. Produce requirements for the agreed scope.')
  writeFileSync(join(context.runDir, 'requirements.md'), `${requirements.markdown}\n`)
  const plan = await approvePlan()
  await implementPlan(plan)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

// Preserve artifacts and report the stop without retries, rollback, or Git mutations.
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  saveState(interrupted || message.startsWith('Stopped by user') ? 'stopped' : 'failed', message)
  console.error(`\n${message}`)
  if (context) console.error(`Worktree preserved: ${context.worktree}\nArtifacts preserved: ${context.runDir}`)
  process.exitCode = 1
})
