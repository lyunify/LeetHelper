# ⚡ LeetHelper

A Chrome extension that brings AI-powered analysis and top community solutions directly onto any LeetCode problem page, without leaving the editor.

---

## Features

- **AI Analysis:** Sends the problem to Claude and returns a structured breakdown: plain-English explanation, algorithm patterns, brute-force solution, and optimized solution with complexity
- **Community Solutions:** Fetches the top-voted LeetCode community solutions via the GraphQL API, with syntax-highlighted code and multi-language tabs (Python, Java, C++, and more)
- **Syntax Highlighting:** 10 languages supported via highlight.js, injected cleanly into the Shadow DOM
- **Solution Cache:** Fetched solutions are cached in `chrome.storage.local` with a 24-hour TTL to avoid redundant API calls
- **Problem History:** Tracks the last 50 problems viewed, accessible from the popup with AI/LC source badge
- **Draggable & Resizable Panel:** Floating panel with persistent position/size saved to `localStorage`
- **Keyboard Shortcut:** `Option+L` (Mac) / `Alt+L` (Windows/Linux) toggles the panel
- **Today's Badge:** Extension icon shows how many problems you've looked at today
- **Onboarding Flow:** First-time users are guided through API key setup

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LeetCode Page                        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Content Script (ISOLATED world)                 │   │
│  │                                                  │   │
│  │  Panel.tsx (React, Shadow DOM)                   │   │
│  │    └─ postMessage ──────────────────────────┐    │   │
│  └────────────────────────────────────────────▼│───┘   │
│                                                │        │
│  ┌─────────────────────────────────────────────┴────┐   │
│  │  main-world-fetcher.ts (MAIN world)              │   │
│  │                                                  │   │
│  │  fetch("https://leetcode.com/graphql/", ...)     │   │
│  │    Origin: https://leetcode.com  ✓ CORS OK       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │  chrome.runtime.sendMessage
         ▼
┌─────────────────────────────┐
│  Background Service Worker  │
│                             │
│  Anthropic SDK -> Claude API│
└─────────────────────────────┘
```

### Key Design Decisions

**Shadow DOM isolation:** The panel is mounted inside a Shadow DOM to prevent CSS conflicts with LeetCode's own styles. Tailwind utility classes and highlight.js theme CSS are injected directly into the shadow root.

**MAIN world postMessage bridge:** Chrome MV3 content scripts run in an isolated JavaScript context. Fetch requests from there carry a different `Origin` header and are blocked by LeetCode's CORS policy. To work around this, `main-world-fetcher.ts` is declared as a `"world": "MAIN"` content script, which runs in the same context as the page itself. The isolated script sends requests to it via `postMessage`, and it performs the actual `fetch` with `Origin: https://leetcode.com`.

**Solution caching:** Each fetched solution article is stored in `chrome.storage.local` keyed by slug, with a timestamp. On subsequent loads the cache is checked first; entries older than 24 hours are evicted and re-fetched.

**Slug-based remount guard:** LeetCode is a single-page app. A `MutationObserver` watches for URL changes, but the panel is only remounted when the problem slug actually changes, not on tab switches within the same problem, preserving state across the Description / Solutions / Editorial tabs.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, Tailwind CSS |
| Build | Vite + @crxjs/vite-plugin |
| Language | TypeScript |
| Syntax highlighting | highlight.js (10 languages, tree-shaken) |
| AI | Anthropic Claude (claude-haiku-4-5) |
| Extension | Chrome MV3 |

---

## Project Structure

```
src/
├── background/
│   └── service-worker.ts     # Handles AI requests via Anthropic SDK; updates badge count
├── content/
│   ├── index.tsx             # Mounts Shadow DOM panel; keyboard shortcut; SPA nav guard
│   ├── Panel.tsx             # Main React UI: draggable panel, AI results, LC solutions
│   ├── leetcode-api.ts       # GraphQL queries, code extraction, complexity parsing
│   ├── main-world-fetcher.ts # MAIN world fetch bridge (CORS workaround)
│   ├── solution-cache.ts     # chrome.storage.local cache with TTL
│   └── extractor.ts          # Extracts problem title/description from the DOM
├── popup/
│   └── App.tsx               # Settings UI + onboarding flow + problem history
└── shared/
    ├── types.ts              # Shared TypeScript types
    ├── storage.ts            # chrome.storage wrapper
    └── history.ts            # Problem view history (read/write/clear)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Claude API key from [console.anthropic.com](https://console.anthropic.com/settings/keys)

### Install & Build

```bash
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder
4. Navigate to any LeetCode problem page

### First Use

Click the ⚡ LeetHelper icon in the toolbar and enter your Claude API key. The panel will appear on every problem page automatically.

---

## Development

```bash
npm run dev      # Vite dev build with watch
npm run test     # Run unit tests (Vitest)
```

After any code change, run `npm run build` and click the reload icon on the extension card in `chrome://extensions`.
