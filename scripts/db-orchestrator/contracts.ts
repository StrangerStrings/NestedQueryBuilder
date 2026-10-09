import { efforts } from './config.ts'
import type { Effort } from './config.ts'

export type Requirements = { markdown: string }
export type Stage = {
  title: string
  objective: string
  dependencies: number[]
  acceptanceCriteria: string[]
}
export type Plan = { overview: string; stages: Stage[] }
export type DesignQuestion = {
  question: string
  options: { label: string; tradeoff: string }[]
  recommendedIndex: number
}
export type Questions = { questions: DesignQuestion[] }
export type Decision = DesignQuestion & { answer: string }
export type DetailedPlan = {
  instructions: string
  effort: Effort
  requiresDecision: boolean
  decisionReason: string
}
export type Implementation = {
  status: 'COMPLETE' | 'BLOCKED'
  summary: string
  changedFiles: string[]
  concerns: string[]
}
export type Review = {
  status: 'PASS' | 'FAIL' | 'BLOCKED'
  summary: string
  findings: string[]
}
export type PlanImpact = {
  summary: string
  requirementsAddendum: string
  changes: { stageNumber: number; stage: Stage }[]
  reopenStages: number[]
}
export type Outputs = {
  researcher: Requirements
  dependencyAssessor: { markdown: string }
  planner: Plan
  questions: Questions
  detailedPlanner: DetailedPlan
  implementer: Implementation
  miniReviewer: Review
  finalReviewer: Review
  impactPlanner: PlanImpact
}

type Schema = {
  type: 'object' | 'array' | 'string' | 'integer' | 'boolean'
  properties?: Record<string, Schema>
  required?: string[]
  additionalProperties?: false
  items?: Schema
  enum?: readonly string[]
  minLength?: number
  minItems?: number
  minimum?: number
}

// Build strict objects understood by both Codex structured output and our validator.
function object(properties: Record<string, Schema>): Schema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
}

// Build an array schema with an optional minimum number of entries.
function array(items: Schema, minItems = 0): Schema {
  return { type: 'array', items, minItems }
}

const text: Schema = { type: 'string', minLength: 1 }
const optionalText: Schema = { type: 'string' }
const review = object({
  status: { type: 'string', enum: ['PASS', 'FAIL', 'BLOCKED'] },
  summary: text,
  findings: array(text),
})
const stageSchema = object({
  title: text,
  objective: text,
  dependencies: array({ type: 'integer', minimum: 1 }),
  acceptanceCriteria: array(text, 1),
})

export const schemas: Record<keyof Outputs, Schema> = {
  researcher: object({ markdown: text }),
  dependencyAssessor: object({ markdown: text }),
  planner: object({
    overview: text,
    stages: array(object({
      title: text,
      objective: text,
      dependencies: array({ type: 'integer', minimum: 1 }),
      acceptanceCriteria: array(text, 1),
    }), 1),
  }),
  questions: object({
    questions: array(object({
      question: text,
      options: array(object({ label: text, tradeoff: text }), 2),
      recommendedIndex: { type: 'integer', minimum: 0 },
    })),
  }),
  detailedPlanner: object({
    instructions: text,
    effort: { type: 'string', enum: efforts },
    requiresDecision: { type: 'boolean' },
    decisionReason: optionalText,
  }),
  implementer: object({
    status: { type: 'string', enum: ['COMPLETE', 'BLOCKED'] },
    summary: text,
    changedFiles: array(text),
    concerns: array(text),
  }),
  miniReviewer: review,
  finalReviewer: review,
  impactPlanner: object({
    summary: text,
    requirementsAddendum: optionalText,
    changes: array(object({ stageNumber: { type: 'integer', minimum: 1 }, stage: stageSchema })),
    reopenStages: array({ type: 'integer', minimum: 1 }),
  }),
}

// Validate the small schema vocabulary used here before trusting an agent handoff.
export function validate(value: unknown, schema: Schema, path = 'response'): void {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${path} must be an object.`)
    }
    const record = value as Record<string, unknown>
    const properties = schema.properties!
    for (const key of schema.required!) {
      if (!(key in record)) throw new Error(`${path}.${key} is missing.`)
      validate(record[key], properties[key]!, `${path}.${key}`)
    }
    for (const key of Object.keys(record)) {
      if (!Object.hasOwn(properties, key)) throw new Error(`${path}.${key} is unexpected.`)
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0)) {
      throw new Error(`${path} must be an array with at least ${schema.minItems ?? 0} entries.`)
    }
    value.forEach((item, index) => validate(item, schema.items!, `${path}[${index}]`))
  } else if (schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < (schema.minimum ?? 0)) {
      throw new Error(`${path} must be an integer >= ${schema.minimum ?? 0}.`)
    }
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean.`)
  } else if (typeof value !== 'string' || value.trim().length < (schema.minLength ?? 0)) {
    throw new Error(`${path} must be a${schema.minLength ? ' nonempty' : ''} string.`)
  } else if (schema.enum && !schema.enum.includes(value)) {
    throw new Error(`${path} must be one of ${schema.enum.join(', ')}.`)
  }
}

// Reject forward dependencies because implementation stages run sequentially.
export function validatePlan(plan: Plan): void {
  plan.stages.forEach((stage, index) => {
    if (stage.dependencies.some((dependency) => dependency > index)) {
      throw new Error(`Stage ${index + 1} must depend only on earlier stages.`)
    }
  })
}

// Ensure the displayed recommendation actually refers to an offered answer.
export function validateQuestions(result: Questions): void {
  result.questions.forEach((question) => {
    if (question.recommendedIndex >= question.options.length) {
      throw new Error('A design question recommends an option that does not exist.')
    }
  })
}

// Keep review verdicts consistent with their actionable findings.
export function validateReview(result: Review): void {
  if (result.status === 'PASS' && result.findings.length > 0) {
    throw new Error('A passing review cannot contain unresolved findings.')
  }
  if (result.status !== 'PASS' && result.findings.length === 0) {
    throw new Error('A failed or blocked review must explain its findings.')
  }
}
