import React, { useState, useRef, useEffect, useCallback, useMemo, Component } from 'react'
import hljs from 'highlight.js/lib/core'
import langPython from 'highlight.js/lib/languages/python'
import langJava from 'highlight.js/lib/languages/java'
import langJs from 'highlight.js/lib/languages/javascript'
import langTs from 'highlight.js/lib/languages/typescript'
import langCpp from 'highlight.js/lib/languages/cpp'
import langGo from 'highlight.js/lib/languages/go'
import langRust from 'highlight.js/lib/languages/rust'
import langCs from 'highlight.js/lib/languages/csharp'
import langKotlin from 'highlight.js/lib/languages/kotlin'
import langSwift from 'highlight.js/lib/languages/swift'

hljs.registerLanguage('python', langPython)
hljs.registerLanguage('java', langJava)
hljs.registerLanguage('javascript', langJs)
hljs.registerLanguage('typescript', langTs)
hljs.registerLanguage('cpp', langCpp)
hljs.registerLanguage('go', langGo)
hljs.registerLanguage('rust', langRust)
hljs.registerLanguage('csharp', langCs)
hljs.registerLanguage('kotlin', langKotlin)
hljs.registerLanguage('swift', langSwift)

const LANG_TO_HLJS: Record<string, string> = {
  Python: 'python', Java: 'java', JavaScript: 'javascript',
  TypeScript: 'typescript', 'C++': 'cpp', Go: 'go',
  Rust: 'rust', 'C#': 'csharp', Kotlin: 'kotlin', Swift: 'swift',
}
import type { AnalysisResult, ExtensionMessage, SolutionSource } from '../shared/types'
import { getStorage } from '../shared/storage'
import { fetchTopSolutions, fetchSolutionContent, getTitleSlug } from './leetcode-api'
import type { LeetCodeSolution } from './leetcode-api'
import { addHistory, getHistory, clearHistory } from '../shared/history'
import type { HistoryEntry } from '../shared/history'
import type { Difficulty } from './extractor'

type PanelState = 'idle' | 'loading' | 'result' | 'error'
type SolutionTab = 'optimized' | 'brute'
type PanelTab = 'ai' | 'leetcode' | 'stats' | 'history'

interface PanelProps {
  title: string
  description: string
  difficulty: Difficulty | null
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-2">
          <p className="font-semibold">面板出现异常</p>
          <p className="text-red-500">{(this.state.error as Error).message}</p>
          <button
            className="text-indigo-600 underline"
            onClick={() => this.setState({ error: null })}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />
}

function LoadingSkeleton({ source }: { source: SolutionSource }) {
  if (source === 'leetcode') {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

function CodeBlock({ code, lang, fontSize = 'xs' }: { code: string; lang?: string; fontSize?: 'xs' | 'sm' }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [code])

  const highlighted = useMemo(() => {
    const hljsLang = lang ? LANG_TO_HLJS[lang] : undefined
    try {
      if (hljsLang) return hljs.highlight(code, { language: hljsLang }).value
      return hljs.highlightAuto(code, Object.values(LANG_TO_HLJS)).value
    } catch {
      return null
    }
  }, [code, lang])

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={copy}
        style={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }}
        className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
          copied
            ? 'bg-green-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        {copied ? '✓' : 'copy'}
      </button>
      <pre className={`hljs bg-gray-900 text-${fontSize} p-4 rounded-lg overflow-x-auto leading-relaxed`} style={{ margin: 0 }}>
        {highlighted
          ? <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          : <code>{code}</code>
        }
      </pre>
    </div>
  )
}

const DIFF_STYLE: Record<Difficulty, string> = {
  Easy:   'bg-green-100 text-green-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Hard:   'bg-red-100 text-red-700',
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => undefined)
}

