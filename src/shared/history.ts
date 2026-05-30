export interface HistoryEntry {
  slug: string
  title: string
  timestamp: number
  source: 'ai' | 'lc'
}

const KEY = 'leet_history'
const MAX = 50

export async function addHistory(entry: Omit<HistoryEntry, 'timestamp'>): Promise<void> {
  try {
    const result = await chrome.storage.local.get(KEY)
    const existing = (result[KEY] ?? []) as HistoryEntry[]
    // Remove duplicate slug then prepend
    const filtered = existing.filter(e => e.slug !== entry.slug)
    const updated = [{ ...entry, timestamp: Date.now() }, ...filtered].slice(0, MAX)
    await chrome.storage.local.set({ [KEY]: updated })
  } catch { /* ignore */ }
}

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const result = await chrome.storage.local.get(KEY)
    return (result[KEY] ?? []) as HistoryEntry[]
  } catch {
    return []
  }
}

export async function clearHistory(): Promise<void> {
  try { await chrome.storage.local.remove(KEY) } catch { /* ignore */ }
}
