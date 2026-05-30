import React, { useEffect, useState } from 'react'
import type { StorageData, ApiProvider, CodingLanguage, AnalysisLanguage } from '../shared/types'
import { getStorage, setStorage } from '../shared/storage'
import { getHistory, clearHistory, calcStreak } from '../shared/history'
import type { HistoryEntry } from '../shared/history'

type View = 'onboarding' | 'settings' | 'history' | 'stats'

function OnboardingView({ onDone }: { onDone: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!apiKey.trim()) return
    setSaving(true)
    await setStorage({ apiKey: apiKey.trim(), apiProvider: 'claude' })
    setSaving(false)
    onDone()
  }

  return (
    <div className="w-72 p-5 font-sans bg-white">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">⚡</span>
        <h1 className="text-base font-bold text-indigo-600">LeetHelper</h1>
      </div>
      <p className="text-xs text-gray-500 mb-4">AI-powered LeetCode companion</p>

      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4">
        <p className="text-xs font-semibold text-indigo-700 mb-1">快速开始</p>
        <ol className="text-xs text-indigo-600 space-y-1 list-decimal list-inside">
          <li>获取 Claude API Key（Anthropic Console）</li>
          <li>粘贴到下方输入框</li>
          <li>打开任意 LeetCode 题目即可使用</li>
        </ol>
      </div>

      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Claude API Key</p>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="sk-ant-..."
          autoFocus
          className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          前往{' '}
          <span className="text-indigo-500 cursor-pointer" onClick={() => chrome.tabs.create({ url: 'https://console.anthropic.com/settings/keys' })}>
            console.anthropic.com
          </span>{' '}
          获取 Key
        </p>
      </div>

      <button
        onClick={save}
        disabled={!apiKey.trim() || saving}
        className="w-full py-2 rounded text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {saving ? '保存中...' : '开始使用 →'}
      </button>
    </div>
  )
}

