export const efforts = ['low', 'medium', 'high', 'xhigh'] as const
export type Effort = (typeof efforts)[number]

export type AgentConfig = {
  model: string
  effort: Effort
}

// Keep model choices here so each role can be configured independently.
export const agents = {
  researcher: { model: 'gpt-6.1-sol', effort: 'high' },
  dependencyAssessor: { model: 'gpt-6.1-sol', effort: 'medium' },
  planner: { model: 'gpt-6-astra', effort: 'high' },
  // The same high-level planner runs a narrow impact assessment for new decisions.
  impactPlanner: { model: 'gpt-6-astra', effort: 'high' },
  questions: { model: 'gpt-6.1-sol', effort: 'medium' },
  detailedPlanner: { model: 'gpt-6.1-sol', effort: 'medium' },
  implementer: { model: 'gpt-6.1-sol', effort: 'medium' },
  miniReviewer: { model: 'gpt-6.1-sol', effort: 'medium' },
  simplicityChecker: { model: 'gpt-6-astra', effort: 'xhigh' },
  finalReviewer: { model: 'gpt-6-astra', effort: 'xhigh' },
} satisfies Record<string, AgentConfig>

export type Role = keyof typeof agents

export const settings = {
  codexExecutable: process.env.CODEX_BIN || 'codex',
  // The detailed planner selects implementation effort unless this is disabled.
  plannerChoosesImplementationEffort: true,
  // Allow this many correction cycles after the initial mini review fails.
  maxStageRepairAttempts: 3,
}
