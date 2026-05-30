export interface LeetCodeSolution {
  id: string
  slug: string
  title: string
  author: string
  voteCount: number
  code: string
  rawContent: string
  timeComplexity: string
  spaceComplexity: string
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

function stripLangPrefix(code: string): string {
  // Strip language prefix lines like "cpp []", "++ []", "python3 []" at the start
  return code.replace(/^[^\n]{0,40}\[\]\s*\n/, '').trim()
}

const CODE_KEYWORDS = /\b(class|def|function|return|for|while|if|else|int|void|public|private|var|let|const|import|print|cout|endl|vector|map|set|unordered_map|HashMap|ArrayList|List|Dict|tuple)\b/

function looksLikeCode(text: string): boolean {
  if (text.length < 40) return false
  // Must have at least 2 lines
  if (!text.includes('\n')) return false
  // Skip test-case / example blocks
  if (/^(Input|Output|Explanation|Example|Constraints)/.test(text)) return false
  // Must contain at least one programming keyword
  if (!CODE_KEYWORDS.test(text)) return false
  return true
}

const LANG_MAP: Record<string, string> = {
  python: 'Python', python3: 'Python', py: 'Python',
  java: 'Java',
  javascript: 'JavaScript', js: 'JavaScript',
  typescript: 'TypeScript', ts: 'TypeScript',
  cpp: 'C++', 'c++': 'C++', c: 'C++',
  go: 'Go', golang: 'Go',
  rust: 'Rust',
  csharp: 'C#', cs: 'C#',
  kotlin: 'Kotlin',
  swift: 'Swift',
}

function detectLang(hint: string): string {
  const key = hint.toLowerCase().trim().replace(/[^a-z0-9+#]/g, '')
  return LANG_MAP[key] ?? ''
}

// Returns map of lang → code. Keeps longest per language.
export function extractAllCodes(normalized: string): Record<string, string> {
  const result: Record<string, string> = {}

  function add(lang: string, code: string) {
    if (!looksLikeCode(code)) return
    const key = lang || 'Other'
    if (!result[key] || code.length > result[key].length) result[key] = code
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(normalized, 'text/html')

  for (const el of doc.querySelectorAll('pre code')) {
    const cls = el.className + ' ' + (el.parentElement?.className ?? '')
    const langMatch = cls.match(/language-(\w+)/)
    add(detectLang(langMatch?.[1] ?? ''), stripLangPrefix(el.textContent?.trim() ?? ''))
  }
  for (const el of doc.querySelectorAll('pre')) {
    const cls = el.className
    const langMatch = cls.match(/language-(\w+)/)
    add(detectLang(langMatch?.[1] ?? ''), stripLangPrefix(el.textContent?.trim() ?? ''))
  }

  const fenceRegex = /```([^\n`]*)\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = fenceRegex.exec(normalized)) !== null) {
    add(detectLang(m[1].trim().split(/\s/)[0]), stripLangPrefix(m[2].trim()))
  }

  return result
}

function extractComplexity(normalized: string): { time: string; space: string } {
  const timeMatch = normalized.match(/[Tt]ime\s+[Cc]omplexity\s*:?\s*\*?\*?(O\([^)\n]+\))/i)
    ?? normalized.match(/[Tt]ime\s+[Cc]omplexity[^O\n]*?(O\([^)\n]+\))/i)
  const spaceMatch = normalized.match(/[Ss]pace\s+[Cc]omplexity\s*:?\s*\*?\*?(O\([^)\n]+\))/i)
    ?? normalized.match(/[Ss]pace\s+[Cc]omplexity[^O\n]*?(O\([^)\n]+\))/i)
  return {
    time: timeMatch?.[1] ?? '',
    space: spaceMatch?.[1] ?? '',
  }
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

const SOLUTION_DETAIL_QUERY = `
  query ugcArticleSolutionArticle($slug: String!) {
    ugcArticleSolutionArticle(slug: $slug) {
      content
    }
  }
`

export async function fetchSolutionContent(slug: string): Promise<{ code: string; allCodes: Record<string, string>; timeComplexity: string; spaceComplexity: string }> {
  const json = await fetchViaMainWorld({
    operationName: 'ugcArticleSolutionArticle',
    query: SOLUTION_DETAIL_QUERY,
    variables: { slug },
  }) as {
    data?: { ugcArticleSolutionArticle?: { content?: string } }
    errors?: Array<{ message: string }>
  }

  if (json.errors?.length) {
    throw new Error(`LeetCode API 错误: ${json.errors[0].message}`)
  }

  const raw = json.data?.ugcArticleSolutionArticle?.content ?? ''
  const normalized = raw.replace(/\\n/g, '\n')
  const allCodes = extractAllCodes(normalized)
  const langs = Object.keys(allCodes)
  // Pick best single code: longest block
  const code = langs.length ? langs.reduce((a, b) => allCodes[b].length > allCodes[a].length ? b : a, langs[0]) : ''
  return {
    code: code ? allCodes[code] : '',
    allCodes,
    ...extractComplexity(normalized),
  }
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
      slug: String(node.slug ?? ''),
      title: String(node.title ?? ''),
      author: String((node.author as Record<string, unknown>)?.userName ?? (node.author as Record<string, unknown>)?.userSlug ?? 'anonymous'),
      voteCount: Number(node.hitCount ?? 0),
      rawContent: content,
      code: extractCodeFromContent(content),
      timeComplexity: '',
      spaceComplexity: '',
    }
  })
}