function PanelInner({ title, description, difficulty }: PanelProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [lcSolutions, setLcSolutions] = useState<LeetCodeSolution[]>([])
  const [lcIndex, setLcIndex] = useState(0)
  const [lcDetail, setLcDetail] = useState<Record<string, { code: string; allCodes: Record<string, string>; timeComplexity: string; spaceComplexity: string } | null>>({})
  const [lcLang, setLcLang] = useState<Record<string, string>>({}) // slug -> selected lang
  const [error, setError] = useState('')
  const [tab, setTab] = useState<SolutionTab>('optimized')
  const [source, setSource] = useState<SolutionSource>('ai')
  const [panelTab, setPanelTab] = useState<PanelTab>('ai')
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [codeSize, setCodeSize] = useState<'xs' | 'sm'>('xs')
  const bodyRef = useRef<HTMLDivElement>(null)

  // Parse problem number from title (e.g. "8. String to Integer (atoi)")
  const problemNumber = title.match(/^(\d+)\./)?.[1] ?? null
  const problemTitle = problemNumber ? title.replace(/^\d+\.\s*/, '') : title

  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('leet-helper-pos')
      if (saved) return JSON.parse(saved) as { x: number; y: number }
    } catch { /* ignore */ }
    return { x: window.innerWidth - 308, y: 80 }
  })
  const [size, setSize] = useState(() => {
    try {
      const saved = localStorage.getItem('leet-helper-size')
      if (saved) return JSON.parse(saved) as { w: number; h: number }
    } catch { /* ignore */ }
    return { w: 288, h: 480 }
  })
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const isResizing = useRef(false)
  const resizeStart = useRef({ x: 0, y: 0, w: 288, h: 480, px: 0 })

  useEffect(() => {
    getStorage().then(s => setHasKey(!!s.apiKey))
    // Refresh when storage changes (e.g. user adds key in popup)
    const onStorage = () => getStorage().then(s => setHasKey(!!s.apiKey))
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [])

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
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('leet-helper-pos', JSON.stringify(position)) } catch { /* ignore */ }
  }, [position])

  useEffect(() => {
    try { localStorage.setItem('leet-helper-size', JSON.stringify(size)) } catch { /* ignore */ }
  }, [size])

  // Scroll body to top when switching solutions
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [lcIndex, state])

  useEffect(() => {
    const sol = lcSolutions[lcIndex]
    if (!sol || !sol.slug) return
    if (sol.code || lcDetail[sol.slug] !== undefined) return // already have code or already fetched
    fetchSolutionContent(sol.slug)
      .then(detail => setLcDetail(prev => ({ ...prev, [sol.slug]: detail.code || detail.timeComplexity ? detail : null })))
      .catch(() => setLcDetail(prev => ({ ...prev, [sol.slug]: null })))
  }, [lcIndex, lcSolutions])

  // Keyboard navigation between LC solutions
  useEffect(() => {
    if (state !== 'result' || source !== 'leetcode') return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft')  setLcIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setLcIndex(i => Math.min(lcSolutions.length - 1, i + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, source, lcSolutions.length])

  // Load history when switching to stats or history tab
  useEffect(() => {
    if (panelTab === 'stats' || panelTab === 'history') {
      getHistory().then(setHistoryEntries)
    }
  }, [panelTab])

  function switchTab(tab: PanelTab) {
    setPanelTab(tab)
    if (tab === 'ai') {
      if (source !== 'ai') { setSource('ai'); handleReset() }
    } else if (tab === 'leetcode') {
      if (source !== 'leetcode') { setSource('leetcode'); handleReset() }
    }
  }

  const currentLcSolution = lcSolutions[lcIndex] ?? null

  const activeSolution = result
    ? tab === 'optimized' ? result.optimized : result.bruteForce
    : null

  const copyLcAsMarkdown = useCallback(() => {
    if (!currentLcSolution) return
    const detail = lcDetail[currentLcSolution.slug]
    const allCodes = detail?.allCodes ?? {}
    const langs = Object.keys(allCodes)
    const selectedLang = lcLang[currentLcSolution.slug] ?? langs[0] ?? ''
    const code = currentLcSolution.code || (selectedLang ? allCodes[selectedLang] : detail?.code) || ''
    const lines = [
      `## ${currentLcSolution.title}`,
      `*by @${currentLcSolution.author}*`,
      '',
      `\`\`\`${(selectedLang || 'text').toLowerCase()}`,
      code,
      '```',
    ]
    copyToClipboard(lines.join('\n'))
  }, [currentLcSolution, lcDetail, lcLang])

  const copyAIAsMarkdown = useCallback(() => {
    if (!result || !activeSolution) return
    const lines = [
      `# ${title}`,
      '',
      `**解题思路:** ${result.explanation}`,
      '',
      `**考点:** ${result.patterns.join(', ')}`,
      '',
      `## ${tab === 'optimized' ? '最优解' : '暴力解'}`,
      '',
      activeSolution.explanation,
      '',
      '```',
      activeSolution.code,
      '```',
      '',
      activeSolution.timeComplexity ? `**Time:** ${activeSolution.timeComplexity}` : '',
      activeSolution.spaceComplexity ? `**Space:** ${activeSolution.spaceComplexity}` : '',
    ].filter(l => l !== undefined)
    copyToClipboard(lines.join('\n'))
  }, [result, activeSolution, title, tab])

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
        addHistory({ slug: getTitleSlug() ?? title, title, source: 'ai' })
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
      addHistory({ slug: titleSlug, title, source: 'lc' })
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
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-bold text-sm">⚡ LeetHelper</span>
          {problemNumber && (
            <span className="text-[10px] bg-indigo-500 text-indigo-100 px-1.5 py-0.5 rounded font-medium">
              #{problemNumber}
            </span>
          )}
          {difficulty && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${DIFF_STYLE[difficulty]}`}>
              {difficulty}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
          <span className="text-xs text-indigo-200 truncate" title={problemTitle}>{problemTitle}</span>
          <div className="flex items-center gap-0.5 shrink-0" onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => setCodeSize('xs')}
              className={`text-[10px] px-1 py-0.5 rounded transition-colors ${codeSize === 'xs' ? 'bg-indigo-500 text-white' : 'text-indigo-300 hover:text-white'}`}
              title="小字体"
            >A</button>
            <button
              onClick={() => setCodeSize('sm')}
              className={`text-xs px-1 py-0.5 rounded transition-colors ${codeSize === 'sm' ? 'bg-indigo-500 text-white' : 'text-indigo-300 hover:text-white'}`}
              title="大字体"
            >A</button>
          </div>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setCollapsed(true)}
            className="text-indigo-200 hover:text-white text-sm leading-none px-1 shrink-0"
            title="收起 (Option+L)"
          >
            ◀
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        className="lh-body"
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
          {/* Always-visible 4-tab bar */}
          <div className="flex gap-0.5 p-1 bg-gray-100 rounded-lg mb-3">
            {([
              ['ai', '✨ AI', 'text-indigo-700'],
              ['leetcode', '🏆 社区', 'text-orange-600'],
              ['stats', '📊 统计', 'text-gray-700'],
              ['history', '🕐 历史', 'text-gray-700'],
            ] as [PanelTab, string, string][]).map(([t, label, activeColor]) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 text-[11px] py-1.5 rounded-md font-medium transition-colors ${
                  panelTab === t
                    ? `bg-white ${activeColor} shadow-sm`
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stats tab */}
          {panelTab === 'stats' && (() => {
            const now = Date.now()
            const todayStart = new Date().setHours(0, 0, 0, 0)
            const weekAgo = now - 7 * 24 * 60 * 60 * 1000
            const stats = {
              total: historyEntries.length,
              today: historyEntries.filter(e => e.timestamp >= todayStart).length,
              thisWeek: historyEntries.filter(e => e.timestamp >= weekAgo).length,
              ai: historyEntries.filter(e => e.source === 'ai').length,
              lc: historyEntries.filter(e => e.source === 'lc').length,
            }
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(now - (6 - i) * 86400000)
              const start = new Date(d).setHours(0, 0, 0, 0)
              const end = start + 86400000
              return {
                label: d.toLocaleDateString([], { weekday: 'short' }),
                count: historyEntries.filter(e => e.timestamp >= start && e.timestamp < end).length,
              }
            })
            const maxCount = Math.max(...days.map(d => d.count), 1)
            return (
              <div className="space-y-4 lh-fade">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '今日', value: stats.today, color: 'text-indigo-600' },
                    { label: '本周', value: stats.thisWeek, color: 'text-indigo-600' },
                    { label: '总计', value: stats.total, color: 'text-gray-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      <div className="text-[10px] text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1.5">来源分布</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-indigo-50 rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-indigo-600">{stats.ai}</div>
                      <div className="text-[10px] text-indigo-400">✨ AI 解析</div>
                    </div>
                    <div className="flex-1 bg-orange-50 rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-orange-600">{stats.lc}</div>
                      <div className="text-[10px] text-orange-400">🏆 社区题解</div>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">过去 7 天</p>
                  <div className="flex items-end gap-1 h-16">
                    {days.map(({ label, count }) => (
                      <div key={label} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-indigo-400 rounded-sm transition-all"
                          style={{ height: `${(count / maxCount) * 48}px`, minHeight: count > 0 ? 4 : 0 }}
                        />
                        <span className="text-[9px] text-gray-400">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* History tab */}
          {panelTab === 'history' && (
            <div className="lh-fade">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">浏览历史</span>
                <button
                  onClick={() => { clearHistory(); setHistoryEntries([]) }}
                  className="text-[10px] text-red-400 hover:text-red-600"
                >
                  清空
                </button>
              </div>
              {historyEntries.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-6">暂无记录</div>
              ) : (
                <ul className="divide-y divide-gray-50 -mx-3">
                  {historyEntries.map(e => (
                    <li
                      key={e.slug + e.timestamp}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      onClick={() => chrome.tabs.create({ url: `https://leetcode.com/problems/${e.slug}/` })}
                    >
                      <span className={`text-[9px] px-1 py-0.5 rounded font-bold shrink-0 ${e.source === 'ai' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                        {e.source === 'ai' ? 'AI' : 'LC'}
                      </span>
                      <span className="flex-1 text-xs text-gray-700 truncate">{e.title}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {(() => {
                          const diffH = (Date.now() - e.timestamp) / 3600000
                          return diffH < 24
                            ? new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
                        })()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* AI / LC tabs - main analysis content */}
          {(panelTab === 'ai' || panelTab === 'leetcode') && (
          <div>
          {state === 'idle' && (
            <div className="space-y-2">
              {source === 'leetcode' && (
                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  获取 LeetCode 社区最高赞题解<br />
                  需要已登录 LeetCode
                </p>
              )}

              {source === 'ai' && hasKey === false && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1.5">
                  <p className="font-semibold">⚠️ 未配置 API Key</p>
                  <p>请点击浏览器右上角的 ⚡ LeetHelper 图标，在设置中填写 Claude API Key 后即可使用。</p>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={source === 'ai' && hasKey === false}
                className={`w-full text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  source === 'ai'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {source === 'ai' ? '分析题目' : '获取社区题解'}
              </button>
            </div>
          )}

          {state === 'loading' && <LoadingSkeleton source={source} />}

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
            <div className="space-y-3 lh-fade">
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
                    <p className="text-xs text-gray-600 leading-relaxed">{activeSolution.explanation}</p>
                    <CodeBlock code={activeSolution.code} fontSize={codeSize} />
                    {(activeSolution.timeComplexity || activeSolution.spaceComplexity) && (
                      <div className="bg-gray-900 rounded-lg px-4 py-3 text-xs space-y-1">
                        <div className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-2">Complexity</div>
                        {activeSolution.timeComplexity && <div className="text-gray-300">Time: <span className="text-green-400 font-mono">{activeSolution.timeComplexity}</span></div>}
                        {activeSolution.spaceComplexity && <div className="text-gray-300">Space: <span className="text-green-400 font-mono">{activeSolution.spaceComplexity}</span></div>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 py-1">
                  重新分析
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyAIAsMarkdown}
                    className="text-xs text-indigo-400 hover:text-indigo-600 py-1"
                    title="复制为 Markdown"
                  >
                    📋 MD
                  </button>
                  <span className="text-[10px] text-gray-300 italic">AI 生成，仅供参考</span>
                </div>
              </div>
            </div>
          )}

          {/* LeetCode community solutions result */}
          {state === 'result' && source === 'leetcode' && lcSolutions.length > 0 && (
            <div className="space-y-3 lh-fade">
              {/* Solution navigator */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-orange-600">
                    🏆 社区题解 ({lcSolutions.length} 个)
                  </span>
                  <span className="text-[10px] text-gray-400 ml-1.5">按浏览量排序</span>
                </div>
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
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-gray-700 leading-snug flex-1">{currentLcSolution.title}</p>
                      <a
                        href={`https://leetcode.com/problems/${getTitleSlug()}/solutions/${currentLcSolution.slug}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-400 hover:text-indigo-600 shrink-0 mt-0.5"
                        title="在 LeetCode 查看原文"
                      >
                        原文 ↗
                      </a>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span>@{currentLcSolution.author}</span>
                      <span>👁 {currentLcSolution.voteCount >= 1000 ? `${(currentLcSolution.voteCount / 1000).toFixed(1)}K` : currentLcSolution.voteCount}</span>
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
                          <CodeBlock code={code} lang={selectedLang} fontSize={codeSize} />
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500 text-center space-y-1.5">
                            <p>暂无法提取代码块</p>
                            <a
                              href={`https://leetcode.com/problems/${getTitleSlug()}/solutions/${currentLcSolution.slug}/`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-500 hover:text-indigo-700 underline block"
                            >
                              在 LeetCode 查看原文 →
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}

              <div className="flex items-center justify-between">
                <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 py-1">
                  返回
                </button>
                <button
                  onClick={copyLcAsMarkdown}
                  className="text-xs text-orange-400 hover:text-orange-600 py-1"
                  title="复制为 Markdown"
                >
                  📋 MD
                </button>
              </div>
            </div>
          )}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Panel(props: PanelProps) {
  return (
    <ErrorBoundary>
      <PanelInner {...props} />
    </ErrorBoundary>
  )
}
