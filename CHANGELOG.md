# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
