/**
 * Math/LaTeX rendering via KaTeX (v2.1.0).
 *
 * Renders LaTeX at build time (server-side) — no client-side JS needed.
 * `katex` is an optional peer dependency: if not installed, the plugin
 * falls back to rendering the LaTeX source as plain text in a styled
 * container.
 *
 * Supports:
 *   - Inline math: `$...$` in text nodes (via a remark plugin)
 *   - Block math: `$$...$$` blocks
 *   - Fenced code blocks with language `math`, `latex`, or `tex`
 */

export interface MathOptions {
  engine?: 'katex' | 'none';
  inline?: boolean;
  block?: boolean;
  injectCss?: boolean;
  throwOnError?: boolean;
  strict?: boolean | 'ignore' | 'error' | 'warn';
}

export interface ResolvedMathOptions {
  engine: 'katex' | 'none';
  inline: boolean;
  block: boolean;
  injectCss: boolean;
  throwOnError: boolean;
  strict: boolean | 'ignore' | 'error' | 'warn';
}

export function resolveMathOptions(math?: MathOptions): ResolvedMathOptions {
  return {
    engine: math?.engine ?? 'none',
    inline: math?.inline ?? true,
    block: math?.block ?? true,
    injectCss: math?.injectCss ?? true,
    throwOnError: math?.throwOnError ?? true,
    strict: math?.strict ?? false,
  };
}

/** Languages that should be rendered as math instead of syntax-highlighted. */
export const MATH_LANGS = new Set(['math', 'latex', 'tex']);

/** Cache for the dynamically-imported katex module. */
let _katexModule: typeof import('katex') | null | undefined;

/**
 * Try to load the katex module. Returns null if katex is not installed.
 * Caches the result so subsequent calls don't re-import.
 */
async function getKatex(): Promise<typeof import('katex') | null> {
  if (_katexModule !== undefined) return _katexModule;
  try {
    _katexModule = await import('katex');
    return _katexModule;
  } catch {
    _katexModule = null;
    return null;
  }
}

/**
 * Check if a language identifier should be treated as math.
 */
export function isMathLanguage(lang: string): boolean {
  return MATH_LANGS.has(lang.toLowerCase());
}

/**
 * Render a LaTeX string to HTML via KaTeX.
 *
 * @param latex The LaTeX source string
 * @param displayMode true for block math ($$...$$), false for inline ($...$)
 * @param options Resolved math options
 * @returns { html: string, isKatex: boolean } — if katex is available,
 *   html is the KaTeX-rendered HTML; otherwise it's the LaTeX source in a
 *   `<code>` element, and isKatex is false.
 */
export async function renderMath(
  latex: string,
  displayMode: boolean,
  options: ResolvedMathOptions
): Promise<{ html: string; isKatex: boolean }> {
  if (options.engine === 'none') {
    return { html: escapeHtml(latex), isKatex: false };
  }

  const katex = await getKatex();
  if (!katex) {
    // KaTeX not installed — fall back to plain text
    return { html: escapeHtml(latex), isKatex: false };
  }

  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: options.throwOnError,
      strict: options.strict,
      output: 'html',
    });
    return { html, isKatex: true };
  } catch {
    // KaTeX rendering failed — fall back to plain text
    return { html: escapeHtml(latex), isKatex: false };
  }
}

/**
 * Escape HTML special characters in a string (for the fallback path).
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Regex to find inline `$...$` math in text.
 * Matches `$` followed by non-$ content followed by `$`.
 * Does NOT match `$$` (which is block math) or escaped `\$`.
 *
 * Examples:
 *   "$x^2$" → match (inline math)
 *   "$$x^2$$" → NO match (block math)
 *   "cost is \$5" → NO match (escaped dollar sign)
 *   "a $ b $ c" → match "$ b $" (ambiguous, but we match it)
 */
export const INLINE_MATH_REGEX = /(^|[^\\$])\$(?!\$)([^$]+?)\$(?!\$)/g;

