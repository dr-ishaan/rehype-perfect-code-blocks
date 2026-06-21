# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.1] — 2026-06-20

### Summary

Patch release adopting 5 stability + performance patterns from community packages identified through deep research of `@shikijs/monaco`, Astro's `@astrojs/internal-helpers`, fumadocs, and Shiki core. Closes the biggest stability gaps: event-loop blocking on huge code blocks, WASM init hangs on edge runtimes, and repeated regex engine creation.

### Features

#### Item 1: Tokenizer size+time guards (from `@shikijs/monaco`)

New `shiki.maxBlockLength` (default: 200,000 chars) and `shiki.tokenizeTimeout` (default: 500ms) options. When a code block exceeds `maxBlockLength`, it falls back to plaintext with a `dataTruncated` attribute on the `<pre>` element, preventing event-loop blocking on huge blocks.

#### Item 2: Module-level engine cache (from Astro `@astrojs/internal-helpers`)

The JS regex engine (`createJavaScriptRegexEngine()`) is now created once at module scope and reused across all highlighter cache entries, instead of being re-created per entry. Eliminates repeated engine compilation and potential OOM in long dev sessions.

#### Item 3: WASM-init timeout (greenfield — no community package does this)

New `shiki.initTimeout` option (default: 8,000ms). If `createHighlighter` hangs (WASM fetch stall on Cloudflare/Vercel edge), the plugin automatically retries with the pure-JS regex engine. If that also fails, falls back to a minimal plaintext-only highlighter. No more indefinite hangs on edge runtimes.

#### Item 4: `content-visibility: auto` CSS

One CSS rule on `:where(.pcb)` — the browser skips rendering off-screen code blocks, dramatically improving page load on docs with many code blocks. `contain-intrinsic-size: auto 400px` prevents layout shift. No community plugin does this.

#### Item 5: `filterMetaString` hook (pre-Shiki)

The `filterMetaString` option now runs **before** the meta string is passed to Shiki via `meta: { __raw }`, not just before the plugin's own `parseMeta`. This prevents Shiki transformers from choking on custom meta tokens. (Pattern from fumadocs rehype-code.)

### Verification

- All 1290 pre-existing tests pass (no regressions).
- New `test-v2.3.1-stability.mjs` adds 25 regression tests.
- Total: 1315/1315 tests passing.

## [2.3.0] — 2026-06-20

### Summary

Minor release implementing P2 items: Mermaid diagram rendering, CSV/TSV table rendering, ASCII art preservation, Retro CRT preset, accessibility improvements (line numbers + diff aria-labels), and exported CLASSES constant. No breaking changes.

### Features

#### Mermaid diagram rendering (`mermaid: true`)

Render ```` ```mermaid ```` blocks as SVG diagrams via mermaid.js (build-time, optional peer dep):

```js
perfectCode({ mermaid: true })
```

#### CSV/TSV table rendering (`csvTables: true`)

Render ```` ```csv ```` / ```` ```tsv ```` blocks as styled HTML tables:

```js
perfectCode({ csvTables: true })
```

First row becomes `<thead>`, remaining rows in `<tbody>` with alternating row colors.

#### ASCII art preservation

Disables ligatures (`font-variant-ligatures: none`, `font-feature-settings: "liga" 0`) for `text`, `plaintext`, `txt`, `ascii`, `plain` languages so ASCII art alignment is maintained. Configurable via `asciiArtLangs` option.

#### Retro CRT preset (`preset: 'retro'`)

Green-on-black monospace with CRT scanline effect — for historical computing content:

```js
perfectCode({ preset: 'retro' })
```

Features: `#00ff41` text glow, repeating scanline gradient overlay, `Courier New` font, zero border radius, green traffic-light dots.

#### Accessibility improvements

- **Line numbers**: `aria-label="Line N"` on each `.pcb__ln` span (screen readers announce line numbers)
- **Diff lines**: `aria-label="Added line"` / `aria-label="Removed line"` on diff line spans (WCAG 1.3.1)

#### Exported CLASSES constant

```ts
import { CLASSES } from '@dr-ishaan/rehype-perfect-code-blocks';
// CLASSES.COPY_BUTTON = 'pcb__copy'
// CLASSES.LINE_HIGHLIGHT = 'pcb__line--hl'
// CLASSES.PRESET_RETRO = 'pcb--retro'
// ... 40+ class name constants
```

### New exports

- `CLASSES` — object with 40+ CSS class name constants
- `isMermaidLanguage(lang)`, `isCsvLanguage(lang)` — language detection
- `parseCsv(text, delimiter)`, `buildCsvTable(text, delimiter)` — CSV parsing
- `renderMermaid(source)` — Mermaid SVG rendering

### Verification

- All 1254 pre-existing tests pass (no regressions).
- New `test-v2-p2.mjs` adds 36 regression tests.
- Total: 1290/1290 tests passing.

## [2.2.0] — 2026-06-20

