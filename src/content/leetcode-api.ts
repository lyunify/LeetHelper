export interface LeetCodeSolution {
  id: string
  title: string
  author: string
  voteCount: number
  code: string
  rawContent: string
}

const LANG_TAG_MAP: Record<string, string> = {
  java: 'java',
  python: 'python3',
  cpp: 'cpp',
  javascript: 'javascript',
}

const SOLUTIONS_QUERY = `
  query questionSolutions($questionSlug: String!, $skip: Int!, $first: Int!, $languageTags: [String!]!) {
    questionSolutions(
      filters: { questionSlug: $questionSlug, languageTags: $languageTags, orderBy: HOT }
      skip: $skip
      first: $first
    ) {
      totalNum
      solutions {
        id
        title
        post {
          voteCount
          content
          author {
            username
          }
        }
      }
    }
  }
`

export function getTitleSlug(): string | null {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/)
  return match?.[1] ?? null
}

function extractCodeFromContent(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // LeetCode solution posts use <pre><code> blocks
  const codeEls = doc.querySelectorAll('pre code')
  for (const el of codeEls) {
    const code = el.textContent?.trim() ?? ''
    if (code.length > 20) return code
  }

  // Fallback: plain <pre> tags
  const preEls = doc.querySelectorAll('pre')
  for (const el of preEls) {
    const code = el.textContent?.trim() ?? ''
    if (code.length > 20) return code
  }

  // Fallback: markdown-style code fences in raw HTML text
  const fenceMatch = html.match(/```[\w]*\n?([\s\S]*?)```/)
  if (fenceMatch?.[1]?.trim()) return fenceMatch[1].trim()

  return ''
}

export async function fetchTopSolutions(
  titleSlug: string,
  codingLanguage: string,
  limit = 5,
): Promise<LeetCodeSolution[]> {
  const langTag = LANG_TAG_MAP[codingLanguage] ?? 'java'

  const response = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      query: SOLUTIONS_QUERY,
      variables: { questionSlug: titleSlug, skip: 0, first: limit, languageTags: [langTag] },
    }),
  })

  if (!response.ok) {
    throw new Error(`LeetCode API 请求失败 (${response.status})`)
  }

  const json = await response.json()

  if (json.errors?.length) {
    throw new Error(`LeetCode API 错误: ${json.errors[0].message}`)
  }

  const rawSolutions = json?.data?.questionSolutions?.solutions ?? []

  if (rawSolutions.length === 0) {
    throw new Error('未找到该语言的社区题解，请尝试切换语言')
  }

  return rawSolutions.map((s: any) => ({
    id: String(s.id),
    title: s.title ?? '',
    author: s.post?.author?.username ?? 'anonymous',
    voteCount: s.post?.voteCount ?? 0,
    rawContent: s.post?.content ?? '',
    code: extractCodeFromContent(s.post?.content ?? ''),
  }))
}
