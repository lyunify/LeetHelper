export interface ProblemData {
  title: string
  description: string
}

export function extractProblemData(): ProblemData | null {
  // LeetCode renders the problem title in an element with data-cy="question-title"
  // Fallback: use the first h1 on the page
  const titleEl =
    document.querySelector('[data-cy="question-title"]') ??
    document.querySelector('h1')

  // LeetCode renders problem content in a div with data-track-load="description_content"
  // Fallback: older LeetCode class (may change — verify against live page if needed)
  const descEl =
    document.querySelector('[data-track-load="description_content"]') ??
    document.querySelector('.question-content__JfgR')

  if (!titleEl || !descEl) return null

  const title = titleEl.textContent?.trim() ?? ''
  const description = descEl.textContent?.trim() ?? ''

  if (!title || !description) return null

  return { title, description }
}

// Waits for the problem page DOM to fully load (LeetCode is a SPA, content loads async)
export function waitForProblemData(timeoutMs = 10000): Promise<ProblemData> {
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
