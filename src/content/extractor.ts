export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface ProblemData {
  title: string
  description: string
  difficulty: Difficulty | null
}

export function extractProblemData(): ProblemData | null {
  // --- Title ---
  // document.title is typically "2. Add Two Numbers - LeetCode"
  const titleFromDocTitle = document.title
    .replace(/\s*[-–|].*$/, '')  // strip " - LeetCode" suffix
    .trim()
  // e.g. "2. Add Two Numbers"

  const titleFromPage =
    document.querySelector('[data-cy="question-title"]')?.textContent?.trim() ??
    document.querySelector('[data-testid="question-title"]')?.textContent?.trim() ??
    document.querySelector('h1')?.textContent?.trim()

  // Prefer doc title when it starts with a number (has the problem number)
  // Otherwise fall back to page element title
  const title = /^\d+\./.test(titleFromDocTitle)
    ? titleFromDocTitle
    : (titleFromPage || titleFromDocTitle)

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
