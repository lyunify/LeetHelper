export type ProblemStatus = 'solved' | 'attempted' | 'todo' | null

export interface ProblemMeta {
  status: ProblemStatus
  notes: string
}

const KEY_PREFIX = 'lh_meta_'

function contextValid() {
  try { return !!chrome.runtime?.id } catch { return false }
}

const DEFAULT: ProblemMeta = { status: null, notes: '' }

export async function getProblemMeta(slug: string): Promise<ProblemMeta> {
  if (!contextValid()) return { ...DEFAULT }
  try {
    const data = await chrome.storage.local.get(KEY_PREFIX + slug)
    return data[KEY_PREFIX + slug] ?? { ...DEFAULT }
  } catch { return { ...DEFAULT } }
}

export async function setProblemMeta(slug: string, updates: Partial<ProblemMeta>): Promise<void> {
  if (!contextValid()) return
  try {
    const current = await getProblemMeta(slug)
    await chrome.storage.local.set({ [KEY_PREFIX + slug]: { ...current, ...updates } })
  } catch { /* ignore */ }
}
