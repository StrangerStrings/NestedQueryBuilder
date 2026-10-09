import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import sql from 'shiki/langs/sql.mjs'
import json from 'shiki/langs/json.mjs'
import githubLight from 'shiki/themes/github-light.mjs'
import githubDark from 'shiki/themes/github-dark.mjs'

let highlighterPromise: ReturnType<typeof createHighlighterCore> | undefined

// Share one lazy highlighter for the query languages and both appearances.
export function getQueryHighlighter() {
  highlighterPromise ??= createHighlighterCore({
    langs: [sql, json],
    themes: [githubLight, githubDark],
    engine: createJavaScriptRegexEngine(),
  })
  return highlighterPromise
}
