# LeetHelper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome Extension (Manifest V3) that injects a right-side panel into LeetCode problem pages, providing Chinese problem explanation, algorithm pattern tags, and an AI-generated solution in the user's preferred language (Java/Python/etc).

**Architecture:** Three-layer MV3 extension: Popup (React settings UI), Content Script (injects React panel into LeetCode via Shadow DOM), Background Service Worker (holds API key, calls Claude API). Layers communicate via `chrome.runtime.sendMessage`. Shadow DOM isolates panel styles from LeetCode's page.

**Tech Stack:** TypeScript 5, React 18, Vite 5, CRXJS v2 (beta), Tailwind CSS 3, @anthropic-ai/sdk, Vitest + @testing-library/react + jsdom, Chrome Manifest V3

---

## File Map

| File | Role |
|---|---|
| `manifest.json` | MV3 config — permissions, entry points, icons |
| `vite.config.ts` | Vite + CRXJS + Vitest config |
| `tailwind.config.ts` | Tailwind content paths |
| `index.html` | Popup entry HTML |
| `src/shared/types.ts` | All shared TypeScript types and interfaces |
| `src/shared/storage.ts` | `chrome.storage.local` wrapper |
| `src/shared/storage.test.ts` | Unit tests for storage |
| `src/background/service-worker.ts` | Claude API calls, message listener |
| `src/content/extractor.ts` | DOM scraping — extracts problem title + description |
| `src/content/extractor.test.ts` | Unit tests for extractor |
| `src/content/Panel.tsx` | Main right-side analysis panel component |
| `src/content/Panel.test.tsx` | Component tests for Panel |
| `src/content/panel.css` | Tailwind CSS for panel (imported as inline string) |
| `src/content/index.tsx` | Content script entry — mounts Panel into Shadow DOM, handles SPA nav |
| `src/popup/App.tsx` | Popup settings component |
| `src/popup/App.test.tsx` | Component tests for popup |
| `src/test/setup.ts` | Vitest setup — imports jest-dom matchers |
| `public/icons/` | Extension icons (16, 48, 128px) |

---

## Task 1: Bootstrap Project + Connect to GitHub

**Files:**
- Create: `manifest.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/test/setup.ts`
- Create: `.gitignore`
- Modify: `package.json` (via npm commands)

- [ ] **Step 1: Scaffold Vite project in current directory**

Run in `/Users/katy/projects/extensions`. When prompted "Current directory is not empty, remove existing files and continue?", type `y` and press Enter.

```bash
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install all dependencies**

```bash
npm install
npm install @crxjs/vite-plugin@beta
npm install @anthropic-ai/sdk
npm install -D tailwindcss postcss autoprefixer
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @types/chrome
npx tailwindcss init --ts -p
```

- [ ] **Step 3: Write vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
})
```

- [ ] **Step 4: Write manifest.json**

```json
{
  "manifest_version": 3,
  "name": "LeetHelper",
  "version": "0.1.0",
  "description": "AI-powered LeetCode companion for Chinese developers — problem explanation, pattern tags, and clean solutions",
  "permissions": ["storage"],
  "host_permissions": [
    "https://leetcode.com/*",
    "https://api.anthropic.com/*"
  ],
  "action": {
    "default_popup": "index.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["src/content/index.tsx"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 5: Update tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

- [ ] **Step 6: Write index.html (popup entry)**

```html
<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LeetHelper</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/popup/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Write src/popup/main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './main.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 8: Write src/popup/main.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Write src/test/setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 10: Write .gitignore**

```
node_modules/
dist/
.env
.env.local
.superpowers/
```

- [ ] **Step 11: Delete Vite boilerplate**

```bash
rm -rf src/assets src/App.css src/App.tsx src/index.css src/main.tsx public/vite.svg
```

- [ ] **Step 12: Create icons placeholder directory**

```bash
mkdir -p public/icons
```

We'll add real icons in Task 7. For now, create placeholder PNGs so the extension loads:

