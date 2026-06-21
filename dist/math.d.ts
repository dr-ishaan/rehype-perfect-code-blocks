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
export declare function resolveMathOptions(math?: MathOptions): ResolvedMathOptions;
/** Languages that should be rendered as math instead of syntax-highlighted. */
export declare const MATH_LANGS: Set<string>;
/**
 * Check if a language identifier should be treated as math.
 */
export declare function isMathLanguage(lang: string): boolean;
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
export declare function renderMath(latex: string, displayMode: boolean, options: ResolvedMathOptions): Promise<{
    html: string;
    isKatex: boolean;
}>;
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
export declare const INLINE_MATH_REGEX: RegExp;
/**
 * Regex to find block `$$...$$` math in text.
 * Matches `$$` followed by content followed by `$$`.
 */
export declare const BLOCK_MATH_REGEX: RegExp;
/**
 * Process a text string, replacing inline `$...$` and block `$$...$$`
 * with rendered math HTML.
 *
 * @param text The input text
 * @param options Resolved math options
 * @returns Array of { type: 'text' | 'inline-math' | 'block-math', content: string }
 *   segments. The caller is responsible for converting these to HAST nodes.
 */
export declare function processMathInText(text: string, options: ResolvedMathOptions): Promise<Array<{
    type: 'text' | 'inline-math' | 'block-math';
    content: string;
    html?: string;
}>>;
/**
 * Get the KaTeX CSS path for injection.
 * Returns the path to `katex/dist/katex.min.css` relative to the project.
 */
export declare function getKatexCssPath(): string;
/**
 * Try to read the KaTeX CSS content from the filesystem.
 * Returns null if katex is not installed or the CSS file can't be read.
 */
export declare function tryReadKatexCss(): Promise<string | null>;
//# sourceMappingURL=math.d.ts.map