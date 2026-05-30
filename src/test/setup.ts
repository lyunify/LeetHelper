import '@testing-library/jest-dom'

// jsdom doesn't implement scrollTo — stub it so component useEffects don't throw
window.HTMLElement.prototype.scrollTo = () => {}