```bash
# Creates minimal 1x1 pixel PNG files as placeholders
python3 -c "
import struct, zlib, base64

def make_png(size):
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(c[4:]) & 0xffffffff)
    
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    row = b'\\x00' + b'\\x4f\\x46\\xe5' * size
    idat = zlib.compress(row * size)
    
    return b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

for s in [16, 48, 128]:
    with open(f'public/icons/icon{s}.png', 'wb') as f:
        f.write(make_png(s))
print('Icons created')
"
```

- [ ] **Step 13: Add scripts to package.json**

Edit `package.json` — find the `"scripts"` section and replace it with:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "test": "vitest",
  "test:run": "vitest run",
  "preview": "vite preview"
},
```

- [ ] **Step 14: Initialize git and connect to GitHub**

```bash
git init
git remote add origin https://github.com/lyunify/LeetHelper-.git
git add manifest.json vite.config.ts tailwind.config.ts postcss.config.js index.html package.json package-lock.json tsconfig.json tsconfig.node.json .gitignore src/test/setup.ts src/popup/main.tsx src/popup/main.css public/icons/
git commit -m "chore: initialize LeetHelper Chrome extension project"
git branch -M main
git push -u origin main
```

---

## Task 2: Shared Types and Storage Module

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/storage.ts`
- Create: `src/shared/storage.test.ts`

- [ ] **Step 1: Write the failing storage tests**

Create `src/shared/storage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getStorage, setStorage } from './storage'

const mockStore: Record<string, unknown> = {}

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((keys: string[]) => {
        const result: Record<string, unknown> = {}
        keys.forEach(k => { if (k in mockStore) result[k] = mockStore[k] })
        return Promise.resolve(result)
      }),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockStore, data)
        return Promise.resolve()
      }),
    },
  },
})

beforeEach(() => { Object.keys(mockStore).forEach(k => delete mockStore[k]) })

describe('getStorage', () => {
  it('returns defaults when storage is empty', async () => {
    const data = await getStorage()
    expect(data.apiProvider).toBe('claude')
    expect(data.codingLanguage).toBe('java')
    expect(data.analysisLanguage).toBe('zh')
    expect(data.apiKey).toBe('')
  })

  it('returns stored value when set', async () => {
    mockStore.apiKey = 'sk-ant-test'
    mockStore.codingLanguage = 'python'
    const data = await getStorage()
    expect(data.apiKey).toBe('sk-ant-test')
    expect(data.codingLanguage).toBe('python')
  })

  it('merges defaults with partial stored values', async () => {
    mockStore.apiKey = 'sk-ant-test'
    const data = await getStorage()
    expect(data.apiKey).toBe('sk-ant-test')
    expect(data.codingLanguage).toBe('java') // still default
  })
})

describe('setStorage', () => {
  it('stores values in chrome.storage.local', async () => {
    await setStorage({ apiKey: 'sk-ant-test' })
    expect(mockStore.apiKey).toBe('sk-ant-test')
  })

  it('stores partial updates without overwriting other keys', async () => {
    mockStore.apiKey = 'existing-key'
    await setStorage({ codingLanguage: 'python' })
    expect(mockStore.apiKey).toBe('existing-key')
    expect(mockStore.codingLanguage).toBe('python')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test:run src/shared/storage.test.ts
```

Expected: FAIL — `Cannot find module './storage'`

- [ ] **Step 3: Write src/shared/types.ts**

```typescript
export type ApiProvider = 'claude' | 'openai'
export type CodingLanguage = 'java' | 'python' | 'cpp' | 'javascript'
export type AnalysisLanguage = 'zh' | 'en'

export interface StorageData {
  apiProvider: ApiProvider
  apiKey: string
  analysisLanguage: AnalysisLanguage
  codingLanguage: CodingLanguage
}

export interface Solution {
  code: string
  timeComplexity: string
  spaceComplexity: string
  explanation: string
}

export interface AnalysisResult {
  explanation: string
  patterns: string[]
  bruteForce: Solution
  optimized: Solution
}

export interface AnalysisRequest {
  title: string
  description: string
  codingLanguage: CodingLanguage
  analysisLanguage: AnalysisLanguage
}

export type ExtensionMessage =
  | { type: 'ANALYZE_PROBLEM'; payload: AnalysisRequest }
  | { type: 'ANALYSIS_RESULT'; payload: AnalysisResult }
  | { type: 'ANALYSIS_ERROR'; payload: { message: string } }
```

