import type { StorageData } from './types'

const DEFAULTS: StorageData = {
  apiProvider: 'claude',
  apiKey: '',
  analysisLanguage: 'zh',
  codingLanguage: 'java',
}

function contextValid() {
  try { return !!chrome.runtime?.id } catch { return false }
}

export async function getStorage(): Promise<StorageData> {
  if (!contextValid()) return { ...DEFAULTS }
  try {
    const stored = await chrome.storage.local.get(Object.keys(DEFAULTS))
    return { ...DEFAULTS, ...stored } as StorageData
  } catch {
    return { ...DEFAULTS }
  }
}

export async function setStorage(updates: Partial<StorageData>): Promise<void> {
  if (!contextValid()) return
  try { await chrome.storage.local.set(updates) } catch { /* context gone */ }
}
