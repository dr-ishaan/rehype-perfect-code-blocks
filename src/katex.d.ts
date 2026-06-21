/**
 * Minimal type declaration for katex (optional peer dependency).
 * When katex is installed, its own types take precedence.
 */
declare module 'katex' {
  export interface KatexOptions {
    displayMode?: boolean;
    throwOnError?: boolean;
    strict?: boolean | 'ignore' | 'error' | 'warn';
    output?: 'html' | 'mathml' | 'htmlAndMathml';
    [key: string]: unknown;
  }
  export function renderToString(latex: string, options?: KatexOptions): string;
  const _default: { renderToString: typeof renderToString };
  export default _default;
}
