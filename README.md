# ⚡ LeetHelper

A Chrome extension that brings AI-powered analysis and top community solutions directly onto any LeetCode problem page — without leaving the editor.

---

## Features

### Core
- **AI Analysis** — Sends the problem to Claude or OpenAI and returns a structured breakdown: plain-language explanation, algorithm patterns, brute-force + optimised solutions with complexity analysis
- **Community Solutions** — Fetches the top-voted LeetCode community solutions via the GraphQL API, with multi-language tabs and syntax-highlighted code
- **Official Topic Tags** — Extracts LeetCode's official topic tags from the page (Array, Dynamic Programming, Graph, etc.) and displays them alongside AI-identified patterns
- **Syntax Highlighting** — 10 languages via highlight.js (github-dark theme), injected cleanly into the Shadow DOM, with a one-click copy button on every code block

### Panel UX
- **4-Tab Panel** — AI分析 · 社区题解 · 战绩 · 历史, always visible at the top of the panel
- **Problem Status** — Mark any problem as 已解 / 尝试 / 待做; persisted per-problem in `chrome.storage.local`
- **Notes** — Inline textarea for per-problem notes, auto-saved on every keystroke
- **Pomodoro Timer** — Built-in 25/5 min work-break timer toggled from the header; auto-switches modes when time is up
- **Font Size Toggle** — Switch code blocks between small and large font (A / A buttons)
- **Side Toggle** — Snap the panel to the left or right side of the screen with one click (⇄)
- **Draggable & Resizable** — Drag the header to reposition; drag the bottom-left handle to resize; position and size persist across sessions
- **Collapsible** — Collapse to a slim ⚡ LeetHelper branded tab pinned to the screen edge; click or drag to reopen
- **Keyboard Shortcuts** — `Option+L` / `Alt+L` toggles panel visibility; `←` / `→` arrows navigate between community solutions

### Memory & History
- **State Persistence** — AI results and community solutions are cached per-problem + per-language; navigating away and back restores the panel automatically
- **Problem History** — Every problem viewed is recorded; the 历史 tab shows a timestamped list with clickable entries that restore the cached result in-panel if you're on the same problem
- **Copy as Markdown** — Export the current AI or community solution as a formatted Markdown snippet

### Stats (战绩)
- **12-Week Heatmap** — GitHub-style activity grid showing how many problems you looked at each day
- **Streak Counter** — Consecutive-day streak with 🔥 indicator
- **Summary Cards** — Today / This Week / Total / Streak at a glance
- **Source Breakdown** — AI vs community solution usage counts

### Settings & Onboarding
- **Multi-Provider** — Supports Claude (claude-haiku-4-5) and OpenAI (gpt-4o-mini); switch from the popup
- **Analysis Language** — Chinese (中文) or English output from the AI
- **Coding Language** — Java, Python, C++, JavaScript; auto-detected from the LeetCode editor
- **Today's Badge** — Extension icon shows how many problems you've looked at today
- **Onboarding Flow** — First-time users are guided through API key setup

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
│  Claude API / OpenAI API    │
└─────────────────────────────┘
```

### Key Design Decisions

**Shadow DOM isolation:** The panel is mounted inside a Shadow DOM to prevent CSS conflicts with LeetCode's own styles. Tailwind utility classes and the highlight.js theme CSS are injected directly into the shadow root.

**MAIN world postMessage bridge:** Chrome MV3 content scripts run in an isolated JavaScript context. Fetch requests from there carry a different `Origin` header and are blocked by LeetCode's CORS policy. `main-world-fetcher.ts` is declared as a `"world": "MAIN"` content script, runs in the same context as the page, and performs the actual GraphQL fetch with `Origin: https://leetcode.com`.

**Two-layer cache:** AI results are cached in `chrome.storage.local` keyed by `slug + language` with no TTL (problems don't change). Community solution lists are cached the same way. On remount, the panel restores whichever cache has a hit, so navigating between problems and back feels instant.

**Slug-based remount guard:** LeetCode is a single-page app. A `MutationObserver` watches for URL changes, but the panel is only remounted when the problem slug actually changes — not on tab switches within the same problem — preserving state across Description / Solutions / Editorial tabs.

**Extension context guard:** All `chrome.*` API calls are wrapped in a `contextValid()` check so the panel degrades gracefully after the extension is reloaded or updated without requiring a page refresh.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, Tailwind CSS |
| Build | Vite + @crxjs/vite-plugin |
| Language | TypeScript (strict) |
| Syntax highlighting | highlight.js (10 languages, tree-shaken) |
| AI | Claude claude-haiku-4-5 / OpenAI gpt-4o-mini |
| Testing | Vitest + React Testing Library |
| Extension | Chrome MV3 |

---

## Project Structure

```
src/
├── background/
│   └── service-worker.ts       # AI requests (Claude + OpenAI); badge count
├── content/
│   ├── index.tsx               # Shadow DOM mount; keyboard shortcut; SPA nav guard
│   ├── Panel.tsx               # Main React UI: 4-tab panel, timer, all UX
│   ├── leetcode-api.ts         # GraphQL queries, code extraction, complexity parsing
│   ├── main-world-fetcher.ts   # MAIN world fetch bridge (CORS workaround)
│   └── extractor.ts            # Extracts title, description, difficulty, topic tags
├── popup/
│   └── App.tsx                 # Settings, onboarding, history, stats (popup)
└── shared/
    ├── types.ts                # Shared TypeScript types
    ├── storage.ts              # chrome.storage wrapper with context guard
    ├── history.ts              # Problem view history + streak calculation
    ├── ai-cache.ts             # AI result + LC solution list cache
    └── problem-meta.ts         # Per-problem status and notes
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Claude API key from [console.anthropic.com](https://console.anthropic.com/settings/keys), or an OpenAI API key

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

Click the ⚡ LeetHelper icon in the toolbar and enter your API key. The panel will appear on every problem page automatically.

---

## Development

```bash
npm run dev      # Vite dev build with watch
npm run test     # Run unit tests (Vitest)
```

After any code change, run `npm run build` and click the reload icon on the extension card in `chrome://extensions`.
