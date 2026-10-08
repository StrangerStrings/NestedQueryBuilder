import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { settings } from './config.ts'
import type { Effort, Role } from './config.ts'
import { schemas, validate, validatePlan, validateQuestions, validateReview } from './contracts.ts'
import type { Decision, Outputs, Plan, PlanImpact, Questions, Review } from './contracts.ts'
import type { Context } from './prompts.ts'

export type Decisions = { answers: Decision[]; feedback: string[]; approved: boolean; approvedAt?: string }
export type Blocker = {
  directory: string
  stage: number
  source: string
  step: 'questions' | 'answers' | 'impact' | 'approval' | 'apply'
  revision: number
}
export type Progress = {
  mode: 'research' | 'planning' | 'implementation' | 'final' | 'done'
  planningStep: 'plan' | 'questions' | 'answers' | 'approval'
  revision: number
  stage: number
  attempt: number
  repairsUsed: number
  stageStep: 'plan' | 'implement' | 'review' | 'verdict'
  previousAttempt?: string
  completedStages: number[]
  blocker?: Blocker
  approvedDigest?: string
}
export type WorkflowHost = {
  context: Context
  progress: Progress
  agent: <R extends Role>(role: R, task: string, key: string, effort?: Effort) => Promise<Outputs[R]>
  checkpoint: () => void
  boundary: () => void
  ask: (message: string) => Promise<string>
  askText: (message: string) => Promise<string>
  saveJson: (path: string, value: unknown) => void
  snapshot: (path: string) => void
  digest: () => string
  renderPlan: (plan: Plan) => string
  renderReview: (review: Review) => string
}

// Read a saved artifact and validate agent output whenever a schema is available.
export function readJson<T>(path: string, role?: Role): T {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (role) validate(value, schemas[role])
  return value as T
}

// Start a run with explicit cursors for every resumable workflow phase.
export function initialProgress(): Progress {
  return {
    mode: 'research', planningStep: 'plan', revision: 1,
    stage: 1, attempt: 0, repairsUsed: 0, stageStep: 'plan', completedStages: [],
  }
}

// Allocate an artifact number without overwriting any earlier attempt or decision.
export function nextNumber(directory: string): number {
  if (!existsSync(directory)) return 1
  const numbers = readdirSync(directory).filter((name) => /^\d+$/.test(name)).map(Number)
  return Math.max(0, ...numbers) + 1
}

// Resolve a stage directory consistently for both old and new run layouts.
function stageDirectory(runDir: string, stage: number): string {
  return join(runDir, 'stages', String(stage).padStart(2, '0'))
}

// Recover legacy runs from their saved artifacts without launching any agents.
export function migrateProgress(runDir: string, completed: number[]): Progress {
  const progress = initialProgress()
  if (!existsSync(join(runDir, 'requirements.md'))) return progress
  progress.mode = 'planning'
  const decisionsPath = join(runDir, 'decisions.json')
  const decisions = existsSync(decisionsPath) ? readJson<Decisions>(decisionsPath) : undefined
  const planPath = join(runDir, 'plan.json')
  if (!decisions?.approved || !existsSync(planPath)) {
    // Legacy planning did not store its cursor, so reuse its latest plan for questions.
    if (existsSync(planPath)) progress.planningStep = 'questions'
    const revisions = existsSync(join(runDir, 'plans')) ? readdirSync(join(runDir, 'plans')) : []
    progress.revision = Math.max(1, ...revisions.map((name) => Number.parseInt(name) || 0))
    return progress
  }
  const plan = readJson<Plan>(planPath, 'planner')
  validatePlan(plan)
  progress.completedStages = completed.filter((number) => number >= 1 && number <= plan.stages.length)
  progress.mode = 'implementation'
  for (let number = 1; number <= plan.stages.length; number++) {
    if (progress.completedStages.includes(number)) continue
    const directory = stageDirectory(runDir, number)
    const attempts = join(directory, 'attempts')
    const attempt = nextNumber(attempts) - 1
    // Old root-level outputs alone are insufficient to guess a successful implementation.
    const current = attempt > 0 ? join(attempts, String(attempt).padStart(2, '0')) : directory
    progress.stage = number
    progress.attempt = attempt
    progress.repairsUsed = Math.max(0, attempt - 1)
    if (attempt > 1) progress.previousAttempt = join(attempts, String(attempt - 1).padStart(2, '0'))
    if (existsSync(join(current, 'review.json'))) {
      const review = readJson<Review>(join(current, 'review.json'), 'miniReviewer')
      validateReview(review)
      if (review.status === 'PASS') {
        progress.completedStages.push(number)
        continue
      }
      progress.stageStep = 'verdict'
    } else if (existsSync(join(current, 'implementation.json'))) {
      const result = readJson<Outputs['implementer']>(join(current, 'implementation.json'), 'implementer')
      progress.stageStep = result.status === 'BLOCKED' ? 'implement' : 'review'
    } else if (existsSync(join(current, 'instructions.json'))) {
      const details = readJson<Outputs['detailedPlanner']>(join(current, 'instructions.json'), 'detailedPlanner')
      progress.stageStep = details.requiresDecision ? 'plan' : 'implement'
    }
    return progress
  }
  progress.mode = 'final'
  return progress
}

