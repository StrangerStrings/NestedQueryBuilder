import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { settings } from './config.ts'
import type { Effort, Role } from './config.ts'
import { schemas, validate, validatePlan, validateQuestions, validateReview, validateSimplicity } from './contracts.ts'
import type { Decision, Outputs, Plan, PlanImpact, Questions, Review, SimplicityReport } from './contracts.ts'
import type { Context } from './prompts.ts'

export type Decisions = { answers: Decision[]; feedback: string[]; approved: boolean; approvedAt?: string }
export type Blocker = {
  kind?: 'simplicity'
  directory: string
  stage: number
  source: string
  step: 'questions' | 'answers' | 'impact' | 'approval' | 'apply'
  revision: number
}
export type Progress = {
  mode: 'research' | 'dependencies' | 'planning' | 'implementation' | 'simplicity' | 'final' | 'done'
  simplicityStep?: 'review' | 'answers' | 'done'
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

// Resume planning, implementation, simplicity decisions and final review at saved handoffs.
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

  // Save each answer immediately, optionally retaining the selected option's full tradeoffs.
  async function answerQuestions(questions: Questions, path: string, includeTradeoff = false): Promise<void> {
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
        let selectedIndex: number | undefined
        if (choice.toLowerCase() === 'c') answer = await host.askText('Your answer: ')
        else if ((/^\d+$/.test(choice) || choice === '') && question.options[index]) {
          selectedIndex = index
          const option = question.options[index]!
          answer = includeTradeoff ? `${option.label}\n${option.tradeoff}` : option.label
        } else continue
        answers.push({ ...question, answer, selectedIndex })
        saveJson(path, answers)
        host.checkpoint()
        break
      }
    }
  }

  // Preserve approved inputs for blocker questions or already-answered simplicity proposals.
  function openBlocker(source: string, simplicityAnswers?: Decision[]): void {
    const id = nextNumber(join(root, 'architecture'))
    const directory = join(root, 'architecture', String(id).padStart(3, '0'))
    mkdirSync(directory, { recursive: true })
    for (const file of ['requirements.md', 'plan.json', 'plan.md', 'decisions.json']) {
      copyFileSync(join(root, file), join(directory, `before-${file}`))
    }
    copyFileSync(source, join(directory, 'blocker.json'))
    saveJson(join(directory, 'completed-stages.json'), progress.completedStages)
    saveJson(join(directory, 'answers.json'), simplicityAnswers ?? [])
    saveJson(join(directory, 'feedback.json'), [])
    progress.blocker = {
      directory, stage: progress.stage, source, revision: 1,
      step: simplicityAnswers ? 'impact' : 'questions',
      kind: simplicityAnswers ? 'simplicity' : undefined,
    }
    if (simplicityAnswers) progress.simplicityStep = 'done'
    console.log(simplicityAnswers
      ? `\nPreparing a targeted amendment for your simplicity choices. Saved findings: ${source}`
      : `\nStage ${progress.stage} needs a decision. Saved blocker: ${source}`)
    advance()
  }

  // Resolve a blocker or simplicity choices with a targeted amendment and explicit approval.
  async function resolveBlocker(): Promise<void> {
    const blocker = progress.blocker!
    const directory = blocker.directory
    if (blocker.step !== 'apply' && progress.approvedDigest !== host.digest()) {
      throw new Error('Approved documents changed while an architectural decision was pending.')
    }
    const task = `${blocker.kind === 'simplicity' ? 'The user has answered the whole-change simplicity findings. Amend only the selected changes; keep-current choices must be preserved.' : `Stage ${blocker.stage} is blocked.`}
Read ${directory}/blocker.json, the approved
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
        if (blocker.kind === 'simplicity' && (!impact.changes.length || !proposal.reopen.length)) {
          throw new Error('A selected simplification must amend and reopen at least one affected stage.')
        }
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
      progress.mode = 'implementation'
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
      const result = await host.agent('researcher', 'Inspect the existing code and research the requested task. Produce focused requirements and acceptance criteria, recording important unresolved product or design choices for the question loop.', 'research')
      writeFileSync(join(root, 'requirements.md'), `${result.markdown}\n`)
      progress.mode = 'dependencies'
      advance()
    } else if (progress.mode === 'dependencies') {
      const result = await host.agent('dependencyAssessor', 'Assess whether existing code and dependencies are sufficient for the saved requirements and existing implementation. Recommend the smallest suitable approach for the planner, with evidence, integration steps and any meaningful choices for the existing question loop. Do not install packages or implement anything.', 'dependency-assessment')
      writeFileSync(join(root, 'dependencies.md'), `${result.markdown}\n`)
      progress.mode = 'planning'
      advance()
    } else if (progress.mode === 'planning') {
      const decisionsPath = join(root, 'decisions.json')
      if (!existsSync(decisionsPath)) saveJson(decisionsPath, { answers: [], feedback: [], approved: false })
      const revisionDir = join(root, 'plans', `revision-${progress.revision}`)
      mkdirSync(revisionDir, { recursive: true })
      if (progress.planningStep === 'plan') {
        // Freeze the existing plan so retries of this round use the same revision baseline.
        const baselinePath = join(revisionDir, 'before-plan.json')
        if (!existsSync(baselinePath) && existsSync(join(root, 'plan.json'))) {
          copyFileSync(join(root, 'plan.json'), baselinePath)
        }
        const task = existsSync(baselinePath)
          ? `Revise the existing plan saved at ${baselinePath}. Do not start from scratch.
Apply all saved answers and revision feedback in decisions.json as authoritative. Preserve unaffected
stages and their criteria. Return the complete updated plan. The question agent will review it again;
implementation cannot begin until a question round returns no unresolved questions and the user approves.`
          : 'Produce the initial plan from the saved requirements and existing architecture. All saved answers and revision feedback in decisions.json are authoritative.'
        console.log(`\nPlanning round ${progress.revision}: ${existsSync(baselinePath) ? 'revising the existing plan' : 'creating the initial plan'}.`)
        const plan = await host.agent('planner', task, `planning-${progress.revision}-plan`)
        validatePlan(plan)
        saveJson(join(root, 'plan.json'), plan)
        writeFileSync(join(root, 'plan.md'), host.renderPlan(plan))
        saveJson(join(revisionDir, 'plan.json'), plan)
        writeFileSync(join(revisionDir, 'plan.md'), host.renderPlan(plan))
        progress.planningStep = 'questions'
        advance()
      } else if (progress.planningStep === 'questions') {
        const questions = await host.agent('questions', 'Review the current plan against all saved answers. Identify only important design questions still unresolved, including follow-up choices created by the latest answers. Return an empty questions array when none remain; do not repeat settled questions or expand scope.', `planning-${progress.revision}-questions`)
        validateQuestions(questions)
        saveJson(join(revisionDir, 'questions.json'), questions)
        saveJson(join(revisionDir, 'before-decisions.json'), readJson<Decisions>(decisionsPath))
        console.log(questions.questions.length
          ? `Planning round ${progress.revision}: ${questions.questions.length} question(s) to answer before revising the plan again.`
          : 'No unresolved design questions remain. The plan is ready for your approval.')
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
        progress.mode = progress.simplicityStep === 'done' ? 'final' : 'simplicity'
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
    } else if (progress.mode === 'simplicity') {
      const directory = join(root, 'simplicity')
      const reportPath = join(directory, 'report.json')
      mkdirSync(directory, { recursive: true })
      if (!progress.simplicityStep || progress.simplicityStep === 'review') {
        host.snapshot(join(directory, 'before.patch'))
        const report = existsSync(reportPath) ? readJson<SimplicityReport>(reportPath, 'simplicityChecker')
          : await host.agent('simplicityChecker', `Inspect the entire change in ${directory}/before.patch and current source. Offer only worthwhile optional simplifications with explicit advantages, disadvantages and behaviour changes for each choice.`, 'simplicity-review')
        validateSimplicity(report)
        saveJson(reportPath, report)
        const questions: Questions = {
          questions: report.findings.map((finding) => ({
            question: `${finding.question}\nEvidence:\n${finding.evidence.join('\n')}`,
            recommendedIndex: finding.recommendedIndex,
            options: finding.options.map((option) => ({
              label: option.label,
              tradeoff: `Action: ${option.action}\n   Advantages: ${option.advantages.join('; ')}\n   Disadvantages: ${option.disadvantages.join('; ')}\n   Behaviour changes: ${option.behaviourChanges}`,
            })),
          })),
        }
        saveJson(join(directory, 'questions.json'), questions)
        const sections = [`# Simplicity review`, report.summary]
        for (const question of questions.questions) {
          sections.push(`## ${question.question}`)
          for (const [index, option] of question.options.entries()) {
            sections.push(`${index + 1}. ${option.label}${index === question.recommendedIndex ? ' (recommended)' : ''}\n   ${option.tradeoff}`)
          }
        }
        writeFileSync(join(directory, 'report.md'), `${sections.join('\n\n')}\n`)
        progress.simplicityStep = 'answers'
        advance()
      } else if (progress.simplicityStep === 'answers') {
        const report = readJson<SimplicityReport>(reportPath, 'simplicityChecker')
        validateSimplicity(report)
        console.log(`\nSimplicity review: ${report.summary}\nReport: ${directory}/report.md`)
        const answersPath = join(directory, 'answers.json')
        if (!existsSync(answersPath)) saveJson(answersPath, [])
        await answerQuestions(readJson<Questions>(join(directory, 'questions.json'), 'questions'), answersPath, true)
        const answers = readJson<Decision[]>(answersPath)
        const changesRequested = answers.some((answer, index) =>
          answer.selectedIndex === undefined || report.findings[index]!.options[answer.selectedIndex]?.action !== 'keep',
        )
        if (changesRequested) {
          openBlocker(reportPath, answers)
        } else {
          console.log('No simplifications selected. Continuing to final review.')
          progress.simplicityStep = 'done'
          progress.mode = 'final'
          advance()
        }
      }
    } else if (progress.mode === 'final') {
      const path = join(root, 'final-review.json')
      if (!existsSync(path)) host.snapshot(join(root, 'final.patch'))
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
