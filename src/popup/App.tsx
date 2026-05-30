import React, { useEffect, useState } from 'react'
import type { StorageData, ApiProvider, CodingLanguage, AnalysisLanguage } from '../shared/types'
import { getStorage, setStorage } from '../shared/storage'
import { getHistory, clearHistory } from '../shared/history'
import type { HistoryEntry } from '../shared/history'

type View = 'onboarding' | 'settings' | 'history'

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

function SettingsView({ onNeedOnboarding, onHistory }: { onNeedOnboarding: () => void; onHistory: () => void }) {
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
        <button onClick={onHistory} className="flex-1 text-xs text-gray-400 hover:text-gray-600 py-1">
          浏览历史 →
        </button>
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
  return <SettingsView onNeedOnboarding={() => setView('onboarding')} onHistory={() => setView('history')} />
}
