// jest-dom matchers (toHaveTextContent, toBeInTheDocument) without the extra dependency:
// small local implementations used by the UI tests.
expect.extend({
  toHaveTextContent(received: Element, expected: string) {
    const text = received.textContent ?? '';
    const pass = text.includes(expected);
    return { pass, message: () => `expected "${text}" ${pass ? 'not ' : ''}to contain "${expected}"` };
  },
  toBeInTheDocument(received: Element | null) {
    const pass = !!received && received.ownerDocument.contains(received);
    return { pass, message: () => `expected element ${pass ? 'not ' : ''}to be in the document` };
  },
});

// jsdom does not implement window.scrollTo; make it a harmless stub the tests can spy on.
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true, configurable: true });