function SettingsView({ onNeedOnboarding, onHistory, onStats }: { onNeedOnboarding: () => void; onHistory: () => void; onStats: () => void }) {
  const [settings, setSettings] = useState<StorageData>({
    apiProvider: 'claude',
    apiKey: '',
    analysisLanguage: 'zh',
    codingLanguage: 'java',
  })
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => { getStorage().then(setSettings) }, [])

  async function update<K extends keyof StorageData>(key: K, value: StorageData[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    await setStorage({ [key]: value })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1200)
  }

  const hasKey = settings.apiKey.length > 0
  const placeholder = settings.apiProvider === 'claude' ? 'sk-ant-...' : 'sk-...'

  return (
    <div className="w-72 p-4 font-sans bg-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h1 className="text-base font-bold text-indigo-600">⚡ LeetHelper</h1>
          <span className="text-[10px] text-gray-400">v0.1.0</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${hasKey ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
          {hasKey ? '● 已连接' : '● 未配置'}
        </span>
      </div>

      {/* API Provider */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">AI 提供商</p>
        <div className="flex gap-2">
          {(['claude', 'openai'] as ApiProvider[]).map(p => (
            <button
              key={p}
              onClick={() => update('apiProvider', p)}
              className={`flex-1 py-1.5 rounded text-sm font-medium border transition-colors ${
                settings.apiProvider === p
                  ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                  : 'border-gray-200 text-gray-400 hover:bg-gray-50'
              }`}
            >
              {p === 'claude' ? 'Claude' : 'OpenAI'}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">API Key</p>
        <input
          type="password"
          value={settings.apiKey}
          onChange={e => update('apiKey', e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
        />
      </div>

      {/* Analysis Language */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">分析语言</p>
        <div className="flex gap-2">
          {(['zh', 'en'] as AnalysisLanguage[]).map(l => (
            <button
              key={l}
              onClick={() => update('analysisLanguage', l)}
              className={`flex-1 py-1.5 rounded text-sm font-medium border transition-colors ${
                settings.analysisLanguage === l
                  ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                  : 'border-gray-200 text-gray-400 hover:bg-gray-50'
              }`}
            >
              {l === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
      </div>

      {/* Coding Language */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">编程语言</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['java', 'Java'],
            ['python', 'Python'],
            ['cpp', 'C++'],
            ['javascript', 'JavaScript'],
          ] as [CodingLanguage, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => update('codingLanguage', val)}
              className={`py-1.5 rounded text-sm font-medium border transition-colors ${
                settings.codingLanguage === val
                  ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                  : 'border-gray-200 text-gray-400 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`text-center text-xs py-2 rounded transition-colors ${savedFlash ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
        {savedFlash ? '已保存 ✓' : '修改后自动保存'}
      </div>

      <div className="flex gap-2 mt-2">
        {!hasKey && (
          <button onClick={onNeedOnboarding} className="flex-1 text-xs text-indigo-500 hover:text-indigo-700 py-1">
            配置引导 →
          </button>
        )}
        <button onClick={onStats} className="flex-1 text-xs text-gray-400 hover:text-gray-600 py-1">
          统计 →
        </button>
        <button onClick={onHistory} className="flex-1 text-xs text-gray-400 hover:text-gray-600 py-1">
          历史 →
        </button>
      </div>
    </div>
  )
}

function StatsView({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => { getHistory().then(setEntries) }, [])

  const now = Date.now()
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000

  const stats = {
    total: entries.length,
    today: entries.filter(e => e.timestamp >= todayStart).length,
    thisWeek: entries.filter(e => e.timestamp >= weekAgo).length,
    ai: entries.filter(e => e.source === 'ai').length,
    lc: entries.filter(e => e.source === 'lc').length,
  }
  const streak = calcStreak(entries)

  // Heatmap: last 84 days (12 weeks)
  const heatDays = Array.from({ length: 84 }, (_, i) => {
    const start = new Date(now - (83 - i) * 86400000).setHours(0, 0, 0, 0)
    return { start, count: entries.filter(e => e.timestamp >= start && e.timestamp < start + 86400000).length }
  })
  const heatMax = Math.max(...heatDays.map(d => d.count), 1)
  const heatColor = (c: number) => {
    if (c === 0) return '#e5e7eb'
    const t = Math.min(c / heatMax, 1)
    if (t < 0.25) return '#c7d2fe'
    if (t < 0.5) return '#818cf8'
    if (t < 0.75) return '#6366f1'
    return '#4338ca'
  }

  return (
    <div className="w-72 font-sans bg-white">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">← 返回</button>
        <h2 className="text-sm font-semibold text-gray-700">刷题统计</h2>
        <div className="w-8" />
      </div>

      <div className="p-4 space-y-4">
        {/* Summary cards with streak */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: '今日', value: stats.today, color: 'text-indigo-600' },
            { label: '本周', value: stats.thisWeek, color: 'text-indigo-600' },
            { label: '总计', value: stats.total, color: 'text-gray-700' },
            { label: '连续', value: streak, color: 'text-orange-500', suffix: '🔥' },
          ].map(({ label, value, color, suffix }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
              <div className={`text-lg font-bold ${color}`}>{suffix ?? ''}{value}</div>
              <div className="text-[10px] text-gray-400">{label}</div>
            </div>
          ))}
        </div>

        {/* AI vs LC breakdown */}
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

        {/* Heatmap */}
        <div>
          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">过去 12 周</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
            {Array.from({ length: 12 }, (_, week) => (
              <div key={week} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {heatDays.slice(week * 7, week * 7 + 7).map((d, di) => (
                  <div
                    key={di}
                    title={`${new Date(d.start).toLocaleDateString()}: ${d.count} 题`}
                    style={{ width: '100%', aspectRatio: '1', borderRadius: 2, background: heatColor(d.count) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryView({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => { getHistory().then(setEntries) }, [])

  function formatTime(ts: number) {
    const d = new Date(ts)
    const now = new Date()
    const diffH = (now.getTime() - ts) / 3600000
    if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  async function handleClear() {
    await clearHistory()
    setEntries([])
  }

  return (
    <div className="w-72 font-sans bg-white">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">← 返回</button>
        <h2 className="text-sm font-semibold text-gray-700">浏览历史</h2>
        <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-600">清空</button>
      </div>
      {entries.length === 0 ? (
        <div className="p-6 text-center text-xs text-gray-400">暂无记录</div>
      ) : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
          {entries.map(e => (
            <li
              key={e.slug + e.timestamp}
              className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
              onClick={() => chrome.tabs.create({ url: `https://leetcode.com/problems/${e.slug}/` })}
            >
              <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${e.source === 'ai' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                {e.source === 'ai' ? 'AI' : 'LC'}
              </span>
              <span className="flex-1 text-xs text-gray-700 truncate">{e.title}</span>
              <span className="text-[10px] text-gray-400 shrink-0">{formatTime(e.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    getStorage().then(s => setView(s.apiKey ? 'settings' : 'onboarding'))
  }, [])

  if (!view) return <div className="w-72 h-32 bg-white" />
  if (view === 'onboarding') return <OnboardingView onDone={() => setView('settings')} />
  if (view === 'history') return <HistoryView onBack={() => setView('settings')} />
  if (view === 'stats') return <StatsView onBack={() => setView('settings')} />
  return <SettingsView onNeedOnboarding={() => setView('onboarding')} onHistory={() => setView('history')} onStats={() => setView('stats')} />
}
