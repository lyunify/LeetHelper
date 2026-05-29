# LeetHelper — Design Spec
*2026-05-29*

## Overview

LeetHelper is a Chrome Extension (Manifest V3) for Chinese-speaking LeetCode users. It injects a right-side panel into LeetCode problem pages that uses Claude AI to explain problems in Chinese, identify the algorithm pattern being tested, and suggest how to open a solution verbally in an interview setting.

**Target user:** Chinese-speaking CS students preparing for SDE interviews who struggle with English problem statements or knowing which algorithmic pattern to apply.

**Not in scope (MVP):** mistake notebook, progress tracking, backend service, multi-language i18n.

---

## Architecture

Chrome extensions have three isolated layers that communicate via message passing:

| Layer | File(s) | Role |
|---|---|---|
| **Popup** | `src/popup/App.tsx` | Settings UI — API key input, provider toggle (Claude/OpenAI), language toggle |
| **Content Script** | `src/content/index.tsx`, `Panel.tsx`, `extractor.ts` | Injects right-side React panel into LeetCode problem pages; extracts problem text from DOM |
| **Background** | `src/background/service-worker.ts` | Service worker; holds API key in memory for request lifetime; makes Claude API calls |
| **Shared** | `src/shared/types.ts`, `storage.ts` | Message type definitions; `chrome.storage` wrapper |

**Data flow:**
1. User navigates to a LeetCode problem page
2. Content script detects the problem page, mounts React panel into a new `<div>` appended to the layout
3. User clicks "分析题目" in the panel
4. Content script extracts problem title + description text from DOM, sends `ANALYZE_PROBLEM` message to background
5. Background retrieves API key from `chrome.storage.local`, calls Claude API (`claude-haiku-4-5` for speed/cost)
6. Background sends complete response back to content script via `chrome.runtime.sendMessage`
7. Panel renders the three output sections

**Why API key lives in background, not content script:** Content script code is visible in DevTools; background service worker is not inspectable by page JS.

---

## Features (MVP)

### 1. Right-Side Analysis Panel
Injected into every `leetcode.com/problems/*` page. Always visible, does not overlap the problem description.

**Sections rendered after analysis:**
- **题目解释** — Simplified Chinese restatement of the problem, stripping verbose boilerplate, keeping constraints
- **考点标签** — Algorithm pattern badge(s): e.g. `滑动窗口`, `双指针`, `BFS`, `动态规划`
- **AI 题解** — Claude generates a clean solution in the user's preferred language (default: Java). Shows brute-force approach first with time/space complexity, then optimized solution with explanation. Replaces the need to browse LeetCode's solution tabs.

**States:** idle → loading (spinner) → result | error

### 2. Popup Settings
- API provider toggle: Claude / OpenAI
- API key input (masked), stored in `chrome.storage.local`
- Analysis language toggle: 中文 / English
- Coding language selector: Java (default) / Python / C++ / JavaScript
- Connection status indicator (green = key present, red = missing)

---

## Tech Stack

| Tool | Version | Why |
|---|---|---|
| TypeScript | 5.x | Type safety, required for enterprise credibility |
| React | 18 | Component model for panel UI |
| Vite | 5.x | Fast dev server |
| CRXJS | 2.x | Vite plugin that handles Chrome extension HMR and manifest bundling |
| Tailwind CSS | 3.x | Rapid styling without CSS files |
| Claude API | `claude-haiku-4-5` | Fast, cheap, high quality for this use case |
| Manifest V3 | — | Current Chrome standard, required for Chrome Web Store |

---

## Claude Prompt Design

System prompt instructs Claude to return structured JSON:

```json
{
  "explanation": "中文题目解释...",
  "patterns": ["滑动窗口", "双指针"],
  "brute_force": {
    "code": "// Java brute force solution...",
    "time_complexity": "O(n²)",
    "space_complexity": "O(1)",
    "explanation": "暴力解思路..."
  },
  "optimized": {
    "code": "// Java optimized solution...",
    "time_complexity": "O(n)",
    "space_complexity": "O(n)",
    "explanation": "优化思路..."
  }
}
```

User message contains: problem title + full problem description text extracted from DOM.

Temperature: 0.3 (factual, consistent output).

---

## Chrome Storage Schema

```typescript
// chrome.storage.local
{
  apiProvider: "claude" | "openai",
  apiKey: string,
  analysisLanguage: "zh" | "en",
  codingLanguage: "java" | "python" | "cpp" | "javascript"  // default: "java"
}
```

---

## Message Protocol (Content ↔ Background)

```typescript
// Content → Background
{ type: "ANALYZE_PROBLEM", payload: { title: string, description: string } }

// Background → Content
{ type: "ANALYSIS_RESULT", payload: AnalysisResult }
{ type: "ANALYSIS_ERROR", payload: { message: string } }
```

---

## File Structure

```
leet-helper/
├── manifest.json
├── index.html              ← popup entry
├── vite.config.ts
├── tailwind.config.ts
├── src/
│   ├── popup/
│   │   └── App.tsx
│   ├── content/
│   │   ├── index.tsx       ← mounts panel into page
│   │   ├── Panel.tsx       ← main panel component
│   │   └── extractor.ts    ← DOM scraping logic
│   ├── background/
│   │   └── service-worker.ts
│   └── shared/
│       ├── types.ts
│       └── storage.ts
├── public/
│   └── icons/              ← 16, 48, 128px PNGs
└── docs/
    └── superpowers/specs/
        └── 2026-05-29-leethelper-design.md
```

---

## Out of Scope (Future)

- Mistake notebook with spaced repetition
- Progress tracking dashboard
- Backend proxy service
- OpenAI support (Claude only for MVP, toggle UI stubbed)
