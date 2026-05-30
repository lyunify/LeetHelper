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
          content
          upvoteCount
          createdAt
          author {
            username
            profile {
              userAvatar
              reputation
            }
          }
          tags {
            name
            slug
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
  _codingLanguage: string,
  limit = 5,
): Promise<LeetCodeSolution[]> {
  // LeetCode requires the CSRF token as a header for POST requests
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1] ?? ''

  const response = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrftoken': csrfToken,
      'Referer': 'https://leetcode.com',
    },
    credentials: 'include',
    body: JSON.stringify({
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
    }),
  })

  if (!response.ok) {
    throw new Error(`LeetCode API 请求失败 (${response.status})`)
  }

  const json = await response.json()

  if (json.errors?.length) {
    throw new Error(`LeetCode API 错误: ${json.errors[0].message}`)
  }

  const edges: any[] = json?.data?.ugcArticleSolutionArticles?.edges ?? []

  if (edges.length === 0) {
    throw new Error('未找到社区题解，请确认已登录 LeetCode')
  }

  return edges.map((e: any) => {
    const node = e.node ?? {}
    return {
      id: node.uuid ?? node.slug ?? '',
      title: node.title ?? '',
      author: node.author?.username ?? 'anonymous',
      voteCount: node.upvoteCount ?? 0,
      rawContent: node.content ?? node.summary ?? '',
      code: extractCodeFromContent(node.content ?? node.summary ?? ''),
    }
  })
}
