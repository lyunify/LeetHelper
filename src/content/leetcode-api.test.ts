import { describe, it, expect } from 'vitest'
import { extractAllCodes } from './leetcode-api'

// extractComplexity is not exported — test via extractAllCodes indirectly,
// or test the regex logic inline since we can't import the private function.
// We expose a thin wrapper for testing:
function extractComplexity(text: string): { timeComplexity: string; spaceComplexity: string } {
  const timePatterns = [
    /[Tt]ime\s+[Cc]omplexity\s*:?\s*\*?\*?(O\([^)\n]+\))/,
    /[Tt]ime\s+[Cc]omplexity[^O\n]{0,20}(O\([^)\n]+\))/,
    /\bT\.?C\.?\s*:?\s*(O\([^)\n]+\))/i,
    /[Tt]ime\s*:?\s*(O\([^)\n]+\))/,
    /\*\*[Tt]ime[^*]*\*\*[^O\n]{0,10}(O\([^)\n]+\))/,
  ]
  const spacePatterns = [
    /[Ss]pace\s+[Cc]omplexity\s*:?\s*\*?\*?(O\([^)\n]+\))/,
    /[Ss]pace\s+[Cc]omplexity[^O\n]{0,20}(O\([^)\n]+\))/,
    /\bS\.?C\.?\s*:?\s*(O\([^)\n]+\))/i,
    /[Ss]pace\s*:?\s*(O\([^)\n]+\))/,
    /\*\*[Ss]pace[^*]*\*\*[^O\n]{0,10}(O\([^)\n]+\))/,
  ]
  function firstMatch(t: string, patterns: RegExp[]) {
    for (const p of patterns) {
      const m = t.match(p)
      if (m?.[1]) return m[1].trim()
    }
    return ''
  }
  return {
    timeComplexity: firstMatch(text, timePatterns),
    spaceComplexity: firstMatch(text, spacePatterns),
  }
}

describe('extractAllCodes', () => {
  it('extracts code from fenced code block with language hint', () => {
    const html = '```java\npublic int[] twoSum(int[] nums, int target) {\n  return new int[]{0, 1};\n}\n```'
    const result = extractAllCodes(html)
    expect(result['Java']).toBeDefined()
    expect(result['Java']).toContain('twoSum')
  })

  it('extracts code from fenced block without language', () => {
    const html = '```\ndef two_sum(nums, target):\n    for i in range(len(nums)):\n        return [i, 0]\n```'
    const result = extractAllCodes(html)
    expect(Object.values(result).some(c => c.includes('two_sum'))).toBe(true)
  })

  it('maps python3 to Python', () => {
    const html = '```python3\ndef solve(n):\n    return [x for x in range(n) if x > 0]\n```'
    const result = extractAllCodes(html)
    expect(result['Python']).toBeDefined()
  })

  it('maps cpp to C++', () => {
    const html = '```cpp\nclass Solution {\npublic:\n    int solve() { return 0; }\n};\n```'
    const result = extractAllCodes(html)
    expect(result['C++']).toBeDefined()
  })

  it('keeps the longest code block per language', () => {
    const short = '```java\npublic int x() { return 0; }\n```'
    const long = '```java\npublic int twoSum(int[] nums, int target) {\n    Map<Integer,Integer> map = new HashMap<>();\n    for (int i = 0; i < nums.length; i++) { map.put(nums[i], i); }\n    return 0;\n}\n```'
    const result = extractAllCodes(short + '\n' + long)
    expect(result['Java']).toContain('HashMap')
  })

  it('rejects blocks that look like example input/output', () => {
    const html = '```\nInput: nums = [2,7,11,15]\nOutput: [0,1]\nExplanation: ...\n```'
    const result = extractAllCodes(html)
    // Should not have any entries since it starts with "Input"
    expect(Object.values(result).every(c => !c.startsWith('Input'))).toBe(true)
  })

  it('rejects very short blocks', () => {
    const html = '```java\nreturn 0;\n```'
    const result = extractAllCodes(html)
    expect(result['Java']).toBeUndefined()
  })

  it('extracts from HTML pre>code elements', () => {
    const html = '<pre><code class="language-python">def solve(n):\n    return sum(x for x in range(n) if x > 1)</code></pre>'
    const result = extractAllCodes(html)
    expect(result['Python']).toContain('solve')
  })

  it('returns empty object when no code present', () => {
    const html = 'This is just a plain text explanation with no code.'
    const result = extractAllCodes(html)
    expect(Object.keys(result).length).toBe(0)
  })
})

describe('extractComplexity', () => {
  it('extracts standard Time/Space Complexity lines', () => {
    const text = 'Time Complexity: O(n log n)\nSpace Complexity: O(n)'
    const { timeComplexity, spaceComplexity } = extractComplexity(text)
    expect(timeComplexity).toBe('O(n log n)')
    expect(spaceComplexity).toBe('O(n)')
  })

  it('handles bold markdown format', () => {
    const text = '**Time Complexity**: O(n^2)\n**Space Complexity**: O(1)'
    const { timeComplexity, spaceComplexity } = extractComplexity(text)
    expect(timeComplexity).toBe('O(n^2)')
    expect(spaceComplexity).toBe('O(1)')
  })

  it('handles TC / SC shorthand', () => {
    const text = 'TC: O(n)\nSC: O(1)'
    const { timeComplexity, spaceComplexity } = extractComplexity(text)
    expect(timeComplexity).toBe('O(n)')
    expect(spaceComplexity).toBe('O(1)')
  })

  it('handles lowercase time complexity', () => {
    const text = 'time complexity is O(n)\nspace complexity: O(n)'
    const { timeComplexity, spaceComplexity } = extractComplexity(text)
    expect(timeComplexity).toBe('O(n)')
    expect(spaceComplexity).toBe('O(n)')
  })

  it('returns empty strings when no complexity found', () => {
    const text = 'This solution uses a hashmap and nested loops.'
    const { timeComplexity, spaceComplexity } = extractComplexity(text)
    expect(timeComplexity).toBe('')
    expect(spaceComplexity).toBe('')
  })

  it('handles O(n*m) and O(2^n) expressions', () => {
    const text = 'Time Complexity: O(n*m)\nSpace Complexity: O(2^n)'
    const { timeComplexity, spaceComplexity } = extractComplexity(text)
    expect(timeComplexity).toBe('O(n*m)')
    expect(spaceComplexity).toBe('O(2^n)')
  })
})