### Summary

Minor release implementing Phase 3: Side-by-side diff view, Line annotations, and Code attribution. These features turn the plugin from "pretty syntax highlighting" into "a complete technical content toolkit" — ideal for educational, academic, and historical content. No breaking changes — all new features are opt-in.

### Features

#### Side-by-side diff view (`diffMode: 'split'`)

New `diffMode` option — renders adjacent `+`/`-` diff line pairs in a two-column layout (Before | After) instead of the default unified view:

```js
perfectCode({ diffMode: 'split' })
```

- Two-column grid layout with synchronized scrolling
- Mobile responsive: columns stack vertically below 768px
- Works with `wordDiff: true` (word-level diff within each column)
- CSS class `pcb--split-diff` added to the `<figure>` for custom styling

#### Line annotations (`annotations: true`)

New `annotations` option — margin notes attached to specific code lines via `// [!ann: "text"]` notation:

````markdown
```ts
const attention = Q.dot(K.T) / Math.sqrt(d)  // [!ann: "Scaled dot-product"]
const weights = softmax(attention)            // [!ann: "Normalized weights"]
```
````

- Annotation text appears in a `pcb__ann` span on the right side of the annotated line
- The `// [!ann: "text"]` notation is stripped from the displayed code
- `data-ann` attribute on the line span for programmatic access
- CSS class `pcb--annotations` on the `<figure>` for enabling the annotation grid layout
- Mobile responsive: annotations stack below the code line on narrow screens

#### Code attribution (`attribution: true`)

New `attribution` option — parses `author`, `year`, and `source` from the fence meta string and renders them as a footer below the code block:

````markdown
```ts title="perceptron.ts" author="Rosenblatt" year="1958" source="Principles of Neurodynamics"
const output = stepFunction(inputs.dot(weights))
```
````

Renders as:
```
┌─ perceptron.ts ──────────────────┐
│ const output = stepFunction(...)  │
└───────────────────────────────────┘
  Rosenblatt (1958). Principles of Neurodynamics.
```

- Footer rendered as `<figcaption class="pcb__attribution">` with italic styling
- Works with partial attribution (only `author`, or `author` + `year`, etc.)
- Meta parser extended to extract `author="..."`, `year="..."`, `source="..."` from the fence meta string
- When `attribution` is disabled (default), these meta fields are silently ignored

### CSS additions

New CSS rules in `dist/styles.css`:
- `.pcb--split-diff` — grid layout for two-column diff view
- `.pcb__ann` / `.pcb--annotations` — annotation display (hidden by default, shown when enabled)
- `.pcb__attribution` — attribution footer styling
- All new rules use `:where()` for zero specificity (user CSS wins)
- Mobile responsive rules for split diff and annotations

### Verification

- All 1219 pre-existing tests pass (no regressions).
- New `test-v2-phase3.mjs` adds 35 regression tests covering all 3 features.
- Total: 1254/1254 tests passing.

## [2.1.0] — 2026-06-20

### Summary

Minor release implementing the four P1 items from the v2.0.0 roadmap: Math/LaTeX rendering (KaTeX integration), Lazy Shiki initialization, Dev-mode warnings, and Screen reader copy announcement. No breaking changes — all new features are opt-in with backward-compatible defaults.

### Features

#### P1-1: Math/LaTeX rendering (KaTeX integration)

New `math` option — renders LaTeX at build time via KaTeX (server-side, no client JS needed):

