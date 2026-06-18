# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.7] — 2026-06-18

### Fixed

- **#1** — `splitCodeIntoLines()` no longer drops empty middle lines. The
  `sawAnyContent` guard was intended to skip a trailing empty line but also
  skipped legitimate inter-content empty lines (e.g. blank lines between
  function definitions). `filterTrailingEmpty()` already handles the
  trailing case correctly at the end of `transformPre()`.
- **#2** — `successIcon` now passes through the `isSafeInlineHtml()`
  defense-in-depth check before being stored in `data-success-icon`.
  Previously it was stored verbatim and later `innerHTML`'d by the client
  copy-script, making it a latent XSS sink. Dangerous patterns
  (`<script>`, `on*=`, `javascript:`, `<iframe>`, `<object>`, `<embed>`)
  now cause the attribute to be omitted entirely.
- **#4** — `parseRanges()` now pre-normalizes whitespace around `-` before
  splitting on `[\s,]+`. `{3 - 5}` parses as `[3, 4, 5]` instead of `[3, 5]`.
- **#5** — `linenumbers` is now accepted as a third alternative (alongside
  `ln` and `showlinenumbers`) in the start-line directive. `LINENUMBERS{5}`,
  `LineNumbers{5}`, etc. now parse correctly.
- **#8** — `data-feedback-duration` is now always emitted on the copy
  button, defaulting to `1600` when not explicitly set. Previously the
  attribute was only emitted when the user set `copyButton.feedbackDuration`,
  causing the rendered HTML to differ from the docs.

### Changed

- **#6** — Widened `peerDependencies.astro` to `^4.0.0 || ^5.0.0 || ^6.0.0`
  to officially support Astro 6.
- **#7** — Exposed `./meta`, `./transformer`, `./shiki`, `./copy-script`,
  and `./types` in the package `exports` map so downstream test suites
  can import internal modules without vitest/webpack aliases.

### Compatibility

- `astro.ts` rewritten to use `readFileSync(join(__dirname, 'styles.css'))`
  instead of `import css from './styles.css?raw'`. The `?raw` query failed
  with `Unknown file extension ".css"` when the package was symlinked or
  consumed outside Vite's pipeline.
- `astro.ts` now uses an `astro:build:done` hook that walks `dist/*.html`
  and injects CSS + scripts directly before `</head>`, instead of
  `injectScript('page', '<style>...</style>')` which broke on Astro 6
  (where `injectScript` expects JS, not HTML).
- Added `rehypePlugins?: unknown[]` to `PerfectCodeOptions` so users can
  pass `rehypeRaw` etc. through the Astro integration.

### Verification

- Plugin's own test suite: 821/821 passing.
- External Astro 6 + Vitest test harness: 2365/2365 passing.
- Real `npx astro build` on Astro 6.4.8: completes successfully.

## [1.1.0] — 2026-06-18

Major upgrade — accessibility, performance, security, 872 tests.

## [1.0.0] — 2026-06-18

Initial release: rehype-perfect-code-blocks v1.0.0.

[1.1.7]: https://github.com/dr-ishaan/rehype-perfect-code-blocks/releases/tag/v1.1.7
[1.1.0]: https://github.com/dr-ishaan/rehype-perfect-code-blocks/releases/tag/v1.1.0
[1.0.0]: https://github.com/dr-ishaan/rehype-perfect-code-blocks/releases/tag/v1.0.0