- [ ] **Step 4: Write src/shared/storage.ts**

```typescript
import type { StorageData } from './types'

const DEFAULTS: StorageData = {
  apiProvider: 'claude',
  apiKey: '',
  analysisLanguage: 'zh',
  codingLanguage: 'java',
}

export async function getStorage(): Promise<StorageData> {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS))
  return { ...DEFAULTS, ...stored } as StorageData
}

export async function setStorage(updates: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(updates)
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test:run src/shared/storage.test.ts
```

Expected: PASS — 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/storage.ts src/shared/storage.test.ts
git commit -m "feat: add shared types and chrome.storage wrapper"
```

---

## Task 3: Background Service Worker

**Files:**
- Create: `src/background/service-worker.ts`

The service worker calls Claude API. We don't unit test it (it depends on the Anthropic SDK and chrome APIs together), but it's covered by manual testing in Task 7.

- [ ] **Step 1: Write src/background/service-worker.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { AnalysisRequest, AnalysisResult, ExtensionMessage } from '../shared/types'
import { getStorage } from '../shared/storage'

const SYSTEM_PROMPT = `You are a LeetCode assistant for Chinese-speaking developers.
Analyze the LeetCode problem and return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "explanation": "简洁的中文题目解释，去掉废话，保留关键约束和边界条件",
  "patterns": ["算法模式，如: 滑动窗口", "双指针"],
  "bruteForce": {
    "code": "// complete working solution code",
    "timeComplexity": "O(?)",
    "spaceComplexity": "O(?)",
    "explanation": "暴力解思路"
  },
  "optimized": {
    "code": "// complete working optimized solution code",
    "timeComplexity": "O(?)",
    "spaceComplexity": "O(?)",
    "explanation": "优化思路和关键洞察"
  }
}`

async function analyzeProblem(request: AnalysisRequest): Promise<AnalysisResult> {
  const { apiKey, codingLanguage, analysisLanguage } = await getStorage()

  if (!apiKey) throw new Error('未设置 API Key，请点击扩展图标进行设置')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const languageMap: Record<string, string> = {
    java: 'Java',
    python: 'Python',
    cpp: 'C++',
    javascript: 'JavaScript',
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Problem Title: ${request.title}

Problem Description:
${request.description}

Requirements:
- Generate solutions in ${languageMap[codingLanguage] ?? codingLanguage}
- Explanation language: ${analysisLanguage === 'zh' ? 'Chinese (中文)' : 'English'}
- Include complete, runnable code for both brute force and optimized solutions`,
      },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')

  let text = block.text.trim()
  // Strip markdown code fences if Claude adds them despite instructions
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }

  return JSON.parse(text) as AnalysisResult
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'ANALYZE_PROBLEM') {
      analyzeProblem(message.payload)
        .then(result => sendResponse({ type: 'ANALYSIS_RESULT', payload: result }))
        .catch(err =>
          sendResponse({ type: 'ANALYSIS_ERROR', payload: { message: err.message } })
        )
      return true // keeps the message channel open for the async response
    }
  }
)
```

- [ ] **Step 2: Commit**

```bash
git add src/background/service-worker.ts
git commit -m "feat: add background service worker with Claude API integration"
```

---

## Task 4: DOM Extractor

**Files:**
- Create: `src/content/extractor.ts`
- Create: `src/content/extractor.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/content/extractor.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { extractProblemData } from './extractor'

beforeEach(() => { document.body.innerHTML = '' })

