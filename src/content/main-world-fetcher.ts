// Runs in the page's MAIN world (declared in manifest.json).
// Fetch requests from here have Origin: https://leetcode.com and
// Sec-Fetch-Site: same-origin, so LeetCode's server accepts them.
// Communicates with the isolated content script via postMessage.

const ALLOWED_URL = 'https://leetcode.com/graphql/'

window.addEventListener('message', async (event: MessageEvent) => {
  if (event.source !== window) return
  if (!event.data || event.data.type !== 'LEET_FETCH_REQUEST') return

  const { id, body } = event.data as { id: string; body: string }

  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1] ?? ''

  try {
    const response = await fetch(ALLOWED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrftoken': csrfToken,
        'X-Operation-Name': 'ugcArticleSolutionArticles',
        'Referer': window.location.href,
      },
      credentials: 'include',
      body,
    })

    const text = await response.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text }

    window.postMessage({
      type: 'LEET_FETCH_RESPONSE',
      id,
      ok: response.ok,
      status: response.status,
      data,
      // On error, expose the raw body so we can debug
      error: response.ok ? undefined : String(text).substring(0, 300),
    }, window.location.origin)
  } catch (e: unknown) {
    window.postMessage({
      type: 'LEET_FETCH_RESPONSE',
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, window.location.origin)
  }
})
