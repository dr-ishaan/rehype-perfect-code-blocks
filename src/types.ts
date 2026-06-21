/**
 * rehype-perfect-code-blocks — shared types
 *
 * Inspired by rehype-pretty-code, VitePress, Docusaurus, and Expressive Code.
 */

// Permissive type for ShikiTransformer — runtime type-checking is done by Shiki.
// Using `unknown` avoids cross-package type identity issues when
// @shikijs/transformers and shiki bundle different copies of @shikijs/types.
export type ShikiTransformer = unknown;

export interface PerfectCodeOptions {
  /* ---------- Ornaments ---------- */
  /** Traffic-light dots on the left of the header bar. Default: true */
  decorations?: boolean;
  /** Uppercase language pill in the header. Default: true */
  showLanguage?: boolean;
  /**
   * Copy button — boolean, or an object for fine-grained control:
   *   - visibility: 'always' (default) | 'hover' — show only on figure hover
   *   - feedbackDuration: ms to show "copied!" state. Default 1600
   *   - copyIcon / successIcon: raw HTML string to override the default SVG
   *   - label: button label text (or null for icon-only)
   *   - doneLabel: label shown after successful copy
   */
  copyButton?:
    | boolean
    | {
        visibility?: 'always' | 'hover';
        feedbackDuration?: number;
        copyIcon?: string;
        successIcon?: string;
        label?: string | null;
        doneLabel?: string;
      };
  /** @deprecated Use `copyButton.label`. Label next to the copy icon. Default: 'copy' */
  copyButtonLabel?: string | null;
  /** @deprecated Use `copyButton.doneLabel`. Default: 'copied!' */
  copyButtonDoneLabel?: string;

  /* ---------- Structure ---------- */
  /** When to show line numbers. Default: 'auto' (shown when title is present) */
  lineNumbers?: 'always' | 'never' | 'auto';
  /** When to show the header bar. Default: 'auto' (shown when title/lang/copy present) */
  titleBar?: 'always' | 'never' | 'auto';
  /** Global default start line number. Default: 1 (can be overridden per-block via `ln{N}`) */
  lineNumbersStart?: number;

  /* ---------- Modes ---------- */
  /** Enable {1,3-5} line-highlight meta AND // [!code highlight] notation. Default: true */
  highlight?: boolean;
  /** Enable +/- diff line coloring AND // [!code ++] / [!code --] notation. Default: true */
  diff?: boolean;
  /**
   * Pattern 5 (selective adoption from expressive-code): Enable word-level diff
   * highlighting. When `diff` is also true and a code block contains adjacent
   * `+`/`-` diff lines, the plugin computes the per-word diff between the
   * removed and added lines and wraps changed words in `<mark class="pcb__word-diff--add">`
   * / `<mark class="pcb__word-diff--del">` elements. This makes it easy for
   * readers to see exactly what changed, not just which lines changed.
   *
   * Uses a simple LCS-based word diff algorithm (no external deps).
   * Default: false (opt-in; adds a small per-block cost when diff lines are present).
   */
  wordDiff?: boolean;
  /** Enable // [!code focus] notation. Default: true */
  focus?: boolean;
  /** Enable // [!code error] / [!code warning] notations. Default: true */
  errorLevels?: boolean;
  /** Default wrap mode. Default: false */
  wrap?: boolean;
  /** Auto-collapse blocks longer than N lines. null = never. Default: null */
  collapseAfter?: number | null;
  /**
   * Per-line collapsible sections.
   * Pass a meta string like `collapse="5-12,20-30"` to wrap matching line ranges
   * in `<details><summary>N collapsed lines</summary>...</details>`.
   * Style options: 'github' (default), 'collapsible-start', 'collapsible-end', 'collapsible-auto'.
   * Default: null (disabled).
   */
  collapseRanges?: string | null;
  /** Style for collapsible sections. Default: 'github'. */
  collapseStyle?: 'github' | 'collapsible-start' | 'collapsible-end' | 'collapsible-auto';
  /** Show visible whitespace (tabs/spaces). Default: false */
  showWhitespace?: false | 'all' | 'boundary' | 'trailing' | 'leading';
  /** Render vertical indent guides. false | true (default 2) | number (indent width). Default: false */
  indentGuides?: boolean | number;
  /** Show a caption below the block via `caption="..."` meta. Default: true */
  caption?: boolean;

