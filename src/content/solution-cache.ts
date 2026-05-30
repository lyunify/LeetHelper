const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CacheEntry<T> {
  data: T
  timestamp: number
}

function cacheKey(slug: string) {
  return `lc_solution_${slug}`
}

export async function getCached<T>(slug: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get(cacheKey(slug))
    const entry = result[cacheKey(slug)] as CacheEntry<T> | undefined
    if (!entry) return null
    if (Date.now() - entry.timestamp > TTL_MS) {
      chrome.storage.local.remove(cacheKey(slug))
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export async function setCached<T>(slug: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() }
    await chrome.storage.local.set({ [cacheKey(slug)]: entry })
  } catch {
    // storage full or unavailable — silently ignore
  }
}
