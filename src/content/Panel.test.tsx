import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import Panel from './Panel'
import type { AnalysisResult } from '../shared/types'

const mockResult: AnalysisResult = {
  explanation: '找两个数使其和等于目标值，返回下标',
  patterns: ['哈希表', '双指针'],
  bruteForce: {
    code: 'for (int i=0;...) for (int j=i+1;...)',
    timeComplexity: 'O(n²)',
    spaceComplexity: 'O(1)',
    explanation: '两层循环枚举所有对',
  },
  optimized: {
    code: 'Map<Integer,Integer> map = new HashMap<>();',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    explanation: '用哈希表记录已见过的数',
  },
}

vi.stubGlobal('chrome', {
  runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
  tabs: { create: vi.fn() },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({ codingLanguage: 'java', analysisLanguage: 'zh' })),
      set: vi.fn(() => Promise.resolve()),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
})

beforeEach(() => vi.clearAllMocks())

describe('Panel', () => {
  it('shows analyze button in idle state', () => {
    render(<Panel title="Two Sum" description="Given an array..." />)
    expect(screen.getByRole('button', { name: /分析题目/ })).toBeInTheDocument()
  })

  it('shows loading state while waiting for response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockReturnValue(new Promise(() => {}))
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    // Loading state shows a skeleton (no button visible)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /分析题目/ })).not.toBeInTheDocument()
    )
  })

  it('shows error message when API returns error', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      type: 'ANALYSIS_ERROR',
      payload: { message: '未设置 API Key' },
    })
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    expect(await screen.findByText(/未设置 API Key/)).toBeInTheDocument()
  })

  it('renders explanation and pattern tags after successful analysis', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      type: 'ANALYSIS_RESULT',
      payload: mockResult,
    })
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    expect(await screen.findByText('找两个数使其和等于目标值，返回下标')).toBeInTheDocument()
    expect(screen.getByText('哈希表')).toBeInTheDocument()
    expect(screen.getByText('双指针')).toBeInTheDocument()
  })

  it('shows optimized solution tab by default', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      type: 'ANALYSIS_RESULT',
      payload: mockResult,
    })
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    await screen.findByText('找两个数使其和等于目标值，返回下标')
    // Optimized solution's code should be visible
    expect(screen.getByText(/HashMap/)).toBeInTheDocument()
  })

  it('switches to brute force tab on click', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      type: 'ANALYSIS_RESULT',
      payload: mockResult,
    })
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    await screen.findByText('找两个数使其和等于目标值，返回下标')
    fireEvent.click(screen.getByRole('button', { name: /暴力解/ }))
    expect(screen.getByText('O(n²)')).toBeInTheDocument()
  })
})