  /* ---------- Engine ---------- */
  /**
   * - 'auto'        → post-process if Shiki already ran, else call Shiki directly
   * - 'shiki'       → always call Shiki (re-tokenizes raw blocks)
   * - 'passthrough' → never tokenize, just wrap existing <pre><code>
   * Default: 'auto'
   */
  engine?: 'auto' | 'shiki' | 'passthrough';
  /** Shiki options passed through when the plugin calls Shiki itself. */
  shiki?: {
    /**
     * Theme — string for single theme, { light, dark } for dual-theme via CSS vars,
     * or a Record<string, string> for multi-theme (3+ themes) support.
     * Multi-theme example: `{ light: 'github-light', dark: 'github-dark', dim: 'github-dark-dimmed' }`.
     */
    theme?: string | { light: string; dark: string } | Record<string, string>;
    /** Pre-loaded languages. Defaults to a sensible set; missing langs are lazy-loaded. */
    langs?: string[];
    /**
     * Regex engine: 'oniguruma' (default, requires WASM) | 'javascript' (pure JS, edge-safe).
     * The JavaScript engine is recommended for Cloudflare Workers / Vercel Edge / browser bundles.
     * Default: 'oniguruma'
     */
    regexEngine?: 'oniguruma' | 'javascript';
    /** Additional Shiki transformers to apply (see @shikijs/transformers). */
    transformers?: ShikiTransformer[];
    /**
     * Controls whether user-provided transformers run 'before' or 'after' the
     * auto-registered ones (default: 'after'). Use 'before' to give user
     * transformers first access to the code text.
     */
    transformerOrder?: 'before' | 'after';
    /** Override the highlighter factory (e.g. for custom TextMate grammars). */
    getHighlighter?: (opts: { themes: string[]; langs: string[] }) => Promise<unknown>;
    [key: string]: unknown;
  };
  /**
   * Strip Shiki's inline `style="background-color:..."` from <pre> so user CSS
   * via `--pcb-bg` fully owns the surface. Default: false (we own the bg).
   */
  keepBackground?: boolean;
  /**
   * Convert Shiki's inline `style="color:..."` on token spans into deduplicated
   * CSS classes (via `transformerStyleToClass`). Massive HTML payload reduction
   * for dual-theme blocks. Default: false (keep inline styles for simplicity).
   */
  styleToClass?: boolean;
  /**
   * Use `codeToHast` (direct HAST output) instead of `codeToHtml` + HTML-parse
   * round-trip. Faster + safer. Default: true.
   */
  useHastApi?: boolean;
  /**
   * Disable auto-registration of @shikijs/transformers. When true, ONLY the
   * transformers in `shiki.transformers` are applied. Default: false.
   * Useful for advanced users who want full manual control.
   */
  disableAutoTransformers?: boolean;
  /**
   * Strip all comments from the rendered code (// ..., # ..., /* ... *\/, <!-- ... -->).
   * Powered by @shikijs/transformers `transformerRemoveComments`. Default: false.
   */
  removeComments?: boolean;
  /**
   * Remove line breaks from the rendered code (joins all lines into one).
   * Powered by @shikijs/transformers `transformerRemoveLineBreaks`. Default: false.
   * Useful for compact inline-style code blocks.
   */
  removeLineBreaks?: boolean;
  /**
   * When `true`, treat {1,3-5} meta ranges as zero-indexed (line 0 is the first
   * line). When `false` (default), line numbers start at 1.
   */
  zeroIndexed?: boolean;
  /**
   * Programmatic per-line class assignment (Shiki's `transformerCompactLineOptions`).
   * Example: `[{ line: 1, classes: ['highlight'] }, { line: 3, classes: ['add'] }]`.
   * Default: [] (disabled).
   */
  lineOptions?: { line: number; classes?: string[]; attrs?: Record<string, string> }[];