// Validate targeted edits and calculate completed stages affected through dependencies.
function applyImpact(plan: Plan, impact: PlanImpact, completed: number[]): { plan: Plan; reopen: number[] } {
  const revised: Plan = { overview: plan.overview, stages: plan.stages.map((stage) => ({ ...stage })) }
  const affected = new Set<number>()
  for (const change of impact.changes) {
    if (!plan.stages[change.stageNumber - 1] || affected.has(change.stageNumber)) {
      throw new Error('The impact proposal contains an unknown or duplicate stage number.')
    }
    affected.add(change.stageNumber)
    revised.stages[change.stageNumber - 1] = change.stage
  }
  for (const number of impact.reopenStages) {
    if (!completed.includes(number)) throw new Error(`Impact proposal cannot reopen incomplete stage ${number}.`)
    affected.add(number)
  }
  validatePlan(revised)
  // Check both graphs so removing a dependency does not hide an affected completed stage.
  for (let index = 0; index < revised.stages.length; index++) {
    const dependencies = [...plan.stages[index]!.dependencies, ...revised.stages[index]!.dependencies]
    if (dependencies.some((number) => affected.has(number))) affected.add(index + 1)
  }
  return { plan: revised, reopen: completed.filter((number) => affected.has(number)) }
}

// Resume the saved cursor and give execution roles focused stage context before each handoff.
export async function runWorkflow(host: WorkflowHost): Promise<void> {
  const { context, progress, saveJson } = host
  const root = context.runDir

  // Commit a cursor transition only after its artifacts have been written.
  function advance(): void {
    host.checkpoint()
    host.boundary()
  }

  // Read the approved plan and enforce sequential dependency constraints on every load.
  function currentPlan(): Plan {
    const plan = readJson<Plan>(join(root, 'plan.json'), 'planner')
    validatePlan(plan)
    return plan
  }

  // Save a terminal answer immediately, allowing the remaining questions to resume later.
  async function answerQuestions(questions: Questions, path: string): Promise<void> {
    validateQuestions(questions)
    const answers = existsSync(path) ? readJson<Decision[]>(path) : []
    for (const question of questions.questions.slice(answers.length)) {
      host.boundary()
      console.log(`\n${question.question}`)
      question.options.forEach((option, index) => console.log(
        `${index + 1}. ${option.label}${index === question.recommendedIndex ? ' (recommended)' : ''}\n   ${option.tradeoff}`,
      ))
      console.log('c. Custom answer\np. Pause and save')
      while (true) {
        const choice = await host.ask(`Choose [Enter = ${question.recommendedIndex + 1}]: `)
        if (choice.toLowerCase() === 'p') throw new Error('Paused by user.')
        const index = choice === '' ? question.recommendedIndex : Number(choice) - 1
        let answer: string
        if (choice.toLowerCase() === 'c') answer = await host.askText('Your answer: ')
        else if ((/^\d+$/.test(choice) || choice === '') && question.options[index]) answer = question.options[index]!.label
        else continue
        answers.push({ ...question, answer })
        saveJson(path, answers)
        host.checkpoint()
        break
      }
    }
  }

  // Preserve the blocker and approved inputs before requesting any new human decisions.
  function openBlocker(source: string): void {
    const id = nextNumber(join(root, 'architecture'))
    const directory = join(root, 'architecture', String(id).padStart(3, '0'))
    mkdirSync(directory, { recursive: true })
    for (const file of ['requirements.md', 'plan.json', 'plan.md', 'decisions.json']) {
      copyFileSync(join(root, file), join(directory, `before-${file}`))
    }
    copyFileSync(source, join(directory, 'blocker.json'))
    saveJson(join(directory, 'completed-stages.json'), progress.completedStages)
    saveJson(join(directory, 'answers.json'), [])
    saveJson(join(directory, 'feedback.json'), [])
    progress.blocker = { directory, stage: progress.stage, source, step: 'questions', revision: 1 }
    console.log(`\nStage ${progress.stage} needs a decision. Saved blocker: ${source}`)
    advance()
  }

  // Resolve one blocker with proposed answers, a narrow plan amendment and explicit approval.
  async function resolveBlocker(): Promise<void> {
    const blocker = progress.blocker!
    const directory = blocker.directory
    if (blocker.step !== 'apply' && progress.approvedDigest !== host.digest()) {
      throw new Error('Approved documents changed while an architectural decision was pending.')
    }
    const task = `Stage ${blocker.stage} is blocked. Read ${directory}/blocker.json, the approved
plan and requirements in before-plan.json and before-requirements.md in that directory, and
${directory}/before-decisions.json. New proposed answers: ${directory}/answers.json.
Revision feedback: ${directory}/feedback.json. Completed stages: ${directory}/completed-stages.json.
Address only this blocker. Do not repeat resolved design questions or restart other stages.`
    if (blocker.step === 'questions') {
      const questions = await host.agent('questions', `${task}\nProvide the meaningful options needed to resolve this blocker.`, `${directory}/questions`)
      validateQuestions(questions)
      saveJson(join(directory, 'questions.json'), questions)
      blocker.step = 'answers'
      advance()
    }
    if (blocker.step === 'answers') {
      const questions = readJson<Questions>(join(directory, 'questions.json'), 'questions')
      const answersPath = join(directory, 'answers.json')
      if (!questions.questions.length && !readJson<Decision[]>(answersPath).length) {
        console.log(`The agent did not provide options. Inspect the saved blocker: ${directory}/blocker.json`)
        const answer = await host.askText('Describe the architectural resolution (or press Ctrl+C to pause): ')
        saveJson(answersPath, [{ question: 'How should the saved architectural blocker be resolved?', options: [], recommendedIndex: 0, answer }])
        host.checkpoint()
      } else {
        await answerQuestions(questions, answersPath)
      }
      blocker.step = 'impact'
      advance()
    }
    if (blocker.step === 'impact') {
      const impact = await host.agent('impactPlanner', task, `${directory}/impact-${blocker.revision}`)
      const plan = readJson<Plan>(join(directory, 'before-plan.json'), 'planner')
      const completed = readJson<number[]>(join(directory, 'completed-stages.json'))
      let proposal: ReturnType<typeof applyImpact>
      try {
        proposal = applyImpact(plan, impact, completed)
      } catch (error) {
        // Keep the invalid response in logs, but allow a fresh proposal on explicit resume.
        host.checkpoint()
        throw error
      }
      const revisionDir = join(directory, `revision-${blocker.revision}`)
      mkdirSync(revisionDir, { recursive: true })
      saveJson(join(revisionDir, 'impact.json'), impact)
      saveJson(join(revisionDir, 'plan.json'), proposal.plan)
      saveJson(join(revisionDir, 'reopen.json'), proposal.reopen)
      writeFileSync(join(revisionDir, 'plan.md'), host.renderPlan(proposal.plan))
      blocker.step = 'approval'
      advance()
    }
    const revisionDir = join(directory, `revision-${blocker.revision}`)
    if (blocker.step === 'approval') {
      const impact = readJson<PlanImpact>(join(revisionDir, 'impact.json'), 'impactPlanner')
      const reopen = readJson<number[]>(join(revisionDir, 'reopen.json'))
      const before = readJson<Plan>(join(directory, 'before-plan.json'), 'planner')
      console.log(`\nProposed architecture amendment:\n${impact.summary}\n\nRequirements amendment:\n${impact.requirementsAddendum || 'None'}\nCompleted stages to reopen: ${reopen.join(', ') || 'None'}`)
      for (const change of impact.changes) {
        console.log(`\nStage ${change.stageNumber} before:\n${host.renderPlan({ overview: '', stages: [before.stages[change.stageNumber - 1]!] })}\nAfter:\n${host.renderPlan({ overview: '', stages: [change.stage] })}`)
      }
      console.log(`Full proposed plan: ${revisionDir}/plan.md`)
      const action = (await host.ask('Approve these changes / Revise / Pause [a/r/p]: ')).toLowerCase()
      if (action === 'p') throw new Error('Paused by user.')
      if (action === 'r') {
        const feedback = readJson<string[]>(join(directory, 'feedback.json'))
        feedback.push(await host.askText('What should change in this proposal? '))
        saveJson(join(directory, 'feedback.json'), feedback)
        blocker.revision++
        blocker.step = 'impact'
        advance()
        return
      }
      if (action !== 'a') return
      saveJson(join(directory, 'approval.json'), { revision: blocker.revision, approvedAt: new Date().toISOString(), reopen })
      blocker.step = 'apply'
      advance()
    }
    if (blocker.step === 'apply') {
      // Replay these deterministic writes after a crash without appending an amendment twice.
      const impact = readJson<PlanImpact>(join(revisionDir, 'impact.json'), 'impactPlanner')
      const approval = readJson<{ approvedAt: string; reopen: number[] }>(join(directory, 'approval.json'))
      const original = readJson<Decisions>(join(directory, 'before-decisions.json'))
      const answers = readJson<Decision[]>(join(directory, 'answers.json'))
      const requirements = readFileSync(join(directory, 'before-requirements.md'), 'utf8')
      copyFileSync(join(revisionDir, 'plan.json'), join(root, 'plan.json'))
      copyFileSync(join(revisionDir, 'plan.md'), join(root, 'plan.md'))
      writeFileSync(join(root, 'requirements.md'), requirements + (impact.requirementsAddendum ? `\n\n## Approved amendment (${approval.approvedAt})\n\n${impact.requirementsAddendum}\n` : ''))
      saveJson(join(root, 'decisions.json'), { ...original, answers: [...original.answers, ...answers], approved: true, approvedAt: approval.approvedAt })
      const completed = readJson<number[]>(join(directory, 'completed-stages.json'))
      progress.completedStages = completed.filter((stage) => !approval.reopen.includes(stage))
      const plan = currentPlan()
      progress.stage = plan.stages.findIndex((_, index) => !progress.completedStages.includes(index + 1)) + 1
      progress.attempt = 0
      progress.repairsUsed = 0
      progress.stageStep = 'plan'
      progress.previousAttempt = undefined
      progress.approvedDigest = host.digest()
      progress.blocker = undefined
      advance()
    }
  }

  while (progress.mode !== 'done') {
    host.boundary()
    if (progress.blocker) {
      await resolveBlocker()
      continue
    }
    if (progress.mode === 'research') {
      const result = await host.agent('researcher', 'Inspect the existing code and research the target database. Produce requirements for the agreed scope.', 'research')
      writeFileSync(join(root, 'requirements.md'), `${result.markdown}\n`)
      progress.mode = 'planning'
      advance()
    } else if (progress.mode === 'planning') {
      const decisionsPath = join(root, 'decisions.json')
      if (!existsSync(decisionsPath)) saveJson(decisionsPath, { answers: [], feedback: [], approved: false })
      const revisionDir = join(root, 'plans', `revision-${progress.revision}`)
      mkdirSync(revisionDir, { recursive: true })
      if (progress.planningStep === 'plan') {
        const plan = await host.agent('planner', 'Produce the current plan. All saved answers and revision feedback in decisions.json are authoritative.', `planning-${progress.revision}-plan`)
        validatePlan(plan)
        saveJson(join(root, 'plan.json'), plan)
        writeFileSync(join(root, 'plan.md'), host.renderPlan(plan))
        saveJson(join(revisionDir, 'plan.json'), plan)
        writeFileSync(join(revisionDir, 'plan.md'), host.renderPlan(plan))
        progress.planningStep = 'questions'
        advance()
      } else if (progress.planningStep === 'questions') {
        const questions = await host.agent('questions', 'Identify important design questions still unresolved in this plan.', `planning-${progress.revision}-questions`)
        validateQuestions(questions)
        saveJson(join(revisionDir, 'questions.json'), questions)
        saveJson(join(revisionDir, 'before-decisions.json'), readJson<Decisions>(decisionsPath))
        progress.planningStep = questions.questions.length ? 'answers' : 'approval'
        advance()
      } else if (progress.planningStep === 'answers') {
        await answerQuestions(readJson<Questions>(join(revisionDir, 'questions.json'), 'questions'), join(revisionDir, 'answers.json'))
        const original = readJson<Decisions>(join(revisionDir, 'before-decisions.json'))
        saveJson(decisionsPath, { ...original, answers: [...original.answers, ...readJson<Decision[]>(join(revisionDir, 'answers.json'))] })
        progress.revision++
        progress.planningStep = 'plan'
        advance()
      } else {
        console.log(`\n${host.renderPlan(currentPlan())}\nSaved plan: ${root}/plan.md`)
        const action = (await host.ask('Approve and implement / Revise / Pause [a/r/p]: ')).toLowerCase()
        if (action === 'p') throw new Error('Paused by user.')
        if (action === 'r') {
          const decisions = readJson<Decisions>(decisionsPath)
          decisions.feedback.push(await host.askText('What should change? '))
          saveJson(decisionsPath, decisions)
          progress.revision++
          progress.planningStep = 'plan'
          advance()
        } else if (action === 'a') {
          saveJson(decisionsPath, { ...readJson<Decisions>(decisionsPath), approved: true, approvedAt: new Date().toISOString() })
          progress.approvedDigest = host.digest()
          progress.mode = 'implementation'
          advance()
        }
      }
    } else if (progress.mode === 'implementation') {
      const plan = currentPlan()
      const next = plan.stages.findIndex((_, index) => !progress.completedStages.includes(index + 1)) + 1
      if (next === 0) {
        progress.mode = 'final'
        advance()
        continue
      }
      if (progress.stage !== next) {
        progress.stage = next
        progress.attempt = 0
        progress.repairsUsed = 0
        progress.stageStep = 'plan'
        progress.previousAttempt = undefined
        advance()
      }
      const number = progress.stage
      const stageDir = stageDirectory(root, number)
      mkdirSync(stageDir, { recursive: true })
      if (!existsSync(join(stageDir, 'before.patch'))) host.snapshot(join(stageDir, 'before.patch'))
      if (progress.attempt === 0) {
        progress.attempt = nextNumber(join(stageDir, 'attempts'))
        advance()
      }
      const attemptDir = join(stageDir, 'attempts', String(progress.attempt).padStart(2, '0'))
      mkdirSync(attemptDir, { recursive: true })
      if (!existsSync(join(attemptDir, 'before.patch'))) host.snapshot(join(attemptDir, 'before.patch'))
      const task = `Stage ${number}/${plan.stages.length}: ${JSON.stringify(plan.stages[number - 1])}
Stage artifacts: ${stageDir}. Current attempt: ${attemptDir}.
Read the current approved requirements, plan and decisions; they supersede obsolete instructions.
Older attempts and blocker resolutions remain in ${stageDir}/attempts and ${root}/architecture.
${progress.previousAttempt ? `Repair the findings in ${progress.previousAttempt}/review.json. Read its implementation report and instructions before making focused corrections.` : 'Implement the current approved stage against the existing code, preserving work already completed.'}`
      // Supply approved answers directly without requiring a full-document reread for each small step.
      const executionTask = progress.stageStep === 'plan' || progress.stageStep === 'implement'
        ? `Approved stage ${number}/${plan.stages.length} (fixed scope and acceptance criteria):
${JSON.stringify(plan.stages[number - 1], null, 2)}

Approved decisions, in order (question and exact answer; use those relevant to this stage):
${JSON.stringify(readJson<Decisions>(join(root, 'decisions.json')).answers.map(({ question, answer }) => ({ question, answer })), null, 2)}

Stage artifacts: ${stageDir}. Current attempt: ${attemptDir}.
The full requirements, plan and decision records remain available at the paths in the prompt.
Use them for specific ambiguities or dependencies, not as a mandatory reading list. Current approved
decisions supersede obsolete instructions. Preserve existing work and implement only this small step.
${progress.previousAttempt ? `Repair findings to address:\n${JSON.stringify(readJson<Review>(join(progress.previousAttempt, 'review.json'), 'miniReviewer'), null, 2)}\nPrevious attempt (reference only): ${progress.previousAttempt}` : ''}`
        : ''
      console.log(`\nStage ${number}/${plan.stages.length}, attempt ${progress.attempt}: ${progress.stageStep}`)
      if (progress.stageStep === 'plan') {
        const path = join(attemptDir, 'instructions.json')
        const details = existsSync(path) ? readJson<Outputs['detailedPlanner']>(path, 'detailedPlanner')
          : await host.agent('detailedPlanner', executionTask, `${attemptDir}/plan`)
        for (const directory of [attemptDir, stageDir]) {
          saveJson(join(directory, 'instructions.json'), details)
          writeFileSync(join(directory, 'instructions.md'), details.instructions)
        }
        if (details.requiresDecision) { openBlocker(path); continue }
        progress.stageStep = 'implement'
        advance()
      } else if (progress.stageStep === 'implement') {
        const path = join(attemptDir, 'implementation.json')
        const details = readJson<Outputs['detailedPlanner']>(join(attemptDir, 'instructions.json'), 'detailedPlanner')
        const result = existsSync(path) ? readJson<Outputs['implementer']>(path, 'implementer')
          : await host.agent('implementer', `${executionTask}\nImplementation instructions:\n${details.instructions}\nSaved copy: ${attemptDir}/instructions.md`, `${attemptDir}/implement`, settings.plannerChoosesImplementationEffort ? details.effort : undefined)
        for (const directory of [attemptDir, stageDir]) {
          saveJson(join(directory, 'implementation.json'), result)
          writeFileSync(join(directory, 'implementation.md'), `# ${result.status}\n\n${result.summary}\n\nChanged files:\n${result.changedFiles.map((file) => `- ${file}`).join('\n')}\n\nConcerns:\n${result.concerns.map((concern) => `- ${concern}`).join('\n')}\n`)
        }
        host.snapshot(join(attemptDir, 'after.patch'))
        copyFileSync(join(attemptDir, 'after.patch'), join(stageDir, 'after.patch'))
        if (result.status === 'BLOCKED') { openBlocker(path); continue }
        progress.stageStep = 'review'
        advance()
      } else if (progress.stageStep === 'review') {
        const path = join(attemptDir, 'review.json')
        const review = existsSync(path) ? readJson<Review>(path, 'miniReviewer')
          : await host.agent('miniReviewer', `${task}\nRead this attempt's instructions.md, implementation.md,
before.patch and after.patch. Compare ${stageDir}/before.patch and ${stageDir}/after.patch for the whole
stage and review against its CURRENT approved criteria. Verify previous findings are resolved and
preserve later-stage work if an architectural amendment has reopened this stage.`, `${attemptDir}/review`)
        validateReview(review)
        for (const directory of [attemptDir, stageDir]) {
          saveJson(join(directory, 'review.json'), review)
          writeFileSync(join(directory, 'review.md'), host.renderReview(review))
        }
        progress.stageStep = 'verdict'
        advance()
      } else {
        const path = join(attemptDir, 'review.json')
        const review = readJson<Review>(path, 'miniReviewer')
        validateReview(review)
        console.log(`[stage ${number}] ${review.status}: ${review.summary}`)
        if (review.status === 'BLOCKED') { openBlocker(path); continue }
        if (review.status === 'PASS') {
          progress.completedStages.push(number)
          advance()
        } else {
          if (progress.repairsUsed >= settings.maxStageRepairAttempts) {
            throw new Error(`Stage ${number} still fails after ${progress.repairsUsed} repairs. See ${attemptDir}/review.md. Increase maxStageRepairAttempts before resuming to allow another repair.`)
          }
          progress.repairsUsed++
          progress.previousAttempt = attemptDir
          progress.attempt = nextNumber(join(stageDir, 'attempts'))
          progress.stageStep = 'plan'
          advance()
        }
      }
    } else if (progress.mode === 'final') {
      const path = join(root, 'final-review.json')
      if (!existsSync(join(root, 'final.patch'))) host.snapshot(join(root, 'final.patch'))
      const review = existsSync(path) ? readJson<Review>(path, 'finalReviewer')
        : await host.agent('finalReviewer', `Review all completed stages and ${root}/final.patch using current approved decisions. Report findings only; never request a repair loop.`, 'final-review')
      validateReview(review)
      saveJson(path, review)
      writeFileSync(join(root, 'final-review.md'), host.renderReview(review))
      progress.mode = 'done'
      advance()
    }
  }
  const review = readJson<Review>(join(root, 'final-review.json'), 'finalReviewer')
  console.log(`\nFinal review: ${review.status}. No automatic repairs follow this review.\nWorktree: ${context.worktree}\nReport: ${root}/final-review.md\nNothing was committed, merged or pushed. Automated validation was not run.`)
}
