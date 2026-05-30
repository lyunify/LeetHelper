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

// This function runs inside the page's main world (not the extension context).
// Must be self-contained — no closure references allowed.
async function _fetchSolutionsInPageContext(args: {
  titleSlug: string
  limit: number
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const QUERY = `
    query ugcArticleSolutionArticles(
      $questionSlug: String!,
      $orderBy: ArticleOrderByEnum,
      $userInput: String,
      $tagSlugs: [String!],
      $skip: Int,
      $first: Int
    ) {
      ugcArticleSolutionArticles(
        questionSlug: $questionSlug
        orderBy: $orderBy
        userInput: $userInput
        tagSlugs: $tagSlugs
        skip: $skip
        first: $first
      ) {
        totalNum
        edges {
          node {
            uuid
            title
            slug
            summary
            content
            upvoteCount
            author {
              username
            }
          }
        }
      }
    }
  `

  const csrfToken = document.cookie
    .split('; ')
    .find((row: string) => row.startsWith('csrftoken='))
    ?.split('=')[1] ?? ''

  try {
    const response = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrftoken': csrfToken,
        'X-Operation-Name': 'ugcArticleSolutionArticles',
        'Referer': window.location.href,
      },
      credentials: 'include',
      body: JSON.stringify({
        operationName: 'ugcArticleSolutionArticles',
        query: QUERY,
        variables: {
          questionSlug: args.titleSlug,
          skip: 0,
          first: args.limit,
          orderBy: 'HOT',
          userInput: '',
          tagSlugs: [],
        },
      }),
    })

    if (!response.ok) {
      return { ok: false, error: `LeetCode API 请求失败 (${response.status})` }
    }

    const data = await response.json()
    return { ok: true, data }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : '请求失败' }
  }
}

function extractCodeFromContent(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const codeEls = doc.querySelectorAll('pre code')
  for (const el of codeEls) {
    const code = el.textContent?.trim() ?? ''
    if (code.length > 20) return code
  }
  const preEls = doc.querySelectorAll('pre')
  for (const el of preEls) {
    const code = el.textContent?.trim() ?? ''
    if (code.length > 20) return code
  }
  const fenceMatch = html.match(/```[\w]*\n?([\s\S]*?)```/)
  if (fenceMatch?.[1]?.trim()) return fenceMatch[1].trim()
  return ''
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    if (message.type === 'ANALYZE_PROBLEM') {
      analyzeProblem(message.payload)
        .then(result => sendResponse({ type: 'ANALYSIS_RESULT', payload: result }))
        .catch(err =>
          sendResponse({ type: 'ANALYSIS_ERROR', payload: { message: err.message } })
        )
      return true
    }

    if (message.type === 'FETCH_LEETCODE_SOLUTIONS') {
      const tabId = sender.tab?.id
      if (!tabId) {
        sendResponse({ type: 'ANALYSIS_ERROR', payload: { message: '无法识别当前标签页' } })
        return true
      }

      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: _fetchSolutionsInPageContext,
        args: [message.payload],
      }).then(results => {
        const result = results[0]?.result as { ok: boolean; data?: unknown; error?: string } | undefined
        if (!result?.ok || !result.data) {
          sendResponse({ type: 'ANALYSIS_ERROR', payload: { message: result?.error ?? '获取失败' } })
          return
        }

        const json = result.data as { data?: { ugcArticleSolutionArticles?: { edges?: Array<{ node: Record<string, unknown> }> } }; errors?: Array<{ message: string }> }
        if (json.errors?.length) {
          sendResponse({ type: 'ANALYSIS_ERROR', payload: { message: json.errors[0].message } })
          return
        }

        const edges = json.data?.ugcArticleSolutionArticles?.edges ?? []
        if (edges.length === 0) {
          sendResponse({ type: 'ANALYSIS_ERROR', payload: { message: '未找到社区题解，请确认已登录 LeetCode' } })
          return
        }

        const solutions = edges.map(e => {
          const node = e.node ?? {}
          const content = String(node.content ?? node.summary ?? '')
          return {
            id: String(node.uuid ?? node.slug ?? ''),
            title: String(node.title ?? ''),
            author: String((node.author as Record<string, unknown>)?.username ?? 'anonymous'),
            voteCount: Number(node.upvoteCount ?? 0),
            rawContent: content,
            code: extractCodeFromContent(content),
          }
        })

        sendResponse({ type: 'LEETCODE_SOLUTIONS_RESULT', payload: solutions })
      }).catch(err => {
        sendResponse({ type: 'ANALYSIS_ERROR', payload: { message: err.message } })
      })

      return true // keep channel open for async response
    }
  }
)