  /* ---------- Inline comment notations (VitePress-style) ---------- */
  /**
   * Custom // [!code xxx] notations mapped to CSS classes. Default: {}.
   * Example: `{ 'my-marker': 'pcb__line--custom' }` lets users write
   * `// [!code my-marker]` to apply the class.
   */
  customNotations?: Record<string, string>;
  /**
   * Magic comments à la Docusaurus. Each entry defines a line/block marker.
   * Default:
   *   [
   *     { className: 'pcb__line--hl', line: 'highlight-next-line', block: { start: 'highlight-start', end: 'highlight-end' } },
   *   ]
   */
  magicComments?: MagicComment[];

  /* ---------- Inline code highlighting (rehype-pretty-code style) ---------- */
  /**
   * Highlight inline `code` blocks. Default: false.
   * - true / 'lang'  → parse `\`code{:lang}\`` suffix and tokenize via Shiki
   * - 'token'        → parse `\`code{:.token}\`` suffix and color by VS Code token
   * - false          → don't touch inline code (only style if `inline: true` is set elsewhere)
   */
  inlineCode?: boolean | 'lang' | 'token';
  /** Default language for inline code when no `{:lang}` suffix is present. */
  inlineDefaultLang?: string;
  /** Short aliases for VS Code tokens, e.g. `{ fn: 'entity.name.function' }`. */
  tokensMap?: Record<string, string>;

  /* ---------- Auto frame detection (Expressive Code style) ---------- */
  /**
   * Auto-switch to terminal preset for these languages. Default:
   * ['sh', 'bash', 'zsh', 'shell', 'console', 'powershell', 'bat', 'cmd', 'fish', 'ansi']
   */
  terminalLangs?: string[];
  /**
   * If the first line of code looks like a filename comment (e.g. `// my-file.ts`
   * or `# my-file.sh`), use it as the title and drop it from the rendered code.
   * Default: false.
   */
  extractFileNameFromCode?: boolean;
  /**
   * Map language identifiers to display labels in the header badge.
   * Example: `{ ts: 'TypeScript', js: 'JavaScript', sh: 'Shell' }`.
   * Default: {} (uses the raw language identifier).
   */
  languageLabels?: Record<string, string>;
  /**
   * Map language aliases to canonical Shiki language IDs for tokenization.
   * Example: `{ ts: 'typescript', js: 'javascript', sh: 'bash' }`.
   * Default: {} (passes the language identifier as-is to Shiki).
   */
  languageAliases?: Record<string, string>;
  /**
   * Default language for fenced blocks when none is specified.
   * Example: 'typescript'. Default: '' (no default, falls back to plaintext).
   */
  defaultBlockLang?: string;
  /**
   * Default language for inline code when no `{:lang}` suffix is present.
   * (Renamed from `inlineDefaultLang` for clarity; old name still works.)
   */
  defaultInlineLang?: string;
  /**
   * Replace tabs with N spaces before tokenization. 0 disables (default).
   * Useful for languages where Shiki's tab rendering doesn't match the
   * surrounding code style.
   */
  tabWidth?: number;
  /**
   * Strip leading `#` comment lines from terminal code when copying to clipboard.
   * Default: true (only effective when preset === 'terminal').
   */
  copyStripComments?: boolean;

  /* ---------- Accessibility ---------- */
  /**
   * Add `role="region"`, `aria-label`, and `tabindex="0"` to scrollable code
   * blocks (WCAG 2.1.1 keyboard accessible, 4.1.2 name-role-value).
   * Default: true.
   */
  accessibleScroll?: boolean;
  /**
   * Announce "Copied!" to screen readers via an `aria-live="polite"` region
   * after a successful copy. Default: true.
   */
  announceCopy?: boolean;
  /**
   * Hide the copy button when JavaScript is disabled (graceful degradation).
   * Adds a `<noscript>` style that sets `.pcb__copy { display: none }`.
   * Default: true.
   */
  hideCopyWithoutJs?: boolean;
  /**
   * Add a screen-reader-only `<span class="pcb__sr-only">Terminal window</span>`
   * to terminal-preset blocks that have no title. Improves screen reader context.
   * Default: true.
   */
  terminalSrOnlyTitle?: boolean;