describe('extractProblemData', () => {
  it('returns null when page has no problem elements', () => {
    document.body.innerHTML = '<div>random content</div>'
    expect(extractProblemData()).toBeNull()
  })

  it('extracts title using data-cy="question-title" selector', () => {
    document.body.innerHTML = `
      <div data-cy="question-title">Two Sum</div>
      <div data-track-load="description_content">Given an array of integers nums and an integer target</div>
    `
    const result = extractProblemData()
    expect(result?.title).toBe('Two Sum')
    expect(result?.description).toBe('Given an array of integers nums and an integer target')
  })

  it('falls back to h1 for title when data-cy selector is absent', () => {
    document.body.innerHTML = `
      <h1>Three Sum</h1>
      <div data-track-load="description_content">Given an integer array nums</div>
    `
    expect(extractProblemData()?.title).toBe('Three Sum')
  })

  it('returns null when title element is missing', () => {
    document.body.innerHTML = `
      <div data-track-load="description_content">Given an array...</div>
    `
    expect(extractProblemData()).toBeNull()
  })

  it('returns null when description element is missing', () => {
    document.body.innerHTML = `
      <div data-cy="question-title">Two Sum</div>
    `
    expect(extractProblemData()).toBeNull()
  })

  it('trims whitespace from extracted text', () => {
    document.body.innerHTML = `
      <div data-cy="question-title">  Two Sum  </div>
      <div data-track-load="description_content">  Given an array  </div>
    `
    const result = extractProblemData()
    expect(result?.title).toBe('Two Sum')
    expect(result?.description).toBe('Given an array')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test:run src/content/extractor.test.ts
```

Expected: FAIL — `Cannot find module './extractor'`

- [ ] **Step 3: Write src/content/extractor.ts**

```typescript
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
    observer.observe(document.body, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      reject(new Error('Timed out waiting for problem content to load'))
    }, timeoutMs)
  })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test:run src/content/extractor.test.ts
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/content/extractor.ts src/content/extractor.test.ts
git commit -m "feat: add LeetCode DOM extractor with MutationObserver fallback"
```

---

## Task 5: Content Script Panel Component

**Files:**
- Create: `src/content/panel.css`
- Create: `src/content/Panel.tsx`
- Create: `src/content/Panel.test.tsx`
- Create: `src/content/index.tsx`

- [ ] **Step 1: Write failing Panel tests**

Create `src/content/Panel.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Panel from './Panel'
import type { AnalysisResult } from '../shared/types'

const mockResult: AnalysisResult = {
  explanation: '找两个数使其和等于目标值，返回下标',
  patterns: ['哈希表', '双指针'],
  bruteForce: {
    code: 'for (int i=0;...) for (int j=i+1;...)',
    timeComplexity: 'O(n²)',
    spaceComplexity: 'O(1)',
    explanation: '两层循环枚举所有对',
  },
  optimized: {
    code: 'Map<Integer,Integer> map = new HashMap<>();',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    explanation: '用哈希表记录已见过的数',
  },
}

vi.stubGlobal('chrome', {
  runtime: { sendMessage: vi.fn() },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({ codingLanguage: 'java', analysisLanguage: 'zh' })),
    },
  },
})

beforeEach(() => vi.clearAllMocks())