/**
 * Regex to find block `$$...$$` math in text.
 * Matches `$$` followed by content followed by `$$`.
 */
export const BLOCK_MATH_REGEX = /\$\$([\s\S]+?)\$\$/g;

/**
 * Process a text string, replacing inline `$...$` and block `$$...$$`
 * with rendered math HTML.
 *
 * @param text The input text
 * @param options Resolved math options
 * @returns Array of { type: 'text' | 'inline-math' | 'block-math', content: string }
 *   segments. The caller is responsible for converting these to HAST nodes.
 */
export async function processMathInText(
  text: string,
  options: ResolvedMathOptions
): Promise<Array<{ type: 'text' | 'inline-math' | 'block-math'; content: string; html?: string }>> {
  if (options.engine === 'none' || (!options.inline && !options.block)) {
    return [{ type: 'text', content: text }];
  }

  const segments: Array<{ type: 'text' | 'inline-math' | 'block-math'; content: string; html?: string }> = [];
  let remaining = text;

  // First, extract block math ($$...$$)
  if (options.block) {
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const blockRegex = new RegExp(BLOCK_MATH_REGEX);
    while ((match = blockRegex.exec(remaining)) !== null) {
      // Text before the block math
      if (match.index > lastIndex) {
        const beforeText = remaining.slice(lastIndex, match.index);
        // Process inline math in the text before
        if (options.inline) {
          const inlineSegments = await processInlineMath(beforeText, options);
          segments.push(...inlineSegments);
        } else {
          segments.push({ type: 'text', content: beforeText });
        }
      }
      // The block math
      const latex = match[1].trim();
      const { html, isKatex } = await renderMath(latex, true, options);
      segments.push({ type: 'block-math', content: latex, html });
      lastIndex = match.index + match[0].length;
    }
    // Remaining text after the last block math
    if (lastIndex < remaining.length) {
      const afterText = remaining.slice(lastIndex);
      if (options.inline) {
        const inlineSegments = await processInlineMath(afterText, options);
        segments.push(...inlineSegments);
      } else {
        segments.push({ type: 'text', content: afterText });
      }
    }
  } else if (options.inline) {
    // Only inline math
    const inlineSegments = await processInlineMath(remaining, options);
    segments.push(...inlineSegments);
  } else {
    segments.push({ type: 'text', content: remaining });
  }

  return segments;
}

/**
 * Process inline `$...$` math in a text string.
 * Returns segments of text and inline-math.
 */
async function processInlineMath(
  text: string,
  options: ResolvedMathOptions
): Promise<Array<{ type: 'text' | 'inline-math'; content: string; html?: string }>> {
  const segments: Array<{ type: 'text' | 'inline-math'; content: string; html?: string }> = [];
  const regex = new RegExp(INLINE_MATH_REGEX);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match (including the prefix character)
    const prefix = match[1] || '';
    const matchStart = match.index + prefix.length;
    if (matchStart > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) + prefix });
    } else if (prefix) {
      segments.push({ type: 'text', content: prefix });
    }

    const latex = match[2].trim();
    const { html } = await renderMath(latex, false, options);
    segments.push({ type: 'inline-math', content: latex, html });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

/**
 * Get the KaTeX CSS path for injection.
 * Returns the path to `katex/dist/katex.min.css` relative to the project.
 */
export function getKatexCssPath(): string {
  return 'katex/dist/katex.min.css';
}

/**
 * Try to read the KaTeX CSS content from the filesystem.
 * Returns null if katex is not installed or the CSS file can't be read.
 */
export async function tryReadKatexCss(): Promise<string | null> {
  try {
    const katex = await getKatex();
    if (!katex) return null;
    // katex module path — try to read the CSS
    const { readFileSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const katexPath = require.resolve('katex');
    const katexDir = katexPath.replace(/[/\\]katex\.(mjs|js|cjs)$/, '');
    const cssPath = katexDir + '/katex.min.css';
    return readFileSync(cssPath, 'utf8');
  } catch {
    return null;
  }
}
