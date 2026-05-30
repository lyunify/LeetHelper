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

export type SolutionSource = 'ai' | 'leetcode'

export interface FetchSolutionsRequest {
  titleSlug: string
  limit: number
}

export interface LeetCodeSolutionRaw {
  id: string
  title: string
  author: string
  voteCount: number
  code: string
  rawContent: string
}

export type ExtensionMessage =
  | { type: 'ANALYZE_PROBLEM'; payload: AnalysisRequest }
  | { type: 'ANALYSIS_RESULT'; payload: AnalysisResult }
  | { type: 'ANALYSIS_ERROR'; payload: { message: string } }
  | { type: 'FETCH_LEETCODE_SOLUTIONS'; payload: FetchSolutionsRequest }
  | { type: 'LEETCODE_SOLUTIONS_RESULT'; payload: LeetCodeSolutionRaw[] }
