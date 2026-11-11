import 'vitest';

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveTextContent(expected: string): T;
    toBeInTheDocument(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveTextContent(expected: string): unknown;
    toBeInTheDocument(): unknown;
  }
}