  /**
   * Additional rehype plugins to run BEFORE rehype-perfect-code-blocks.
   * Pass `rehypeRaw` here if your markdown contains raw HTML (`<details>`,
   * `<kbd>`, `<mark>`, etc.).
   * Example: `rehypePlugins: [rehypeRaw]`
   * Default: []
   */
  rehypePlugins?: unknown[];

  /* ---------- Hooks (rehype-pretty-code style) ---------- */
  /** Filter the raw meta string before parsing. Useful for plugin interop. */
  filterMetaString?: (meta: string) => string;
  /** Called for every line element after processing. */
  onVisitLine?: (line: { element: unknown; lineNumber: number }) => void;
  /** Called for every highlighted line. */
  onVisitHighlightedLine?: (line: { element: unknown; lineNumber: number; id?: string }) => void;
  /** Called for every highlighted char range. */
  onVisitHighlightedChars?: (chars: { element: unknown; text: string; id?: string }) => void;
  /** Called for the title element (if present). */
  onVisitTitle?: (element: unknown) => void;
  /** Called for the caption element (if present). */
  onVisitCaption?: (element: unknown) => void;

  /* ---------- i18n (internationalization) ---------- */
  /**
   * Localized UI strings. Defaults are English. Override per-locale by
   * passing a different `texts` object based on the current language.
   */
  texts?: {
    /** Copy button label (default: 'copy'). */
    copyLabel?: string;
    /** Label shown after successful copy (default: 'copied!'). */
    doneLabel?: string;
    /** Aria-label for the copy button (default: 'Copy code'). */
    copyAriaLabel?: string;
    /** Screen-reader-only title for terminal-preset blocks (default: 'Terminal window'). */
    terminalSrOnlyTitle?: string;
    /** aria-label prefix for scrollable body (default: 'Code block'). */
    codeBlockAriaPrefix?: string;
    /** Summary text for collapsed sections, with `{n}` placeholder (default: '{n} collapsed lines'). */
    collapsedLinesLabel?: (n: number) => string;
  };

  /* ---------- Logging ---------- */
  /**
   * Custom logger. Defaults to `console`. Useful for silencing warnings in
   * production or routing them to a structured logger.
   */
  logger?: { warn: (msg: string) => void; error: (msg: string) => void };

  /* ---------- CSP (Content Security Policy) ---------- */
  /**
   * Nonce to add to injected `<script>` and `<style>` tags. Enables strict CSP
   * (`script-src 'self' 'nonce-...'`). Default: undefined (no nonce).
   */
  cspNonce?: string;

  /* ---------- Styling ---------- */
  /** Visual preset. Default: 'default' */
  preset?: 'default' | 'terminal' | 'minimal';
  /** Inject the bundled CSS automatically. Set false to ship your own. Default: true */
  injectStyles?: boolean;
  /** Manual theme override. Default: 'auto' (prefers-color-scheme) */
  theme?: 'auto' | 'dark' | 'light';

  /* ---------- v2.0.0: CSS Architecture ---------- */

  /**
   * CSS injection strategy. Controls how the plugin's stylesheet is delivered.
   *
   * - `'inline'` (default) — injects the full CSS in a `<style>` tag on every page.
   *   Simple, works everywhere, but the CSS is unlayered (can be overridden by
   *   framework resets on cascade ties).
   *
   * - `'layer'` — injects the CSS wrapped in `@layer <cssLayer> { ... }`.
   *   On sites using cascade layers (Tailwind v3+, daisyUI, etc.), this ensures
   *   the plugin's CSS sits in the correct layer and framework resets don't
   *   win on specificity ties. Requires `cssLayer` to be set.
   *
   * - `'import'` — does NOT inject CSS. The user imports it manually:
   *   `import '@dr-ishaan/rehype-perfect-code-blocks/styles.css'`
   *   Useful for sites that want full control over CSS loading (e.g., bundling
   *   with PostCSS, or importing into a specific `@layer` in their own CSS).
   *
   * Default: `'inline'` (backward-compatible with v1.x).
   */
  cssInjection?: 'inline' | 'layer' | 'import';

