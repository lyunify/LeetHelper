import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getStorage, setStorage } from './storage'

const mockStore: Record<string, unknown> = {}

vi.stubGlobal('chrome', {
  runtime: { id: 'test-extension-id' },
  storage: {
    local: {
      get: vi.fn((keys: string[]) => {
        const result: Record<string, unknown> = {}
        keys.forEach(k => { if (k in mockStore) result[k] = mockStore[k] })
        return Promise.resolve(result)
      }),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockStore, data)
        return Promise.resolve()
      }),
    },
  },
})

beforeEach(() => { Object.keys(mockStore).forEach(k => delete mockStore[k]) })

describe('getStorage', () => {
  it('returns defaults when storage is empty', async () => {
    const data = await getStorage()
    expect(data.apiProvider).toBe('claude')
    expect(data.codingLanguage).toBe('java')
    expect(data.analysisLanguage).toBe('zh')
    expect(data.apiKey).toBe('')
  })

  it('returns stored value when set', async () => {
    mockStore.apiKey = 'sk-ant-test'
    mockStore.codingLanguage = 'python'
    const data = await getStorage()
    expect(data.apiKey).toBe('sk-ant-test')
    expect(data.codingLanguage).toBe('python')
  })

  it('merges defaults with partial stored values', async () => {
    mockStore.apiKey = 'sk-ant-test'
    const data = await getStorage()
    expect(data.apiKey).toBe('sk-ant-test')
    expect(data.codingLanguage).toBe('java') // still default
  })
})

describe('setStorage', () => {
  it('stores values in chrome.storage.local', async () => {
    await setStorage({ apiKey: 'sk-ant-test' })
    expect(mockStore.apiKey).toBe('sk-ant-test')
  })

  it('stores partial updates without overwriting other keys', async () => {
    mockStore.apiKey = 'existing-key'
    await setStorage({ codingLanguage: 'python' })
    expect(mockStore.apiKey).toBe('existing-key')
    expect(mockStore.codingLanguage).toBe('python')
  })
})
