import React, { useState } from 'react'
import type { AnalysisResult, ExtensionMessage } from '../shared/types'
import { getStorage } from '../shared/storage'

type PanelState = 'idle' | 'loading' | 'result' | 'error'
type SolutionTab = 'optimized' | 'brute'

interface PanelProps {
  title: string
  description: string
}

export default function Panel({ title, description }: PanelProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<SolutionTab>('optimized')
  const [collapsed, setCollapsed] = useState(false)

  const handleAnalyze = async () => {
    setState('loading')
    try {
      const { codingLanguage, analysisLanguage } = await getStorage()

      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PROBLEM',
        payload: { title, description, codingLanguage, analysisLanguage },
      } satisfies ExtensionMessage) as ExtensionMessage

      if (response.type === 'ANALYSIS_RESULT') {
        setResult(response.payload)
        setState('result')
      } else if (response.type === 'ANALYSIS_ERROR') {
        setError(response.payload.message)
        setState('error')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '发生未知错误，请刷新页面重试')
      setState('error')
    }
  }

  const activeSolution = result ? (tab === 'optimized' ? result.optimized : result.bruteForce) : null

  return (
    <div className={`fixed right-0 top-1/2 -translate-y-1/2 z-[9999] flex items-start transition-all duration-200 ${collapsed ? 'translate-x-[280px]' : ''}`}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="bg-indigo-600 text-white px-1.5 py-4 rounded-l-lg text-xs font-bold shadow-lg hover:bg-indigo-700 transition-colors"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        title={collapsed ? '展开 LeetHelper' : '收起'}
      >
        {collapsed ? '▶ LeetHelper' : '◀'}
      </button>

      {/* Panel body */}
      <div className="w-72 bg-white border-l border-t border-b border-gray-200 shadow-xl rounded-l-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-3 py-2 flex items-center justify-between rounded-tl-lg">
          <span className="font-bold text-sm">⚡ LeetHelper</span>
          <span className="text-xs text-indigo-200 truncate max-w-[160px]" title={title}>{title}</span>
        </div>

        <div className="p-3">
          {state === 'idle' && (
            <button
              onClick={handleAnalyze}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              分析题目
            </button>
          )}

          {state === 'loading' && (
            <div className="text-center py-6 text-gray-500">
              <div className="text-2xl mb-2 animate-spin inline-block">⟳</div>
              <p className="text-sm">分析中，请稍候...</p>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
              <button
                onClick={() => setState('idle')}
                className="w-full border border-gray-200 text-gray-600 py-1.5 rounded-lg text-sm hover:bg-gray-50"
              >
                重试
              </button>
            </div>
          )}

          {state === 'result' && result && (
            <div className="space-y-3">
              {/* Explanation */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">题目解释</p>
                <p className="text-sm text-gray-700 leading-relaxed">{result.explanation}</p>
              </div>

              {/* Pattern tags */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">考点</p>
                <div className="flex flex-wrap gap-1">
                  {result.patterns.map(p => (
                    <span key={p} className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Solution tabs */}
              <div>
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => setTab('optimized')}
                    className={`flex-1 text-xs py-1 rounded font-medium border transition-colors ${
                      tab === 'optimized'
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    最优解
                  </button>
                  <button
                    onClick={() => setTab('brute')}
                    className={`flex-1 text-xs py-1 rounded font-medium border transition-colors ${
                      tab === 'brute'
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    暴力解
                  </button>
                </div>

                {activeSolution && (
                  <div className="space-y-2">
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span>时间 <strong className="text-gray-700">{activeSolution.timeComplexity}</strong></span>
                      <span className="text-gray-700">空间 {activeSolution.spaceComplexity}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{activeSolution.explanation}</p>
                    <pre className="bg-gray-900 text-gray-100 text-xs p-2 rounded-lg overflow-x-auto leading-relaxed">
                      {activeSolution.code}
                    </pre>
                  </div>
                )}
              </div>

              {/* Re-analyze */}
              <button
                onClick={() => setState('idle')}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
              >
                重新分析
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
