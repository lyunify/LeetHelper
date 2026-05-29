import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

const mockStore: Record<string, unknown> = {}

vi.stubGlobal('chrome', {
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

beforeEach(() => {
  Object.keys(mockStore).forEach(k => delete mockStore[k])
  vi.clearAllMocks()
})

describe('App (Popup)', () => {
  it('renders LeetHelper heading', async () => {
    render(<App />)
    expect(await screen.findByText(/LeetHelper/)).toBeInTheDocument()
  })

  it('shows "请填写 API Key" when no key is stored', async () => {
    render(<App />)
    expect(await screen.findByText(/请填写 API Key/)).toBeInTheDocument()
  })

  it('shows "已连接" when API key is present', async () => {
    mockStore.apiKey = 'sk-ant-test'
    render(<App />)
    expect(await screen.findByText(/已连接/)).toBeInTheDocument()
  })

  it('saves API key to chrome storage on input change', async () => {
    render(<App />)
    const input = await screen.findByPlaceholderText('sk-ant-...')
    fireEvent.change(input, { target: { value: 'sk-ant-newkey' } })
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ apiKey: 'sk-ant-newkey' })
    })
  })

  it('defaults to Java coding language', async () => {
    render(<App />)
    const javaButton = await screen.findByRole('button', { name: 'Java' })
    expect(javaButton).toHaveClass('bg-indigo-100')
  })

  it('saves coding language when a language button is clicked', async () => {
    render(<App />)
    const pythonButton = await screen.findByRole('button', { name: 'Python' })
    fireEvent.click(pythonButton)
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ codingLanguage: 'python' })
    })
  })
})
