import React from 'react'
import ReactDOM from 'react-dom/client'
import Panel from './Panel'
import panelCSS from './panel.css?inline'
import { waitForProblemData } from './extractor'

function isProblemPage() {
  return /leetcode\.com\/problems\/[^/]+/.test(location.href)
}

function mountPanel() {
  document.getElementById('leet-helper-host')?.remove()

  if (!isProblemPage()) return

  const host = document.createElement('div')
  host.id = 'leet-helper-host'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = panelCSS
  shadow.appendChild(style)

  const container = document.createElement('div')
  shadow.appendChild(container)

  waitForProblemData()
    .then(({ title, description }) => {
      ReactDOM.createRoot(container).render(
        <Panel title={title} description={description} />
      )
    })
    .catch(console.error)
}

function getProblemSlug(): string | null {
  const match = location.href.match(/\/problems\/([^/]+)/)
  return match?.[1] ?? null
}

mountPanel()

let lastUrl = location.href
let lastSlug = getProblemSlug()
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    const newSlug = getProblemSlug()
    if (newSlug !== lastSlug) {
      lastSlug = newSlug
      mountPanel()
    }
  }
}).observe(document, { subtree: true, childList: true })
