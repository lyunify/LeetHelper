import React, { useEffect, useState } from 'react'
import type { StorageData, ApiProvider, CodingLanguage, AnalysisLanguage } from '../shared/types'
import { getStorage, setStorage } from '../shared/storage'

export default function App() {
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
      <h1 className="text-base font-bold text-indigo-600 mb-4">⚡ LeetHelper</h1>

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

      {/* Status */}
      <div
        className={`text-center text-xs py-2 rounded transition-colors ${
          savedFlash
            ? 'bg-green-50 text-green-600'
            : hasKey
            ? 'bg-green-50 text-green-600'
            : 'bg-red-50 text-red-500'
        }`}
      >
        {savedFlash ? '已保存 ✓' : hasKey ? '● 已连接，可以开始分析' : '● 请填写 API Key'}
      </div>
    </div>
  )
}
