import React, { useState, useRef, useEffect } from 'react'
import type { AnalysisResult, ExtensionMessage, SolutionSource } from '../shared/types'
import { getStorage } from '../shared/storage'
import { fetchTopSolutions, fetchSolutionContent, getTitleSlug } from './leetcode-api'
import type { LeetCodeSolution } from './leetcode-api'

type PanelState = 'idle' | 'loading' | 'result' | 'error'
type SolutionTab = 'optimized' | 'brute'

interface PanelProps {
  title: string
  description: string
}

export default function Panel({ title, description }: PanelProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [lcSolutions, setLcSolutions] = useState<LeetCodeSolution[]>([])
  const [lcIndex, setLcIndex] = useState(0)
  const [lcDetail, setLcDetail] = useState<Record<string, { code: string; allCodes: Record<string, string>; timeComplexity: string; spaceComplexity: string } | null>>({})
  const [lcLang, setLcLang] = useState<Record<string, string>>({}) // slug -> selected lang
  const [error, setError] = useState('')
  const [tab, setTab] = useState<SolutionTab>('optimized')
  const [source, setSource] = useState<SolutionSource>('ai')
  const [collapsed, setCollapsed] = useState(false)

  const [position, setPosition] = useState({ x: window.innerWidth - 308, y: 80 })
  const [size, setSize] = useState({ w: 288, h: 480 })
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const isResizing = useRef(false)
  const resizeStart = useRef({ x: 0, y: 0, w: 288, h: 480, px: 0 })

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)),
        })
      }
      if (isResizing.current) {
        const { x, y, w, h, px } = resizeStart.current
        const dw = x - e.clientX  // dragging left increases width
        const dh = e.clientY - y  // dragging down increases height
        const newW = Math.max(240, Math.min(560, w + dw))
        const newH = Math.max(200, Math.min(window.innerHeight * 0.8, h + dh))
        setSize({ w: newW, h: newH })
        // shift panel left so right edge stays fixed
        setPosition(p => ({ ...p, x: px - newW }))
      }
    }
    const onMouseUp = () => {
      isDragging.current = false
      isResizing.current = false
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    const sol = lcSolutions[lcIndex]
    if (!sol || !sol.slug) return
    if (sol.code || lcDetail[sol.slug] !== undefined) return // already have code or already fetched
    fetchSolutionContent(sol.slug)
      .then(detail => setLcDetail(prev => ({ ...prev, [sol.slug]: detail.code || detail.timeComplexity ? detail : null })))
      .catch(() => setLcDetail(prev => ({ ...prev, [sol.slug]: null })))
  }, [lcIndex, lcSolutions])

  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    e.preventDefault()
  }

  const handleAnalyzeAI = async () => {
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

  const handleFetchLeetCode = async () => {
    setState('loading')
    try {
      const titleSlug = getTitleSlug()
      if (!titleSlug) throw new Error('无法识别题目链接，请确认在题目页面')
      const { codingLanguage } = await getStorage()
      const solutions = await fetchTopSolutions(titleSlug, codingLanguage, 5)
      setLcSolutions(solutions)
      setLcIndex(0)
      setState('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取社区题解失败，请确认已登录 LeetCode')
      setState('error')
    }
  }

  const handleAnalyze = () => {
    if (source === 'ai') handleAnalyzeAI()
    else handleFetchLeetCode()
  }

  const handleReset = () => {
    setState('idle')
    setResult(null)
    setLcSolutions([])
    setLcDetail({})
    setLcLang({})
  }

  const activeSolution = result
    ? tab === 'optimized' ? result.optimized : result.bruteForce
    : null

  const currentLcSolution = lcSolutions[lcIndex] ?? null

  // Collapsed: vertical tab pinned to right edge — drag to move up/down, click to expand
  if (collapsed) {
    const handleCollapsedMouseDown = (e: React.MouseEvent) => {
      const startY = e.clientY
      const startPosY = position.y
      let moved = false

      const onMove = (ev: MouseEvent) => {
        if (Math.abs(ev.clientY - startY) > 4) moved = true
        setPosition(p => ({
          ...p,
          y: Math.max(0, Math.min(window.innerHeight - 60, startPosY + (ev.clientY - startY))),
        }))
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        if (!moved) setCollapsed(false)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      e.preventDefault()
    }

    return (
      <div
        onMouseDown={handleCollapsedMouseDown}
        style={{ position: 'fixed', right: 0, top: position.y, zIndex: 9999, cursor: 'grab' }}
        title="拖动调整位置，点击展开"
      >
        <div
          className="bg-indigo-600 text-white px-1.5 py-4 rounded-l-lg text-xs font-bold shadow-lg hover:bg-indigo-700 transition-colors select-none"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          ▶ LeetHelper
        </div>
      </div>
    )
  }

  // Expanded: draggable + resizable panel
  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header / drag handle */}
      <div
        onMouseDown={handleDragStart}
        className="bg-indigo-600 text-white px-3 py-2 flex items-center justify-between rounded-t-lg shadow-lg"
        style={{ cursor: 'grab', minWidth: 240, userSelect: 'none' }}
      >
        <span className="font-bold text-sm">⚡ LeetHelper</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-indigo-200 truncate max-w-[120px]" title={title}>{title}</span>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setCollapsed(true)}
            className="text-indigo-200 hover:text-white text-sm leading-none px-1"
            title="收起"
          >
            ◀
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          position: 'relative',
          width: size.w,
          height: size.h,
          overflow: 'auto',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        }}
      >
        {/* Bottom-left resize handle */}
        <div
          onMouseDown={e => {
            e.preventDefault()
            isResizing.current = true
            resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h, px: position.x + size.w }
          }}
          style={{
            position: 'absolute', bottom: 0, left: 0,
            width: 14, height: 14, cursor: 'sw-resize', zIndex: 10,
            background: 'linear-gradient(135deg, transparent 50%, #d1d5db 50%)',
            transform: 'scaleX(-1)',
          }}
        />
        <div className="p-3">
          {state === 'idle' && (
            <div className="space-y-2">
              {/* Source toggle */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setSource('ai')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                    source === 'ai'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ✨ AI 解析
                </button>
                <button
                  onClick={() => setSource('leetcode')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                    source === 'leetcode'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🏆 社区题解
                </button>
              </div>

              {source === 'leetcode' && (
                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  获取 LeetCode 社区最高赞题解<br />
                  需要已登录 LeetCode
                </p>
              )}

              <button
                onClick={handleAnalyze}
                className={`w-full text-white py-2 rounded-lg text-sm font-semibold transition-colors ${
                  source === 'ai'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {source === 'ai' ? '分析题目' : '获取社区题解'}
              </button>
            </div>
          )}

          {state === 'loading' && (
            <div className="text-center py-6 text-gray-500">
              <div className="text-2xl mb-2 animate-spin inline-block">⟳</div>
              <p className="text-sm">
                {source === 'ai' ? '分析中，请稍候...' : '获取社区题解中...'}
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
              <button
                onClick={handleReset}
                className="w-full border border-gray-200 text-gray-600 py-1.5 rounded-lg text-sm hover:bg-gray-50"
              >
                重试
              </button>
            </div>
          )}

          {/* AI result */}
          {state === 'result' && source === 'ai' && result && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">题目解释</p>
                <p className="text-sm text-gray-700 leading-relaxed">{result.explanation}</p>
              </div>

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
                    <div className="flex gap-3 text-xs text-gray-500">
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

              <button
                onClick={handleReset}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
              >
                重新分析
              </button>
            </div>
          )}

          {/* LeetCode community solutions result */}
          {state === 'result' && source === 'leetcode' && lcSolutions.length > 0 && (
            <div className="space-y-3">
              {/* Solution navigator */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-orange-600">
                  🏆 社区题解 ({lcSolutions.length} 个)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLcIndex(i => Math.max(0, i - 1))}
                    disabled={lcIndex === 0}
                    className="text-xs px-1.5 py-0.5 border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50"
                  >
                    ‹
                  </button>
                  <span className="text-xs text-gray-500">{lcIndex + 1}/{lcSolutions.length}</span>
                  <button
                    onClick={() => setLcIndex(i => Math.min(lcSolutions.length - 1, i + 1))}
                    disabled={lcIndex === lcSolutions.length - 1}
                    className="text-xs px-1.5 py-0.5 border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50"
                  >
                    ›
                  </button>
                </div>
              </div>

              {currentLcSolution && (
                <>
                  {/* Solution meta */}
                  <div>
                    <p className="text-xs font-medium text-gray-700 leading-snug">{currentLcSolution.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span>@{currentLcSolution.author}</span>
                      <span>👍 {currentLcSolution.voteCount}</span>
                    </div>
                  </div>

                  {/* Code + Complexity */}
                  {(() => {
                    const detail = lcDetail[currentLcSolution.slug]
                    const fetching = !currentLcSolution.code && detail === undefined
                    if (fetching) return (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-400 text-center animate-pulse">
                        加载代码中...
                      </div>
                    )
                    const allCodes = detail?.allCodes ?? {}
                    const langs = Object.keys(allCodes)
                    const selectedLang = lcLang[currentLcSolution.slug] ?? langs[0] ?? ''
                    const code = currentLcSolution.code || (selectedLang ? allCodes[selectedLang] : detail?.code) || ''
                    return (
                      <div className="space-y-2">
                        {langs.length > 1 && (
                          <div className="flex flex-wrap gap-1">
                            {langs.map(lang => (
                              <button
                                key={lang}
                                onClick={() => setLcLang(prev => ({ ...prev, [currentLcSolution.slug]: lang }))}
                                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                  (lcLang[currentLcSolution.slug] ?? langs[0]) === lang
                                    ? 'bg-orange-100 border-orange-400 text-orange-700 font-medium'
                                    : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                                }`}
                              >
                                {lang}
                              </button>
                            ))}
                          </div>
                        )}
                        {code ? (
                          <pre className="bg-gray-900 text-gray-100 text-xs p-2 rounded-lg overflow-x-auto leading-relaxed">
                            {code}
                          </pre>
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500 text-center">
                            该题解未包含代码块，可能是图文格式
                          </div>
                        )}
                        {(detail?.timeComplexity || detail?.spaceComplexity) && (
                          <div className="flex gap-3 text-xs text-gray-500">
                            {detail.timeComplexity && <span>时间 <strong className="text-gray-700">{detail.timeComplexity}</strong></span>}
                            {detail.spaceComplexity && <span>空间 <strong className="text-gray-700">{detail.spaceComplexity}</strong></span>}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}

              <button
                onClick={handleReset}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
              >
                返回
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