describe('Panel', () => {
  it('shows analyze button in idle state', () => {
    render(<Panel title="Two Sum" description="Given an array..." />)
    expect(screen.getByRole('button', { name: /分析题目/ })).toBeInTheDocument()
  })

  it('shows loading state while waiting for response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockReturnValue(new Promise(() => {}))
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    expect(await screen.findByText(/分析中/)).toBeInTheDocument()
  })

  it('shows error message when API returns error', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      type: 'ANALYSIS_ERROR',
      payload: { message: '未设置 API Key' },
    })
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    expect(await screen.findByText(/未设置 API Key/)).toBeInTheDocument()
  })

  it('renders explanation and pattern tags after successful analysis', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      type: 'ANALYSIS_RESULT',
      payload: mockResult,
    })
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    expect(await screen.findByText('找两个数使其和等于目标值，返回下标')).toBeInTheDocument()
    expect(screen.getByText('哈希表')).toBeInTheDocument()
    expect(screen.getByText('双指针')).toBeInTheDocument()
  })

  it('shows optimized solution tab by default', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      type: 'ANALYSIS_RESULT',
      payload: mockResult,
    })
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    await screen.findByText('找两个数使其和等于目标值，返回下标')
    expect(screen.getByText('O(n)')).toBeInTheDocument() // optimized time complexity
  })

  it('switches to brute force tab on click', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      type: 'ANALYSIS_RESULT',
      payload: mockResult,
    })
    render(<Panel title="Two Sum" description="Given an array..." />)
    fireEvent.click(screen.getByRole('button', { name: /分析题目/ }))
    await screen.findByText('找两个数使其和等于目标值，返回下标')
    fireEvent.click(screen.getByRole('button', { name: /暴力解/ }))
    expect(screen.getByText('O(n²)')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test:run src/content/Panel.test.tsx
```

Expected: FAIL — `Cannot find module './Panel'`

- [ ] **Step 3: Write src/content/panel.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Scoped to shadow DOM — no risk of leaking into LeetCode's page */
* { box-sizing: border-box; }
pre { white-space: pre-wrap; word-break: break-all; }
```

- [ ] **Step 4: Write src/content/Panel.tsx**

```tsx
import React, { useState } from 'react'
import type { AnalysisResult, ExtensionMessage } from '../shared/types'
import { getStorage } from '../shared/storage'

type PanelState = 'idle' | 'loading' | 'result' | 'error'
type SolutionTab = 'optimized' | 'brute'

interface PanelProps {
  title: string
  description: string
}

export default function Panel({ title, description }: PanelProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<SolutionTab>('optimized')
  const [collapsed, setCollapsed] = useState(false)

  const handleAnalyze = async () => {
    setState('loading')
    const { codingLanguage, analysisLanguage } = await getStorage()

    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_PROBLEM',
      payload: { title, description, codingLanguage, analysisLanguage },
    } satisfies ExtensionMessage) as ExtensionMessage

    if (response.type === 'ANALYSIS_RESULT') {
      setResult(response.payload)
      setState('result')
    } else if (response.type === 'ANALYSIS_ERROR') {
      setError(response.payload.message)
      setState('error')
    }
  }

  const activeSolution = result ? (tab === 'optimized' ? result.optimized : result.bruteForce) : null

  return (
    <div className={`fixed right-0 top-1/2 -translate-y-1/2 z-[9999] flex items-start transition-all duration-200 ${collapsed ? 'translate-x-[280px]' : ''}`}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="bg-indigo-600 text-white px-1.5 py-4 rounded-l-lg text-xs font-bold shadow-lg hover:bg-indigo-700 transition-colors writing-mode-vertical"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        title={collapsed ? '展开 LeetHelper' : '收起'}
      >
        {collapsed ? '▶ LeetHelper' : '◀'}
      </button>

      {/* Panel body */}
      <div className="w-72 bg-white border-l border-t border-b border-gray-200 shadow-xl rounded-l-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-3 py-2 flex items-center justify-between rounded-tl-lg">
          <span className="font-bold text-sm">⚡ LeetHelper</span>
          <span className="text-xs text-indigo-200 truncate max-w-[160px]" title={title}>{title}</span>
        </div>

        <div className="p-3">
          {state === 'idle' && (
            <button
              onClick={handleAnalyze}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              分析题目
            </button>
          )}

          {state === 'loading' && (
            <div className="text-center py-6 text-gray-500">
              <div className="text-2xl mb-2 animate-spin inline-block">⟳</div>
              <p className="text-sm">分析中，请稍候...</p>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
              <button
                onClick={() => setState('idle')}
                className="w-full border border-gray-200 text-gray-600 py-1.5 rounded-lg text-sm hover:bg-gray-50"
              >
                重试
              </button>
            </div>
          )}

          {state === 'result' && result && (
            <div className="space-y-3">
              {/* Explanation */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">题目解释</p>
                <p className="text-sm text-gray-700 leading-relaxed">{result.explanation}</p>
              </div>

              {/* Pattern tags */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">考点</p>
                <div className="flex flex-wrap gap-1">
                  {result.patterns.map(p => (
                    <span key={p} className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Solution tabs */}
              <div>
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => setTab('optimized')}
                    className={`flex-1 text-xs py-1 rounded font-medium border transition-colors ${
                      tab === 'optimized'
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    最优解
                  </button>
                  <button
                    onClick={() => setTab('brute')}
                    className={`flex-1 text-xs py-1 rounded font-medium border transition-colors ${
                      tab === 'brute'
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    暴力解
                  </button>
                </div>

                {activeSolution && (
                  <div className="space-y-2">
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span>时间 <strong className="text-gray-700">{activeSolution.timeComplexity}</strong></span>
                      <span>空间 <strong className="text-gray-700">{activeSolution.spaceComplexity}</strong></span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{activeSolution.explanation}</p>
                    <pre className="bg-gray-900 text-gray-100 text-xs p-2 rounded-lg overflow-x-auto leading-relaxed">
                      {activeSolution.code}
                    </pre>
                  </div>
                )}
              </div>

              {/* Re-analyze */}
              <button
                onClick={() => setState('idle')}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
              >
                重新分析
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test:run src/content/Panel.test.tsx
```

Expected: PASS — 6 tests pass

- [ ] **Step 6: Write src/content/index.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import Panel from './Panel'
import panelCSS from './panel.css?inline'
import { waitForProblemData } from './extractor'

function isProblemPage() {
  return /leetcode\.com\/problems\/[^/]+/.test(location.href)
}

function mountPanel() {
  // Remove any existing panel to avoid duplicates on SPA navigation
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

// Initial mount
mountPanel()

// Re-mount on SPA navigation (LeetCode is a React SPA — URL changes without full reload)
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    mountPanel()
  }
}).observe(document, { subtree: true, childList: true })
```

- [ ] **Step 7: Commit**

```bash
git add src/content/panel.css src/content/Panel.tsx src/content/Panel.test.tsx src/content/index.tsx
git commit -m "feat: add content script panel with analysis UI and Shadow DOM isolation"
```

---

## Task 6: Popup Settings UI

**Files:**
- Create: `src/popup/App.tsx`
- Create: `src/popup/App.test.tsx`

- [ ] **Step 1: Write failing popup tests**

Create `src/popup/App.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

const mockStore: Record<string, unknown> = {}

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((keys: string[]) => {
        const result: Record<string, unknown> = {}
        keys.forEach(k => { if (k in mockStore) result[k] = mockStore[k] })
        return Promise.resolve(result)
      }),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockStore, data)
        return Promise.resolve()
      }),
    },
  },
})