  /**
   * The cascade layer name to use when `cssInjection: 'layer'`.
   * The plugin's CSS will be wrapped in `@layer <cssLayer> { ... }`.
   *
   * Example: `cssLayer: 'components'` → all plugin CSS goes into
   * `@layer components { ... }`, which the user can order above
   * `@layer base` (framework resets) in their CSS:
   *
   * ```css
   * @layer base, components, utilities;
   * ```
   *
   * Default: `'pcb'`
   */
  cssLayer?: string;

  /**
   * Design-token bridge — provide 5 core values and the plugin auto-derives
   * all 20+ `--pcb-*` variables. This is a shortcut for mapping the plugin
   * to an external design system (Tailwind theme, daisyUI theme, CSS custom
   * properties, etc.) without manually overriding every variable.
   *
   * Each value can be a CSS value string (e.g., `'#1a1b26'`) or a
   * `var(--your-var)` reference.
   *
   * When set, the plugin generates a `<style>` block with the derived
   * `--pcb-*` variables applied to `:where(.pcb)` (zero specificity, so
   * user CSS still wins). If a specific `--pcb-*` variable is ALSO set
   * in user CSS, the user's value wins (the token bridge is a default,
   * not an override).
   *
   * Example:
   * ```js
   * perfectCode({
   *   tokens: {
   *     bg: 'var(--bg-subtle)',
   *     fg: 'var(--ink)',
   *     border: 'var(--rule)',
   *     radius: 'var(--radius-card)',
   *     monoFont: 'var(--font-mono)',
   *   },
   * })
   * ```
   *
   * The plugin auto-derives:
   * - `--pcb-bg` = `bg`
   * - `--pcb-fg` = `fg`
   * - `--pcb-border` = `border`
   * - `--pcb-radius` = `radius`
   * - `--pcb-font-mono` = `monoFont`
   * - `--pcb-ln-fg` = `color-mix(in oklch, fg, bg 50%)` (muted line numbers)
   * - `--pcb-bg-header` = `color-mix(in oklch, fg 5%, bg)` (header slightly different)
   * - `--pcb-text-bar` = `color-mix(in oklch, fg, bg 30%)` (header text muted)
   * - `--pcb-line-highlight` = `color-mix(in oklch, fg 12%, bg)` (subtle highlight)
   * - `--pcb-line-add` = `color-mix(in oklch, #2ea043 18%, bg)` (diff add)
   * - `--pcb-line-del` = `color-mix(in oklch, #f85149 18%, bg)` (diff del)
   * - `--pcb-line-focus` = `color-mix(in oklch, #58a6ff 18%, bg)` (focus)
   * - `--pcb-copy-bg` (hover) = `color-mix(in oklch, fg 8%, bg)`
   *
   * Uses `color-mix(in oklch, ...)` which is supported in all modern browsers
   * (Chrome 111+, Safari 16.4+, Firefox 113+). For older browsers, the
   * fallback values from the Shiki theme (Pattern 2, v1.3.0) still apply.
   *
   * Default: `undefined` (no token bridge; use the plugin's built-in defaults)
   */
  tokens?: {
    /** Background color of the code block surface. */
    bg?: string;
    /** Foreground (text) color of the code. */
    fg?: string;
    /** Border color of the code block frame. */
    border?: string;
    /** Border radius of the code block. */
    radius?: string;
    /** Monospace font family for code text. */
    monoFont?: string;
  };

