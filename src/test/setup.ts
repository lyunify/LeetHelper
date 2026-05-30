import '@testing-library/jest-dom'

// jsdom doesn't implement scrollTo — stub it so component useEffects don't throw
window.HTMLElement.prototype.scrollTo = () => {}

// Ensure chrome.runtime.id is present so contextValid() returns true in all tests
if (typeof chrome !== 'undefined' && chrome.runtime) {
  Object.defineProperty(chrome.runtime, 'id', { value: 'test-extension-id', configurable: true })
}
