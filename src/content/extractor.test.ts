import { describe, it, expect, beforeEach } from 'vitest'
import { extractProblemData } from './extractor'

beforeEach(() => { document.body.innerHTML = '' })

describe('extractProblemData', () => {
  it('returns null when page has no problem elements', () => {
    document.body.innerHTML = '<div>random content</div>'
    expect(extractProblemData()).toBeNull()
  })

  it('extracts title and description using data-cy selector', () => {
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
