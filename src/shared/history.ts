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

export function calcStreak(entries: HistoryEntry[]): number {
  if (entries.length === 0) return 0
  const dayMs = 86400000
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const daySet = new Set(entries.map(e => Math.floor(e.timestamp / dayMs) * dayMs))
  // If nothing today, streak must include yesterday at minimum to be nonzero
  const startDay = daySet.has(todayStart) ? todayStart : todayStart - dayMs
  if (!daySet.has(startDay)) return 0
  let streak = 0
  for (let d = startDay; d >= startDay - 365 * dayMs; d -= dayMs) {
    if (daySet.has(d)) streak++
    else break
  }
  return streak
}
