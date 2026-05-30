import type { AnalysisResult } from './types'
import type { LeetCodeSolution } from '../content/leetcode-api'

function contextValid() {
  try { return !!chrome.runtime?.id } catch { return false }
}

// ── AI result cache (keyed by slug + lang) ──────────────────────────────────
interface AICacheEntry { result: AnalysisResult; lang: string }
const AI_PREFIX = 'lh_ai_'

export async function getCachedAnalysis(slug: string, lang: string): Promise<AnalysisResult | null> {
  if (!contextValid()) return null
  try {
    const data = await chrome.storage.local.get(AI_PREFIX + slug)
    const entry = data[AI_PREFIX + slug] as AICacheEntry | undefined
    if (!entry || entry.lang !== lang) return null
    return entry.result
  } catch { return null }
}

export async function setCachedAnalysis(slug: string, lang: string, result: AnalysisResult): Promise<void> {
  if (!contextValid()) return
  try { await chrome.storage.local.set({ [AI_PREFIX + slug]: { result, lang } }) } catch { /* ignore */ }
}

// ── LC solution list cache (keyed by slug + lang) ───────────────────────────
interface LCCacheEntry { solutions: LeetCodeSolution[]; lang: string }
const LC_PREFIX = 'lh_lc_'

export async function getCachedLCSolutions(slug: string, lang: string): Promise<LeetCodeSolution[] | null> {
  if (!contextValid()) return null
  try {
    const data = await chrome.storage.local.get(LC_PREFIX + slug)
    const entry = data[LC_PREFIX + slug] as LCCacheEntry | undefined
    if (!entry || entry.lang !== lang) return null
    return entry.solutions
  } catch { return null }
}

export async function setCachedLCSolutions(slug: string, lang: string, solutions: LeetCodeSolution[]): Promise<void> {
  if (!contextValid()) return
  try { await chrome.storage.local.set({ [LC_PREFIX + slug]: { solutions, lang } }) } catch { /* ignore */ }
}
