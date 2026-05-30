export interface HistoryEntry {
  slug: string
  title: string
  timestamp: number
  source: 'ai' | 'lc'
}

const KEY = 'leet_history'
const MAX = 50

function contextValid() {
  try { return !!chrome.runtime?.id } catch { return false }
}

export async function addHistory(entry: Omit<HistoryEntry, 'timestamp'>): Promise<void> {
  if (!contextValid()) return
  try {
    const result = await chrome.storage.local.get(KEY)
    const existing = (result[KEY] ?? []) as HistoryEntry[]
    const filtered = existing.filter(e => e.slug !== entry.slug)
    const updated = [{ ...entry, timestamp: Date.now() }, ...filtered].slice(0, MAX)
    await chrome.storage.local.set({ [KEY]: updated })
  } catch { /* ignore */ }
}

export async function getHistory(): Promise<HistoryEntry[]> {
  if (!contextValid()) return []
  try {
    const result = await chrome.storage.local.get(KEY)
    return (result[KEY] ?? []) as HistoryEntry[]
  } catch {
    return []
  }
}

export async function clearHistory(): Promise<void> {
  if (!contextValid()) return
  try { await chrome.storage.local.remove(KEY) } catch { /* ignore */ }
}