  /**
   * Dark mode strategy — controls how the plugin switches between light
   * and dark themes.
   *
   * - `'media'` (default) — uses `@media (prefers-color-scheme: dark)`.
   *   Automatic, no configuration needed. Same as v1.x behavior.
   *
   * - `'attribute'` — switches based on an attribute on `<html>`.
   *   Requires `darkMode.attribute` and `darkMode.attributeValue`.
   *   Example: `darkMode: { strategy: 'attribute', attribute: 'data-theme', attributeValue: 'dark' }`
   *   → CSS: `html[data-theme="dark"] .pcb { ... }`
   *
   * - `'class'` — switches based on a class on `<html>`.
   *   Requires `darkMode.class`.
   *   Example: `darkMode: { strategy: 'class', class: 'dark' }`
   *   → CSS: `html.dark .pcb { ... }`
   *
   * - `'custom'` — uses a custom CSS selector.
   *   Requires `darkMode.customSelector`.
   *   Example: `darkMode: { strategy: 'custom', customSelector: ':root[data-mode="night"]' }`
   *   → CSS: `:root[data-mode="night"] .pcb { ... }`
   *
   * When using Shiki dual themes (`shiki.theme: { light, dark }`), the
   * Shiki token CSS variables (`--shiki-light` / `--shiki-dark`) are also
   * switched using the same strategy, not just `prefers-color-scheme`.
   *
   * Default: `'media'` (backward-compatible with v1.x)
   */
  darkMode?: {
    strategy: 'media' | 'attribute' | 'class' | 'custom';
    /** For `strategy: 'attribute'` — the attribute name on `<html>`. Default: `'data-theme'` */
    attribute?: string;
    /** For `strategy: 'attribute'` — the attribute value that triggers dark mode. Default: `'dark'` */
    attributeValue?: string;
    /** For `strategy: 'class'` — the class name on `<html>` that triggers dark mode. Default: `'dark'` */
    class?: string;
    /** For `strategy: 'custom'` — the full CSS selector that triggers dark mode. */
    customSelector?: string;
  };

  /**
   * CSS containment scope — prefix all generated CSS selectors with this
   * string. Useful when code blocks appear in specific contexts (e.g., only
   * inside `.prose` or `article`) and you don't want the plugin's CSS to
   * affect code blocks elsewhere on the page.
   *
   * Example: `scope: '.prose'` → all selectors become `.prose .pcb { ... }`,
   * `.prose .pcb__header { ... }`, etc.
   *
   * The scope is applied to ALL generated CSS, including the framework-reset
   * overrides and the dark-mode selectors.
   *
   * Default: `undefined` (no scoping; CSS applies everywhere)
   */
  scope?: string;

  /* ---------- Inline code (legacy cosmetic option) ---------- */
  /** Also style inline `code` cosmetically (no tokenization). Default: false */
  inline?: boolean;
}

export interface MagicComment {
  /** CSS class to add to the marked line(s). */
  className: string;
  /** Line marker — marks the next line. */
  line?: string;
  /** Block markers — mark every line between start and end (inclusive). */
  block?: { start: string; end: string };
}

/** Parsed fenced-code meta, e.g. ```ts title="x.ts" {1,3-5} ln{5} /foo/ noLang wrap */
export interface ParsedMeta {
  language: string | null;
  title: string | null;
  caption: string | null;
  highlight: number[];                     // line numbers from {1,3-5}
  highlightGroups: { lines: number[]; id?: string }[];  // {1,2}#a {3,4}#b
  wordHighlights: { text: string; range?: [number, number]; id?: string }[];
  lineNumbersStart: number | null;         // from ln{N} or showLineNumbers{N}
  collapseRanges: { from: number; to: number }[];  // from collapse="5-12,20-30"
  flags: {
    wrap: boolean | null;
    lineNumbers: boolean | null;
    titleBar: boolean | null;
    decorations: boolean | null;
    showLanguage: boolean | null;
    copyButton: boolean | null;
    collapse: boolean | null;
  };
}

export type ResolvedBlock = {
  language: string | null;
  title: string | null;
  caption: string | null;
  highlight: number[];
  wrap: boolean;
  lineNumbers: boolean;
  lineNumbersStart: number;
  titleBar: boolean;
  decorations: boolean;
  showLanguage: boolean;
  copyButton: boolean;
  collapse: boolean;
};