beforeEach(() => {
  Object.keys(mockStore).forEach(k => delete mockStore[k])
  vi.clearAllMocks()
})

describe('App (Popup)', () => {
  it('renders LeetHelper heading', async () => {
    render(<App />)
    expect(await screen.findByText(/LeetHelper/)).toBeInTheDocument()
  })

  it('shows "请填写 API Key" when no key is stored', async () => {
    render(<App />)
    expect(await screen.findByText(/请填写 API Key/)).toBeInTheDocument()
  })

  it('shows "已连接" when API key is present', async () => {
    mockStore.apiKey = 'sk-ant-test'
    render(<App />)
    expect(await screen.findByText(/已连接/)).toBeInTheDocument()
  })

  it('saves API key to chrome storage on input change', async () => {
    render(<App />)
    const input = await screen.findByPlaceholderText('sk-ant-...')
    fireEvent.change(input, { target: { value: 'sk-ant-newkey' } })
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ apiKey: 'sk-ant-newkey' })
    })
  })

  it('defaults to Java coding language', async () => {
    render(<App />)
    const javaButton = await screen.findByRole('button', { name: 'Java' })
    expect(javaButton).toHaveClass('bg-indigo-100')
  })

  it('saves coding language when a language button is clicked', async () => {
    render(<App />)
    const pythonButton = await screen.findByRole('button', { name: 'Python' })
    fireEvent.click(pythonButton)
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ codingLanguage: 'python' })
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test:run src/popup/App.test.tsx
```

Expected: FAIL — `Cannot find module './App'`

- [ ] **Step 3: Write src/popup/App.tsx**

```tsx
import React, { useEffect, useState } from 'react'
import type { StorageData, ApiProvider, CodingLanguage, AnalysisLanguage } from '../shared/types'
import { getStorage, setStorage } from '../shared/storage'

