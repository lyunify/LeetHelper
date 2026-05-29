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

async function analyzeProblem(request: AnalysisRequest): Promise<AnalysisResult> {
  const { apiKey, codingLanguage, analysisLanguage } = await getStorage()

  if (!apiKey) throw new Error('未设置 API Key，请点击扩展图标进行设置')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const languageMap: Record<string, string> = {
    java: 'Java',
    python: 'Python',
    cpp: 'C++',
    javascript: 'JavaScript',
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Problem Title: ${request.title}

Problem Description:
${request.description}

Requirements:
- Generate solutions in ${languageMap[codingLanguage] ?? codingLanguage}
- Explanation language: ${analysisLanguage === 'zh' ? 'Chinese (中文)' : 'English'}
- Include complete, runnable code for both brute force and optimized solutions`,
      },
    ],
  })

  if (!response.content.length) throw new Error('Claude 返回了空响应，请重试')
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')

  let text = block.text.trim()
  // Strip markdown code fences if Claude adds them despite instructions
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }

  try {
    return JSON.parse(text) as AnalysisResult
  } catch {
    throw new Error('解析 AI 响应失败，请重试')
  }
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
