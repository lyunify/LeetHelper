import type { StorageData } from './types'

const DEFAULTS: StorageData = {
  apiProvider: 'claude',
  apiKey: '',
  analysisLanguage: 'zh',
  codingLanguage: 'java',
}

export async function getStorage(): Promise<StorageData> {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS))
  return { ...DEFAULTS, ...stored } as StorageData
}

export async function setStorage(updates: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(updates)
}