export default function App() {
  const [settings, setSettings] = useState<StorageData>({
    apiProvider: 'claude',
    apiKey: '',
    analysisLanguage: 'zh',
    codingLanguage: 'java',
  })
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => { getStorage().then(setSettings) }, [])

  async function update<K extends keyof StorageData>(key: K, value: StorageData[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    await setStorage({ [key]: value })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1200)
  }

  const hasKey = settings.apiKey.length > 0
  const placeholder = settings.apiProvider === 'claude' ? 'sk-ant-...' : 'sk-...'

  return (
    <div className="w-72 p-4 font-sans bg-white">
      <h1 className="text-base font-bold text-indigo-600 mb-4">⚡ LeetHelper</h1>

      {/* API Provider */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">AI 提供商</p>
        <div className="flex gap-2">
          {(['claude', 'openai'] as ApiProvider[]).map(p => (
            <button
              key={p}
              onClick={() => update('apiProvider', p)}
              className={`flex-1 py-1.5 rounded text-sm font-medium border transition-colors ${
                settings.apiProvider === p
                  ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                  : 'border-gray-200 text-gray-400 hover:bg-gray-50'
              }`}
            >
              {p === 'claude' ? 'Claude' : 'OpenAI'}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">API Key</p>
        <input
          type="password"
          value={settings.apiKey}
          onChange={e => update('apiKey', e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
        />
      </div>

      {/* Analysis Language */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">分析语言</p>
        <div className="flex gap-2">
          {(['zh', 'en'] as AnalysisLanguage[]).map(l => (
            <button
              key={l}
              onClick={() => update('analysisLanguage', l)}
              className={`flex-1 py-1.5 rounded text-sm font-medium border transition-colors ${
                settings.analysisLanguage === l
                  ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                  : 'border-gray-200 text-gray-400 hover:bg-gray-50'
              }`}
            >
              {l === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
      </div>

      {/* Coding Language */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">编程语言</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['java', 'Java'],
            ['python', 'Python'],
            ['cpp', 'C++'],
            ['javascript', 'JavaScript'],
          ] as [CodingLanguage, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => update('codingLanguage', val)}
              className={`py-1.5 rounded text-sm font-medium border transition-colors ${
                settings.codingLanguage === val
                  ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                  : 'border-gray-200 text-gray-400 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div
        className={`text-center text-xs py-2 rounded transition-colors ${
          savedFlash
            ? 'bg-green-50 text-green-600'
            : hasKey
            ? 'bg-green-50 text-green-600'
            : 'bg-red-50 text-red-500'
        }`}
      >
        {savedFlash ? '已保存 ✓' : hasKey ? '● 已连接，可以开始分析' : '● 请填写 API Key'}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test:run src/popup/App.test.tsx
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: PASS — all tests pass across all test files

- [ ] **Step 6: Commit**

```bash
git add src/popup/App.tsx src/popup/App.test.tsx
git commit -m "feat: add popup settings UI with API key management and language preferences"
```

---

## Task 7: Build, Manual Test, Icons, and Publish Prep

**Files:**
- Modify: `public/icons/` (replace placeholder PNGs with real ones)

- [ ] **Step 1: Build the extension**

```bash
npm run build
```

Expected: A `dist/` directory is created with no errors.

- [ ] **Step 2: Load the extension in Chrome**

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `dist/` folder inside `/Users/katy/projects/extensions`
5. LeetHelper should appear in the extension list with no errors

- [ ] **Step 3: Verify popup works**

1. Click the LeetHelper icon in Chrome's toolbar
2. Confirm the popup opens showing the settings UI
3. Enter your Claude API key (starts with `sk-ant-`)
4. Confirm the status changes to "已连接，可以开始分析"
5. Select Java as coding language, 中文 as analysis language

- [ ] **Step 4: Verify panel on LeetCode**

1. Navigate to `https://leetcode.com/problems/two-sum/`
2. Confirm the LeetHelper panel appears on the right side of the page
3. Click "分析题目"
4. Confirm loading state appears
5. Confirm the result shows:
   - A Chinese explanation of the Two Sum problem
   - Pattern tags (should include "哈希表" or similar)
   - An optimized Java solution with complexity info
6. Click "暴力解" tab — confirm brute force solution appears
7. Click the collapse button (◀) — confirm panel hides
8. Click again (▶ LeetHelper) — confirm panel reappears

- [ ] **Step 5: Verify SPA navigation**

1. While on the Two Sum problem page with the panel showing a result, click on a different problem in the sidebar
2. Confirm the URL changes to the new problem (e.g., `/problems/add-two-numbers/`)
3. Confirm the panel resets to idle state with the new problem's title
4. Click "分析题目" again — confirm it analyzes the new problem correctly

- [ ] **Step 6: Create real extension icons**

Run this Python script to generate clean colored icons:

```bash
python3 -c "
import struct, zlib

def make_colored_png(size, r, g, b):
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(c[4:]) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    row = b'\x00' + bytes([r, g, b] * size)
    idat = zlib.compress(row * size)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

for s in [16, 48, 128]:
    with open(f'public/icons/icon{s}.png', 'wb') as f:
        f.write(make_colored_png(s, 79, 70, 229))  # Indigo #4f46e5
print('Icons updated')
"
```

> **Optional improvement:** Replace these with proper PNG icons using a tool like Figma, Canva, or https://icon.kitchen. A clear ⚡ lightning bolt on indigo background works well.

- [ ] **Step 7: Rebuild and reload**

```bash
npm run build
```

Then in Chrome: go to `chrome://extensions` → click the **↻ refresh** button on the LeetHelper card → verify the icon now shows indigo color in the toolbar.

- [ ] **Step 8: Add dist/ to .gitignore**

Edit `.gitignore` and add:
```
dist/
```

- [ ] **Step 9: Final commit**

```bash
git add public/icons/ .gitignore
git commit -m "feat: add extension icons and finalize MVP"
git push origin main
```

---

## All Tests Passing Verification

```bash
npm run test:run
```

Expected output:
```
✓ src/shared/storage.test.ts (5 tests)
✓ src/content/extractor.test.ts (6 tests)
✓ src/content/Panel.test.tsx (6 tests)
✓ src/popup/App.test.tsx (6 tests)

Test Files  4 passed (4)
Tests      23 passed (23)
```

---

## Troubleshooting

**Panel doesn't appear on LeetCode:**
LeetCode's DOM structure changes periodically. Open DevTools on a problem page and verify the selectors in `extractor.ts`:
- Right-click the problem title → Inspect → look for `data-cy="question-title"` or the closest stable parent
- Right-click the description → Inspect → look for `data-track-load="description_content"`
Update `src/content/extractor.ts` with the correct selectors, rebuild, and reload.

**"API key invalid" error:**
Make sure you're using a Claude API key (starts with `sk-ant-`), not an OpenAI key. Check the API key is active at console.anthropic.com.

**CRXJS hot reload not working in dev:**
Run `npm run dev` — CRXJS enables hot reload. In Chrome, go to `chrome://extensions` and load the `dist/` folder (Vite in CRXJS mode writes to `dist/` even in dev mode).
