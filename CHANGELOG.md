# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
