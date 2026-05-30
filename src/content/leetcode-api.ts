export interface LeetCodeSolution {
  id: string
  title: string
  author: string
  voteCount: number
  code: string
  rawContent: string
}

const SOLUTIONS_QUERY = `
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
          hitCount
          author {
            userSlug
            userName
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

// Sends a fetch request via the MAIN world script (main-world-fetcher.ts)
// using postMessage, so the browser sets Origin: https://leetcode.com.
function fetchViaMainWorld(body: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()

    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(new Error('请求超时'))
    }, 15000)

    function handler(event: MessageEvent) {
      if (!event.data || event.data.type !== 'LEET_FETCH_RESPONSE') return
      if (event.data.id !== id) return

      window.clearTimeout(timeout)
      window.removeEventListener('message', handler)

      if (event.data.ok) {
        resolve(event.data.data)
      } else {
        reject(new Error(
          event.data.error ?? `LeetCode API 请求失败 (${event.data.status})`
        ))
      }
    }

    window.addEventListener('message', handler)
    window.postMessage({
      type: 'LEET_FETCH_REQUEST',
      id,
      body: JSON.stringify(body),
    }, window.location.origin)
  })
}

export async function fetchTopSolutions(
  titleSlug: string,
  _codingLanguage: string,
  limit = 5,
): Promise<LeetCodeSolution[]> {
  const json = await fetchViaMainWorld({
    operationName: 'ugcArticleSolutionArticles',
    query: SOLUTIONS_QUERY,
    variables: {
      questionSlug: titleSlug,
      skip: 0,
      first: limit,
      orderBy: 'HOT',
      userInput: '',
      tagSlugs: [],
    },
  }) as {
    data?: {
      ugcArticleSolutionArticles?: {
        edges?: Array<{ node: Record<string, unknown> }>
      }
    }
    errors?: Array<{ message: string }>
  }

  if (json.errors?.length) {
    throw new Error(`LeetCode API 错误: ${json.errors[0].message}`)
  }

  const edges = json.data?.ugcArticleSolutionArticles?.edges ?? []

  if (edges.length === 0) {
    throw new Error('未找到社区题解，请确认已登录 LeetCode')
  }

  return edges.map(e => {
    const node = e.node ?? {}
    const content = String(node.summary ?? '')
    return {
      id: String(node.uuid ?? node.slug ?? ''),
      title: String(node.title ?? ''),
      author: String((node.author as Record<string, unknown>)?.userName ?? (node.author as Record<string, unknown>)?.userSlug ?? 'anonymous'),
      voteCount: Number(node.hitCount ?? 0),
      rawContent: content,
      code: extractCodeFromContent(content),
    }
  })
}