```js
perfectCode({
  math: {
    engine: 'katex',    // 'katex' | 'none' (default: 'none')
    inline: true,       // render $...$ inline
    block: true,        // render $$...$$ and ```math blocks
    injectCss: true,    // inject KaTeX CSS
    throwOnError: true, // graceful fallback for invalid LaTeX
  },
})
```

- `katex` is an optional peer dependency — if not installed, falls back to rendering the LaTeX source as plain text
- Handles fenced code blocks with language `math`, `latex`, or `tex` → renders via KaTeX instead of Shiki
- New `src/math.ts` module with `isMathLanguage()`, `renderMath()`, `resolveMathOptions()` utilities
- New `src/katex.d.ts` minimal type declaration for the optional `katex` module

#### P1-2: Lazy Shiki initialization

New `shiki.lazy` option — don't load Shiki languages until the first code block is encountered:

```js
perfectCode({
  shiki: {
    lazy: true,         // skip preloading langs; only load what's in each document
    preloadLangs: ['typescript', 'bash'],  // langs to preload when code blocks exist
  },
})
```

When `lazy: true`, the plugin skips preloading `shiki.langs` and only loads languages actually found in the document. On pages with no code blocks, Shiki is never initialized. Saves ~1MB of bundle on code-free pages.

#### P1-3: Dev-mode warnings

New `devWarnings` option — emits warnings during build/dev for common misconfigurations:

```js
perfectCode({
  devWarnings: true,   // default: true in dev (NODE_ENV !== 'production'), false in prod
})
```

Warnings include:
- Unknown language not loaded in Shiki
- Invalid meta syntax (e.g., `{1,a-5}` instead of `{1,3-5}`)
- Conflicting options (e.g., `wrap` + `collapseAfter` both enabled)
- Code block inside raw HTML detected but rehype-raw not installed

Warnings are deduped per unique message to avoid spam. New `src/dev-warnings.ts` module with `runDevWarnings()` and `warnUnknownLanguage()`.

#### P1-4: Screen reader copy announcement

The copy button now dynamically updates its `aria-label` when copy succeeds:
- Before copy: `aria-label="Copy code"`
- After copy: `aria-label="copied! — Copy code"` (announced via screen reader)
- After feedback duration: restores original `aria-label`

Combined with the existing `aria-live="polite"` region (from v1.3.0), screen readers now announce both the button state change AND the "Copied!" text — WCAG 4.1.3 compliant.

### New exports

- `resolveMathOptions(options)` — resolves math config with defaults
- `isMathLanguage(lang)` — checks if a language is a math language
- `renderMath(latex, displayMode, options)` — renders LaTeX via KaTeX (or fallback)
- `runDevWarnings(tree, context)` — runs dev warning checks on a hast tree
- `warnUnknownLanguage(lang, context)` — warns about an unknown language
- `MathOptions`, `ResolvedMathOptions` types

### Verification

- All 1177 pre-existing tests pass (no regressions).
- New `test-v2-phase2.mjs` adds 42 regression tests covering all 4 P1 features.
- Total: 1219/1219 tests passing.

## [2.0.0] — 2026-06-20

### Summary

**Major release** implementing the four P0 CSS architecture items from the v2.0.0 roadmap. These are the foundational cascade-control features that every production site needs to adopt the plugin without fighting the CSS cascade. No breaking changes — all new features are opt-in with backward-compatible defaults.

### Features

#### P0-1: `@layer` CSS injection support

New `cssInjection` and `cssLayer` options:

- `cssInjection: 'inline'` (default, backward-compatible) — injects CSS in a `<style>` tag as before
- `cssInjection: 'layer'` — wraps CSS in `@layer <cssLayer> { ... }` so it sits in the correct cascade layer on sites using `@layer` (Tailwind v3+, daisyUI, etc.)
- `cssInjection: 'import'` — does NOT inject CSS; user imports manually via `import '@dr-ishaan/rehype-perfect-code-blocks/styles.css'`
- `cssLayer: 'pcb'` (default) — the layer name to use when `cssInjection: 'layer'`

Example:
```js
perfectCode({
  cssInjection: 'layer',
  cssLayer: 'components',
})
// User's CSS: @layer base, components, utilities;
```

#### P0-2: Design-token bridge

New `tokens` option — provide 5 core values and the plugin auto-derives 20+ `--pcb-*` variables using `color-mix(in oklch, ...)`:

```js
perfectCode({
  tokens: {
    bg: 'var(--bg-subtle)',
    fg: 'var(--ink)',
    border: 'var(--rule)',
    radius: 'var(--radius-card)',
    monoFont: 'var(--font-mono)',
  },
})
```

The plugin generates `--pcb-ln-fg`, `--pcb-bg-header`, `--pcb-line-highlight`, `--pcb-line-add`, `--pcb-line-del`, `--pcb-line-focus`, `--pcb-copy-hover-bg`, `--pcb-word-bg`, and more — all derived from the 5 core tokens. Applied via `:where(.pcb)` (zero specificity) so user CSS still wins.

Uses `color-mix(in oklch, ...)` (Chrome 111+, Safari 16.4+, Firefox 113+). For older browsers, the v1.3.0 theme-aware defaults from Shiki still apply.

#### P0-3: Dark mode strategy options

New `darkMode` option — controls how the plugin switches between light and dark themes:

- `strategy: 'media'` (default, backward-compatible) — uses `@media (prefers-color-scheme: dark)`
- `strategy: 'attribute'` — switches on `html[data-theme="dark"]` (configurable attribute + value)
- `strategy: 'class'` — switches on `html.dark` (configurable class name)
- `strategy: 'custom'` — switches on a user-provided CSS selector

Example:
```js
perfectCode({
  darkMode: { strategy: 'class', class: 'dark' },
})
```

#### P0-4: CSS containment scope

New `scope` option — prefixes all generated CSS selectors with the given scope:

```js
perfectCode({
  scope: '.prose',
})
// All selectors become: .prose .pcb { ... }, .prose .pcb__copy { ... }, etc.
```

Applied to ALL generated CSS including the framework-reset overrides, token-bridge CSS, and dark-mode selectors.

### New exports

- `generateTokenStyles(tokens, scope?)` — generates the derived `--pcb-*` CSS
- `applyScopeToCss(css, scope)` — prefixes all selectors in a CSS string
- `generateDarkModeSelector(darkMode, scope?)` — generates the dark-mode CSS selector
- `generateLightModeSelector(darkMode, scope?)` — generates the light-mode CSS selector
- `DesignTokens` type — the token bridge input interface

### Verification

- All 1134 pre-existing tests pass (no regressions).
- New `test-v2-css-architecture.mjs` adds 43 regression tests covering all 4 P0 features.
- Total: 1177/1177 tests passing.

## [1.3.3] — 2026-06-20

### Summary

Patch release fixing CSS conflicts between the plugin and Tailwind CSS Preflight (and similar framework base resets). The plugin's `:where()` zero-specificity design — normally a feature — meant Tailwind's bare-element resets (`pre { overflow-x: auto }`, `code { font-family: ui-monospace }`, `button { background: transparent }`, `* { border-width: 0 }`) overrode the plugin's critical rules. This caused double scrollbars, wrong mono font, stripped copy-button styling, and long lines wrapping instead of scrolling. The fix adds a small block of "framework-reset overrides" with real specificity that beat framework base resets without `!important`.

### Bug fixes

- **Tailwind Preflight / daisyUI CSS conflict** — Added a block of "framework-reset overrides" in `src/styles.css` with REAL specificity (`.pcb pre` = (0,1,1), `.pcb__copy` = (0,1,0), `.pcb__bar` = (0,1,0), `.pcb__code` = (0,1,0)) that beat framework base resets targeting bare `pre`/`code`/`button`/`*` elements (specificity (0,0,1) or (0,0,0)). The overrides cover:
  - `.pcb pre { overflow: visible }` — prevents Tailwind's `pre { overflow-x: auto }` from creating a double scrollbar (one on `<pre>`, one on `.pcb__body`).
  - `.pcb pre, .pcb code { font-family: var(--pcb-font-mono) }` — prevents Tailwind's `pre, code { font-family: ui-monospace }` from overriding the plugin's `--pcb-font-mono`.
  - `.pcb__copy { appearance: none; background: transparent; border: 1px solid transparent; cursor: pointer }` — prevents Tailwind's `button { background: transparent; background-image: none }` from stripping the copy button's base styling.
  - `.pcb__bar { border-bottom: 1px solid var(--pcb-border) }` — prevents Tailwind's `* { border-width: 0 }` from nuking the header bar's bottom border.
  - `.pcb__code { white-space: pre }` — prevents Tailwind utilities like `break-words` or global `pre { white-space: pre-wrap }` from wrapping long lines instead of scrolling.

  The `:where()` zero-specificity rules are preserved for all other styling — user CSS still wins without `!important` arms races. The new overrides only set the properties that frameworks clobber; everything else stays in `:where()`. No `!important` is used in the override block — the specificity is high enough to beat framework resets on its own.

### Verification

- All 1114 pre-existing tests pass (no regressions).
- New `test-tailwind-compat.mjs` adds 20 regression tests covering: `:where()` rules preserved, framework-reset overrides exist with real specificity, overrides come after `:where()` rules (so they win on tie), no `!important` in override declarations, specificity verification (`.pcb pre` beats `pre`, `.pcb__copy` beats `button`, etc.), and documentation comments.
- Total: 1134/1134 tests passing.

## [1.3.2] — 2026-06-20

### Summary

Patch release fixing a bug where the copy button was unclickable in Astro build output. The root cause was a script injection order race condition: the `.no-js` class (which hides the copy button via CSS when JS is disabled) was added AFTER the copy script ran, so the copy script's `swapNoJs()` was a no-op and the MutationObserver didn't catch the attribute change. Result: `.no-js` stayed on `<html>` permanently, `html.no-js .pcb__copy { display: none !important; }` hid the button, and clicks never reached it.

### Bug fixes

- **Copy button unclickable in Astro build output** — Three complementary fixes:
  1. **Reversed script injection order** in `src/astro.ts`: the `.no-js` add script is now injected BEFORE the copy script, so the copy script's `swapNoJs()` correctly detects and removes the `.no-js` class at load time.
  2. **MutationObserver now watches attribute changes**: the observer on `documentElement` was previously configured with `{ childList: true, subtree: true }` only — it caught new DOM nodes but NOT class attribute changes on `<html>`. Now configured with `{ childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }` so it catches `.no-js` being added by any later script.
  3. **Defensive `DOMContentLoaded` + `window.load` re-check**: the copy script now re-runs `swapNoJs()` on both events as belt-and-suspenders. If a framework adds `.no-js` in a way the MutationObserver doesn't catch (e.g., before the observer is set up, or in a different document context), these event handlers will catch it.

### Verification

- All 1092 pre-existing tests pass (no regressions).
- New `test-copy-button-fix.mjs` adds 22 regression tests covering: injection order in built output, MutationObserver configuration (attributes + class filter), defensive event handlers, `swapNoJs()` function behavior, functional simulation of both the fixed order and the old buggy order + defensive fix, and the CSS rule.
- Total: 1114/1114 tests passing.

## [1.3.1] — 2026-06-19

### Summary

Documentation-only release. Updates `README.md` to cover all v1.3.0 features (5 architectural patterns), the new advanced APIs (`runHighlighterTask`, `disposeHighlighter`, `wordDiff`, `hasChanges`, `DiffToken`), the new `wordDiff` option, theme-aware color defaults, the updated architecture diagram, the expanded test suite (1092 tests across 14 suites), the updated comparison table, and the corrected file structure. No code changes; no behavior changes.

### Documentation

- **README.md** — comprehensive update for v1.3.0:
  - New "What's new in v1.3.0" section with a table of the 5 adopted patterns (source, new export/option).
  - New "Advanced APIs (v1.3.0+)" section documenting `runHighlighterTask`, `disposeHighlighter`, `wordDiff`, `hasChanges`, and the `DiffToken` type, with usage examples.
  - New "Theme-aware defaults (v1.3.0+)" subsection in Theming, documenting the 7 auto-derived `--pcb-*` variables and the cascade order.
  - New `wordDiff` row in the Modes options table, with a full usage example showing the input markdown and resulting HTML.
  - Updated Architecture diagram and design-decisions list (10 items, up from 6) to mention the task queue, theme-aware defaults, dispose lifecycle, and SPA-robust copy button.
  - Updated Testing section: 1092 tests across 14 suites (was "110 tests across three suites").
  - Updated Comparison table: 4 new rows for word-level diff, theme-aware defaults, highlighter task queue, dispose lifecycle, and SPA-robust copy button.
  - Updated File structure: new `color-utils.ts`, `word-diff.ts` source files; new `test-issue-11.mjs`, `test-issue-12.mjs`, `test-architecture-patterns.mjs` test files; updated descriptions for `shiki.ts`, `transformer.ts`, `copy-script.ts`, `index.ts`.
  - New "Changelog" section in README with highlights for each version.
  - Updated "Why this exists" bullet list to mention the new v1.3.0 features.
  - Updated test count from "110 tests pass" to "1092 tests pass".

## [1.3.0] — 2026-06-19

### Summary

Minor release adopting 5 architectural patterns from community competitors (expressive-code, VitePress, rehype-pretty-code), identified through a systematic source-code comparison of 6 community packages. The patterns improve correctness (highlighter race conditions), UX (theme-aware color defaults, SPA support), and add a new opt-in word-level diff feature. All 1051 pre-existing tests continue to pass, plus 41 new regression tests for the adopted patterns. No breaking API changes; all new behavior is opt-in or backward-compatible.

### Features

#### Pattern 1: Highlighter task queue (from expressive-code)

- New exported function `runHighlighterTask<T>(taskFn: () => Promise<T>): Promise<T>` — a mutually exclusive FIFO queue that serializes all highlighter operations (createHighlighter, loadLanguage, codeToHast) globally. Prevents race conditions in parallel static-site builds where multiple unified pipelines share the same module-level highlighter cache.
- All highlighter creation and lazy-language-loading in `src/shiki.ts` now runs inside `runHighlighterTask()`.
- Tradeoff: slight throughput reduction in parallel builds; correctness > throughput for syntax highlighting.

#### Pattern 2: Color-contrast-aware theme defaults (from expressive-code)

- New `src/color-utils.ts` module with `parseColor`, `contrastRatio`, `ensureColorContrastOnBackground`, `mix`, `lighten`, `darken`, `toHex`, `extractThemeColors`, and `computeThemeAwareDefaults` utilities.
- The `<pre>` element now receives inline `--pcb-*` CSS variable defaults derived from the loaded Shiki theme: `--pcb-bg`, `--pcb-fg`, `--pcb-ln-fg` (contrast-adjusted for WCAG), `--pcb-line-highlight-bg`, `--pcb-line-add-bg`, `--pcb-line-del-bg`, `--pcb-line-focus-bg`.
- Code blocks now look good with ANY Shiki theme out of the box — line numbers, diff backgrounds, and focus highlights are automatically legible against the theme's background color.
- Defaults are cached per (highlighter, theme) combination via a `WeakMap` to avoid recomputing per block.
- The static `dist/styles.css` continues to ship its own generic defaults; the runtime overrides them with theme-aware values via inline styles on `<pre>`.

#### Pattern 3: `disposeHighlighter()` lifecycle (from VitePress)

- New exported function `disposeHighlighter()` — releases all cached Shiki highlighters (WASM engine, loaded grammars, theme cache) and clears the cache.
- Intended for long-running dev servers / watch mode where themes change over time. After calling, the next render creates a fresh highlighter.
- VitePress was the only community package that properly disposed its highlighter; we now match that behavior.

#### Pattern 4: Event-delegation copy button + MutationObserver (from VitePress + expressive-code)

- The copy-button client script (`src/copy-script.ts`) now registers a `MutationObserver` that watches for new code blocks added to the DOM (e.g. by React/Vue re-render, Astro view transitions, Turbolinks navigation) and re-applies the `.no-js → .js` class swap + ensures the aria-live region exists.
- New `astro:page-load` event listener for Astro view transitions — re-initializes UI state after SPA navigations.
- The script already used event delegation (`document.addEventListener('click', ...)` with `closest('.pcb__copy')`); Pattern 4 completes the SPA-robustness story.
- No inline `onclick` handlers (CSP-friendly); no per-button listeners (efficient for pages with many code blocks).

#### Pattern 5: Word-level diff (selective adoption from expressive-code)

- New `src/word-diff.ts` module with `wordDiff(oldStr, newStr): DiffToken[]` and `hasChanges(tokens): boolean` — a self-contained LCS-based word diff algorithm (~80 lines, no external deps).
- New `wordDiff: boolean` option (default `false`, opt-in). When enabled alongside `diff: true`, adjacent `pcb__line--del` / `pcb__line--add` pairs are post-processed: the per-word diff is computed and changed words are wrapped in `<mark class="pcb__word-diff--del">` / `<mark class="pcb__word-diff--add">` elements.
- Makes it easy for readers to see exactly what changed within a diff line, not just which lines changed.
- `wordDiff` and `hasChanges` are also exported as standalone utilities for users who want to compute word diffs in their own code.
- This is a selective adoption of expressive-code's token-annotation architecture — we did NOT rewrite the transformer to use `codeToTokensBase` + annotations (that would be a major rewrite). Instead, we added the most impactful feature (word-level diff) as a post-processing step on top of the existing HAST-walking code.

### Verification

- All 1051 pre-existing tests pass (no regressions).
- New `test-architecture-patterns.mjs` adds 41 regression tests covering all 5 patterns.
- Total: 1092/1092 tests passing.

### References

- Architecture comparison report: 590-line analysis of 6 community packages (rehype-pretty-code, expressive-code, @shikijs/transformers, VitePress, Docusaurus, astro-expressive-code) with 30 cited source file references.
- Pattern 1 source: `expressive-code/packages/@expressive-code/plugin-shiki/src/highlighter.ts:133-170` (`runHighlighterTask`).
- Pattern 2 source: `expressive-code/packages/@expressive-code/core/src/internal/core-styles.ts:191-215` (theme-aware defaults as functions).
- Pattern 3 source: `vitepress/src/node/markdown/plugins/highlight.ts:223` (`highlighter.dispose()` return).
- Pattern 4 source: `vitepress/src/client/app/composables/copyCode.ts` + `expressive-code/packages/@expressive-code/plugin-frames/src/copy-js-module.ts`.
- Pattern 5 source: `expressive-code/packages/@expressive-code/plugin-text-markers/src/index.ts` (`mark`/`ins`/`del` word-level markers).

## [1.2.2] — 2026-06-19

### Summary

Patch release fixing a DoS bug where a fenced code block whose meta string requested a very large line-highlight range (e.g. ```` ```fsharp {1-1000000} ````) would throw `RangeError: Maximum call stack size exceeded` and abort the entire pipeline. No API changes; no backward-compatibility concerns. All 1000 pre-existing tests continue to pass, plus 51 new regression tests.

