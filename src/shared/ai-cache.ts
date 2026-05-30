import type { AnalysisResult } from './types'

interface CacheEntry {
  result: AnalysisResult
  lang: string
}

const KEY_PREFIX = 'lh_ai_'

function contextValid() {
  try { return !!chrome.runtime?.id } catch { return false }
}

export async function getCachedAnalysis(slug: string, lang: string): Promise<AnalysisResult | null> {
  if (!contextValid()) return null
  try {
    const key = KEY_PREFIX + slug
    const data = await chrome.storage.local.get(key)
    const entry = data[key] as CacheEntry | undefined
    if (!entry || entry.lang !== lang) return null
    return entry.result
  } catch { return null }
}

export async function setCachedAnalysis(slug: string, lang: string, result: AnalysisResult): Promise<void> {
  if (!contextValid()) return
  try {
    await chrome.storage.local.set({ [KEY_PREFIX + slug]: { result, lang } })
  } catch { /* ignore */ }
}
