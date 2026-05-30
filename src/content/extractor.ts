export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface ProblemData {
  title: string
  description: string
  difficulty: Difficulty | null
}

export function extractProblemData(): ProblemData | null {
  // --- Title ---
  // Try to find "N. Title" in DOM elements first (most reliable source)
  const titleWithNumber = extractTitleWithNumber()

  const titleFromPage =
    document.querySelector('[data-cy="question-title"]')?.textContent?.trim() ??
    document.querySelector('[data-testid="question-title"]')?.textContent?.trim() ??
    document.querySelector('h1')?.textContent?.trim()

  // document.title is sometimes "2. Add Two Numbers - LeetCode", sometimes without number
  const titleFromDocTitle = document.title.replace(/\s*[-–|].*$/, '').trim()
  const docTitleHasNumber = /^\d+\./.test(titleFromDocTitle)

  const title = titleWithNumber ?? (docTitleHasNumber ? titleFromDocTitle : null) ?? titleFromPage ?? titleFromDocTitle
  if (!title || title === 'LeetCode') return null

  // --- Description ---
  const descEl =
    document.querySelector('[data-track-load="description_content"]') ??
    document.querySelector('.question-content__JfgR') ??
    document.querySelector('[class*="question-content"]') ??
    document.querySelector('.content__u3I1') ??
    document.querySelector('div.elfjS') ??
    document.querySelector('div.xFUwe') ??
    (() => {
      const allDivs = document.querySelectorAll('div')
      for (const div of allDivs) {
        const text = div.textContent ?? ''
        if (
          text.includes('Example 1') &&
          text.includes('Input') &&
          text.includes('Output') &&
          text.length > 100 &&
          text.length < 10000 &&
          div.children.length > 0
        ) {
          return div
        }
      }
      return null
    })()

  if (!descEl) return null

  const description = descEl.textContent?.trim() ?? ''
  if (!description || description.length < 20) return null

  // --- Difficulty ---
  const difficulty = extractDifficulty()

  return { title, description, difficulty }
}

// Scan DOM for an element whose text looks like "N. Problem Title"
function extractTitleWithNumber(): string | null {
  const candidates = document.querySelectorAll('a, span, h1, h2, div')
  for (const el of candidates) {
    // Skip elements with many children (they're containers, not leaf text)
    if ((el as HTMLElement).children.length > 2) continue
    const text = el.textContent?.trim() ?? ''
    if (/^\d+\.\s+\w/.test(text) && text.length < 120) return text
  }
  return null
}

function extractDifficulty(): Difficulty | null {
  // Try class-based selectors first (LeetCode uses color classes for difficulty)
  const classSelectors = [
    '[class*="text-difficulty-easy"]',
    '[class*="text-difficulty-medium"]',
    '[class*="text-difficulty-hard"]',
    '[class*="difficulty"]',
  ]
  for (const sel of classSelectors) {
    const text = document.querySelector(sel)?.textContent?.trim()
    if (text === 'Easy' || text === 'Medium' || text === 'Hard') return text
  }

  // Fallback: scan leaf elements for exact difficulty text
  for (const el of document.querySelectorAll('span, div, p')) {
    if ((el as HTMLElement).children.length > 0) continue
    const text = el.textContent?.trim()
    if (text === 'Easy' || text === 'Medium' || text === 'Hard') return text
  }

  return null
}

export function extractTopicTags(): string[] {
  // LeetCode renders topic tags as links to /tag/ pages
  const tagLinks = document.querySelectorAll('a[href*="/tag/"]')
  if (tagLinks.length > 0) {
    const tags = Array.from(tagLinks)
      .map(el => el.textContent?.trim() ?? '')
      .filter(t => t.length > 0 && t.length < 50)
    if (tags.length > 0) return [...new Set(tags)]
  }

  // Fallback: class-based selectors LeetCode has used across UI versions
  for (const sel of ['[class*="topic-tag"]', '[class*="topicTag"]', '[data-topic-slug]']) {
    const els = document.querySelectorAll(sel)
    if (els.length > 0) {
      const tags = Array.from(els)
        .map(el => el.textContent?.trim() ?? '')
        .filter(t => t.length > 0 && t.length < 50)
      if (tags.length > 0) return [...new Set(tags)]
    }
  }

  return []
}

export function waitForProblemData(timeoutMs = 15000): Promise<ProblemData> {
  return new Promise((resolve, reject) => {
    const check = () => {
      const data = extractProblemData()
      if (data) { resolve(data); return true }
      return false
    }

    if (check()) return

    const observer = new MutationObserver(() => { if (check()) observer.disconnect() })
    observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      reject(new Error('Timed out waiting for problem content to load'))
    }, timeoutMs)
  })
}
