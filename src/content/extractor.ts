export interface ProblemData {
  title: string
  description: string
}

export function extractProblemData(): ProblemData | null {
  // --- Title ---
  // LeetCode changes their DOM frequently. Try multiple selectors.
  // Most reliable: document.title is always "Problem Name - LeetCode"
  const titleFromPage =
    document.querySelector('[data-cy="question-title"]')?.textContent?.trim() ??
    document.querySelector('[data-testid="question-title"]')?.textContent?.trim() ??
    document.querySelector('h1')?.textContent?.trim()

  // Fallback: parse document.title ("1. Two Sum - LeetCode" → "Two Sum")
  const titleFromDocTitle = document.title
    .replace(/^\d+\.\s*/, '')   // strip leading "1. "
    .replace(/\s*[-–|].*$/, '') // strip " - LeetCode" suffix
    .trim()

  const title = titleFromPage || titleFromDocTitle
  if (!title || title === 'LeetCode') return null

  // --- Description ---
  // Try every known LeetCode description container selector
  const descEl =
    document.querySelector('[data-track-load="description_content"]') ??
    document.querySelector('.question-content__JfgR') ??
    document.querySelector('[class*="question-content"]') ??
    document.querySelector('.content__u3I1') ??
    // 2024-2025 LeetCode structure: description is in a div inside the problem tab
    document.querySelector('div.elfjS') ??
    document.querySelector('div.xFUwe') ??
    // Broader fallback: find a div with substantial text near the problem area
    (() => {
      // Look for a div that contains "Example" text — always present in LeetCode problems
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

  return { title, description }
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
