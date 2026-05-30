import Anthropic from '@anthropic-ai/sdk'
import type { AnalysisRequest, AnalysisResult, ExtensionMessage } from '../shared/types'
import { getStorage } from '../shared/storage'

const SYSTEM_PROMPT = `You are a LeetCode assistant for Chinese-speaking developers.
Analyze the LeetCode problem and return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "explanation": "简洁的中文题目解释，去掉废话，保留关键约束和边界条件",
  "patterns": ["算法模式，如: 滑动窗口", "双指针"],
  "bruteForce": {
    "code": "// complete working solution code",
    "timeComplexity": "O(?)",
    "spaceComplexity": "O(?)",
    "explanation": "暴力解思路"
  },
  "optimized": {
    "code": "// complete working optimized solution code",
    "timeComplexity": "O(?)",
    "spaceComplexity": "O(?)",
    "explanation": "优化思路和关键洞察"
  }
}`

const LANG_LABELS: Record<string, string> = {
  java: 'Java', python: 'Python', cpp: 'C++', javascript: 'JavaScript',
}

function buildUserPrompt(request: AnalysisRequest): string {
  return `Problem Title: ${request.title}

Problem Description:
${request.description}

Requirements:
- Generate solutions in ${LANG_LABELS[request.codingLanguage] ?? request.codingLanguage}
- Explanation language: ${request.analysisLanguage === 'zh' ? 'Chinese (中文)' : 'English'}
- Include complete, runnable code for both brute force and optimized solutions`
}

function parseResult(text: string): AnalysisResult {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }
  return JSON.parse(cleaned) as AnalysisResult
}

async function analyzeWithClaude(request: AnalysisRequest, apiKey: string): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(request) }],
  })
  if (!response.content.length) throw new Error('Claude 返回了空响应，请重试')
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  try { return parseResult(block.text) } catch { throw new Error('解析 AI 响应失败，请重试') }
}

async function analyzeWithOpenAI(request: AnalysisRequest, apiKey: string): Promise<AnalysisResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(request) },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `OpenAI 请求失败 (${res.status})`)
  }
  const data = await res.json() as { choices: { message: { content: string } }[] }
  const text = data.choices[0]?.message?.content
  if (!text) throw new Error('OpenAI 返回了空响应')
  try { return parseResult(text) } catch { throw new Error('解析 AI 响应失败，请重试') }
}

async function analyzeProblem(request: AnalysisRequest): Promise<AnalysisResult> {
  const { apiKey, apiProvider } = await getStorage()
  if (!apiKey) throw new Error('未设置 API Key，请点击扩展图标进行设置')
  return apiProvider === 'openai'
    ? analyzeWithOpenAI(request, apiKey)
    : analyzeWithClaude(request, apiKey)
}

async function updateBadge() {
  const result = await chrome.storage.local.get('leet_history')
  const history = (result['leet_history'] ?? []) as Array<{ timestamp: number }>
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const count = history.filter(e => e.timestamp >= todayStart).length
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
  chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' })
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'ANALYZE_PROBLEM') {
      analyzeProblem(message.payload)
        .then(result => sendResponse({ type: 'ANALYSIS_RESULT', payload: result }))
        .catch(err =>
          sendResponse({ type: 'ANALYSIS_ERROR', payload: { message: err.message } })
        )
      return true // keeps the message channel open for the async response
    }
  }
)

// Update badge whenever storage changes (history updated)
chrome.storage.onChanged.addListener((changes) => {
  if ('leet_history' in changes) updateBadge()
})

// Initialize badge on startup
updateBadge()
