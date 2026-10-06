import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import sql from 'shiki/langs/sql.mjs'
import json from 'shiki/langs/json.mjs'
import githubLight from 'shiki/themes/github-light.mjs'

let highlighterPromise: ReturnType<typeof createHighlighterCore> | undefined

// Share one lazily created highlighter with only the query languages and light theme.
export function getQueryHighlighter() {
  highlighterPromise ??= createHighlighterCore({
    langs: [sql, json],
    themes: [githubLight],
    engine: createJavaScriptRegexEngine(),
  })
  return highlighterPromise
}