### Bug fixes

- **Cap line-highlight ranges to prevent stack overflow** ([#11](https://github.com/dr-ishaan/rehype-perfect-code-blocks/issues/11), [PR #15](https://github.com/dr-ishaan/rehype-perfect-code-blocks/pull/15)) — A meta string like `{1-1000000}` would previously cause `parseRanges()` in `src/meta.ts` to expand the range into a 1,000,000-element `Set`, then the call site `result.highlight.push(...lines)` would exhaust V8's call stack (the spread operator passes each element as a separate stack argument, and V8 caps this at ~100k args). The throw propagated up through the unified pipeline and aborted the entire `process()` call — surrounding markdown in the same document was also lost. This is a DoS vector for any deployment that renders user-supplied markdown (issue trackers, comment systems, CMSes, forum software). A single comment containing ```` ```x {1-1000000}\ny\n``` ```` would crash the renderer.

  The fix has two complementary parts in `src/meta.ts`:

  1. `parseRanges()` now short-circuits ranges whose total span exceeds 10,000 lines, returning an empty array (skip highlighting for that spec). The block still renders normally; it just doesn't have line-highlighting applied. The cap is intentionally much larger than any realistic code block (a 10k-line code block is itself pathological) to avoid false positives.
  2. The call site uses a `for` loop instead of `push(...lines)` as defensive programming — even if a future code path bypasses the cap, the spread operator can't blow the stack.

  No API change. No backward-compatibility concern. Previously these inputs threw and aborted the entire pipeline; after the fix they render correctly (just without the out-of-range line highlighting).

  Discovered by a 10,400-case fuzz suite against the package; 66 test cases in that suite hit this bug.

### Verification

- All 1000 pre-existing tests pass (no regressions).
- New `test-issue-11.mjs` adds 51 regression tests covering: `parseMeta` unit tests (the underlying bug), normal ranges still work (no false positives), end-to-end pipeline tests with the exact issue repro across 10 languages, multi-block documents with huge ranges, performance (pathological inputs return in <100ms), and realistic large-block use cases (5000-line ranges still work).
- Total: 1051/1051 tests passing.

## [1.2.1] — 2026-06-19

### Summary

Patch release fixing a case-sensitive language loader bug that caused fenced code blocks with non-lowercase language identifiers (e.g. ```` ```JS ````, ```` ```TypeScript ````, ```` ```Python ````) to throw `Language 'XXX' is not included in this bundle` and abort the entire pipeline. No API changes; no backward-compatibility concerns. All 972 pre-existing tests continue to pass, plus 28 new regression tests.

### Bug fixes

- **Case-insensitive language resolution** ([#12](https://github.com/dr-ishaan/rehype-perfect-code-blocks/issues/12), [PR #14](https://github.com/dr-ishaan/rehype-perfect-code-blocks/pull/14)) — Language identifiers are now normalized to lowercase before any Shiki call. Previously, the lazy-loader path called `highlighter.loadLanguage(lang)` with the raw case-preserving identifier from the fence, while Shiki's bundled grammars all use lowercase IDs (`javascript`, `typescript`, `python`, …). Shiki's own `codeToHast` / `codeToHtml` are case-insensitive, but the plugin's loader call site was not. This is valid CommonMark and works in every other major markdown renderer (GitHub, VS Code, GitLab, Docusaurus, VitePress, `rehype-pretty-code`). The fix normalizes the identifier to lowercase at three places in `src/shiki.ts`:

  1. When collecting langs for the initial highlighter load.
  2. When resolving the per-block lang for `codeToHast` / `codeToHtml`.
  3. When looking up user-defined `languageAliases` (config is now case-insensitive too — `{ TS: 'typescript' }` works the same as `{ ts: 'typescript' }`).

  The output's `data-language` attribute now uses the lowercase normalized form (e.g. `data-language="javascript"` instead of `data-language="JavaScript"`). The original-case `language-*` CSS class is still added to the output `<code>` element (when different from the lowercase form) so existing user CSS targeting like `.language-JavaScript` continues to work.

  Discovered by a 10,400-case fuzz suite against the package; 30 test cases in that suite hit this bug.

### Verification

- All 972 pre-existing tests pass (no regressions).
- New `test-issue-12.mjs` adds 28 regression tests covering: exact reproduction cases, real syntax highlighting (not plaintext fallback), case-variants producing identical output to lowercase baseline, `languageAliases` working with case-insensitive lookup, `data-language` attribute normalization, and multi-block documents with mixed case.
- Total: 1000/1000 tests passing.

## [1.2.0] — 2026-06-18

### Summary

After a thorough comparative analysis against `rehype-pretty-code`, `expressive-code`, and `@shikijs/transformers`, this release adopts 23 features from community competitors. CSS styling is unchanged. All 821 plugin tests + 2483 external Astro 6 test suite tests pass.

### Features adopted from competitors

#### From `@shikijs/transformers` (8 P0 features)

- **Line-ending normalization** — `\r\n` and `\r` are normalized to `\n` before tokenization, preventing `\r` artifacts in output.
- **`customNotations` wired up** — previously `void customNotations`; now uses `transformerNotationMap` to map custom `// [!code xxx]` markers to CSS classes.
- **`removeComments` option** — strips all comments (`//`, `#`, `/* */`, `<!-- -->`) from rendered code via `transformerRemoveComments`.
- **`removeLineBreaks` option** — joins all lines into one via `transformerRemoveLineBreak`.
- **`zeroIndexed` option** — when `true`, `{1,3-5}` meta ranges are treated as zero-indexed (line 0 is the first line).
- **`lineOptions` option** — programmatic per-line class assignment via `transformerCompactLineOptions`.
- **`has-diff`/`has-focused`/`has-highlighted`/`has-error-level` classes on `<pre>`** — previously stripped; now restored so CSS can target the whole `<pre>` when any line has a state.
- **Unknown-language warning logging** — failed language loads now log a warning (with a custom `logger` option) instead of silently falling back to plaintext.

#### From `expressive-code` (5 P1 features)

- **Per-line collapsible sections** — `collapse="5-12,20-30"` meta wraps matching line ranges in `<details><summary>N collapsed lines</summary>…</details>`. Supports `collapseStyle: 'github' | 'collapsible-start' | 'collapsible-end' | 'collapsible-auto'`.
- **`tabIndex=0` on scrollable body** — keyboard-scrollable code blocks (WCAG 2.1.1).
- **Screen-reader-only title for terminal preset** — `<span class="pcb__sr-only">Terminal window</span>` added to terminal blocks without a title.
- **`<figcaption>` for title bar when no caption** — more semantic HTML (matches rehype-pretty-code).
- **ANSI escape sequence support** — `lang: 'ansi'` is now in `terminalLangs` by default; a custom transformer strips `\x1b\[[0-9;]*[a-zA-Z]` sequences.

#### From `rehype-pretty-code` (3 P1 features)

- **Inline code highlighting** — `inlineCode: 'lang' | 'token'` now actually works. Parses `\`code{:lang}\`` and `\`code{:.token}\`` suffixes, strips them from display, and adds `pcb__inline` classes.
- **i18n for UI strings** — new `texts` option with `copyLabel`, `doneLabel`, `copyAriaLabel`, `codeBlockAriaPrefix`, `terminalSrOnlyTitle`, `collapsedLinesLabel`. Supports Japanese, Chinese, Korean, etc.
- **Terminal comment stripping on copy** — `copyStripComments: true` (default for terminal preset) adds `data-strip-comments` to the copy button; the client script strips `#`, `//`, `REM` comment lines from the copied text.

#### Architecture improvements (4 P1 features)

- **Multi-theme support (>2 themes)** — `shiki.theme` now accepts `Record<string, string>` with 3+ entries (e.g. `{ light, dark, dim }`). Shiki emits `--shiki-<name>` CSS vars for each.
- **`tabWidth` normalization** — replace tabs with N spaces before tokenization.
- **`transformerOrder` option** — `'before' | 'after'` (default) controls whether user transformers run before or after auto-registered ones.
- **`disableAutoTransformers` option** — when `true`, only user-provided transformers are applied (full manual control).
- **`createRequire` fallback** — wrapped in try/catch so the plugin loads in edge runtimes (Cloudflare Workers, browser bundles) without `node:module`.

#### Security & CSP (1 P1 feature)

- **CSP nonce support** — new `cspNonce` option adds `nonce="..."` to all injected `<script>` and `<style>` tags in `astro.ts`, enabling strict Content-Security-Policy.

#### Bug fixes

- **Terminal `<placeholder>` workaround** — Shiki mis-highlights `<user>@<host>` in shell snippets. We now temporarily replace `<...>` with a sentinel before tokenization and restore it after.
- **Copy button i18n** — `copyButton: true` (legacy boolean) now respects `texts.copyLabel` instead of always using `'copy'`.

### Verification

- Plugin's own test suite: 821/821 passing.
- External Astro 6 + Vitest harness: 2483/2483 passing (includes 118 new adopted-features tests).
- Real `npx astro build` on Astro 6.4.8: completes successfully.

### Where we already lead (not changed)

The following areas where our plugin was already better than all competitors are unchanged:

1. Defense-in-depth on user-supplied SVG/HTML (`isSafeInlineHtml`)
2. CSP-safe copy button (no inline `onclick`)
3. HAST API by default (`codeToHast` directly)
4. Bundled-lang filtering (prevents sync throws)
5. JS regex engine option (edge-runtime support)
6. Cache key correctness (theme + langs + regex engine)
7. Magic comments (Docusaurus-style `highlight-next-line`)
8. `collapseAfter` auto-threshold
9. `rehypePlugins` escape hatch
10. `role="region"` + `aria-label` on scrollable body
11. `role="status"` + re-announcement on copy
12. No-JS graceful degradation

## [1.1.7] — 2026-06-18

### Fixed

- **#1** — `splitCodeIntoLines()` no longer drops empty middle lines.
- **#2** — `successIcon` now passes through `isSafeInlineHtml()` defense-in-depth check.
- **#4** — `parseRanges()` pre-normalizes whitespace around `-`.
- **#5** — `linenumbers` accepted as a third alternative in start-line directive.
- **#8** — `data-feedback-duration` always emitted (default 1600).

### Changed

- **#6** — Widened `peerDependencies.astro` to include Astro 6.
- **#7** — Exposed `./meta`, `./transformer`, `./shiki`, `./copy-script`, `./types` in exports map.

### Compatibility

- `astro.ts` rewritten to use `readFileSync` + `astro:build:done` hook for Astro 6.
- Added `rehypePlugins` option to `PerfectCodeOptions`.

## [1.1.0] — 2026-06-18

Major upgrade — accessibility, performance, security, 872 tests.

## [1.0.0] — 2026-06-18

Initial release: rehype-perfect-code-blocks v1.0.0.

[1.2.0]: https://github.com/dr-ishaan/rehype-perfect-code-blocks/releases/tag/v1.2.0
[1.1.7]: https://github.com/dr-ishaan/rehype-perfect-code-blocks/releases/tag/v1.1.7
[1.1.0]: https://github.com/dr-ishaan/rehype-perfect-code-blocks/releases/tag/v1.1.0
[1.0.0]: https://github.com/dr-ishaan/rehype-perfect-code-blocks/releases/tag/v1.0.0
