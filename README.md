# rehype-perfect-code-blocks

Beautiful, configurable code blocks for Astro, MDX, and any rehype pipeline. Built on Shiki, inspired by [rehype-pretty-code](https://github.com/rehype-pretty/rehype-pretty-code), [VitePress](https://vitepress.dev/), [Docusaurus](https://docusaurus.io/), and [Expressive Code](https://expressive-code.com/).

## Why this exists

- **One-line Astro setup** — `perfectCode()` integration does everything
- **All VitePress notations work** — `// [!code highlight]`, `// [!code focus]`, `// [!code ++]`, `// [!code --]`, `// [!code error]`, `// [!code warning]`, `// [!code word:foo]`
- **Docusaurus magic comments** — `// highlight-next-line`, `// highlight-start` / `// highlight-end`
- **rehype-pretty-code meta syntax** — `title="..."`, `{1,3-5}`, `/word/`, `/word/3-5#id`
- **Auto terminal frame** for `sh`/`bash`/`zsh` etc., editor frame for everything else
- **Dual themes** via Shiki's `themes: { light, dark }` — emits `--shiki-light` / `--shiki-dark` CSS vars
- **Theme-aware color defaults** — `--pcb-*` variables auto-derived from the loaded Shiki theme with WCAG contrast enforcement (v1.3.0+)
- **Word-level diff** — opt-in `wordDiff: true` wraps changed words in `<mark class="pcb__word-diff--{add,del}">` within `+`/`-` diff lines (v1.3.0+)
- **SPA-robust copy button** — event delegation + MutationObserver + `astro:page-load` for React/Vue/Astro view transitions (v1.3.0+)
- **Highlighter lifecycle** — `disposeHighlighter()` for long-running dev servers (v1.3.0+)
- **CSS variables everywhere** — every visual property is a `--pcb-*` var, scoped with `:where()` for zero-specificity
- **Configurable copy button** — hover mode, custom icons, custom duration, custom labels
- **1092 tests pass** — edge cases, stress tests, regression suites, and architecture-pattern tests

## What's new in v1.3.0

v1.3.0 adopts **5 architectural patterns** identified through a systematic source-code comparison of 6 community packages (rehype-pretty-code, expressive-code, @shikijs/transformers, VitePress, Docusaurus, astro-expressive-code):

| # | Pattern | Source | New export / option |
|---|---|---|---|
| 1 | **Highlighter task queue** — serializes all highlighter operations globally, prevents race conditions in parallel builds | expressive-code | `runHighlighterTask<T>(taskFn)` |
| 2 | **Color-contrast-aware theme defaults** — `--pcb-*` variables auto-derived from the loaded Shiki theme with WCAG contrast enforcement | expressive-code | (internal; `src/color-utils.ts`) |
| 3 | **`disposeHighlighter()` lifecycle** — releases cached Shiki highlighters (WASM engine + grammars) for long-running dev servers | VitePress | `disposeHighlighter()` |
| 4 | **Event-delegation copy button + MutationObserver** — SPA-robust for React/Vue/Astro view transitions | VitePress + expressive-code | (internal; copy-script.ts) |
| 5 | **Word-level diff** — opt-in `wordDiff: true` wraps changed words in `<mark>` elements within diff lines | expressive-code | `wordDiff` option + `wordDiff()` / `hasChanges()` utilities |

No breaking API changes. All new behavior is opt-in or backward-compatible. See [CHANGELOG.md](./CHANGELOG.md) for full details.

### Recent bug fixes (v1.2.1, v1.2.2)

- **v1.2.2** — Fixed DoS bug where `{1-1000000}` line-highlight range caused `RangeError: Maximum call stack size exceeded` (issue #11).
- **v1.2.1** — Fixed case-sensitive language loader that rejected `JS`/`TypeScript`/`Python` (issue #12).
- **v1.2.0** — Adopted 23 features from community competitors (transformers, terminal frames, i18n, CSP nonces, etc.).

## Install

```bash
npm install rehype-perfect-code-blocks
```

Optional peers: `astro` (for the integration), `shiki` (only if you set `engine: 'shiki'`).

**Recommended:** also install [`rehype-raw`](https://github.com/rehypejs/rehype-raw) if your markdown contains raw HTML (`<details>`, `<kbd>`, `<mark>`, etc.). See [⚠️ Required: `rehype-raw`](#-required-rehype-raw-for-code-blocks-inside-raw-html) below.

## Quick start (Astro)

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config';
import rehypeRaw from 'rehype-raw';
import perfectCode from 'rehype-perfect-code-blocks/astro';

export default defineConfig({
  integrations: [
    perfectCode({
      // All options are optional — these are the defaults
      decorations: true,
      showLanguage: true,
      copyButton: true,
      shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
      // Add rehype-raw so code blocks inside raw HTML (<details>, <kbd>, etc.) render
      rehypePlugins: [
        rehypeRaw,  // ← must come BEFORE rehypePerfectCodeBlocks
      ],
    }),
  ],
});
```

That's it. Every fenced code block in `.md` and `.mdx` is now styled.

## Quick start (standalone rehype)

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import {
  rehypePerfectCodeBlocks,
  remarkPreserveCodeMeta,
} from 'rehype-perfect-code-blocks';
import 'rehype-perfect-code-blocks/styles.css';

const html = await unified()
  .use(remarkParse)
  .use(remarkPreserveCodeMeta)                     // ← required: preserves fence meta
  .use(remarkRehype, { allowDangerousHtml: true })  // ← pass raw HTML through
  .use(rehypeRaw)                                   // ← parse raw HTML into HAST
  .use(rehypePerfectCodeBlocks, { copyButton: true })
  .use(rehypeStringify)
  .process(markdown);
```

## ⚠️ Required: `rehype-raw` for code blocks inside raw HTML

If your markdown contains **raw HTML elements** like `<details>`, `<kbd>`, `<mark>`, `<abbr>`, `<sub>`, `<sup>`, `<dl>`, `<figure>`, `<address>`, or `<cite>`, you **must** add [`rehype-raw`](https://github.com/rehypejs/rehype-raw) to your pipeline.

Without `rehype-raw`, `remark-rehype` silently drops all raw HTML — which means:
- Code blocks inside `<details>` elements won't render
- `<kbd>Ctrl</kbd>` becomes plain text "Ctrl"
- `<mark>`, `<abbr>`, `<sub>`, `<sup>`, `<del>`, `<ins>` are all stripped

### Install

```bash
npm install rehype-raw
```

### Astro config

```ts
// astro.config.mjs
import rehypeRaw from 'rehype-raw';
import perfectCode from 'rehype-perfect-code-blocks/astro';

export default defineConfig({
  integrations: [
    perfectCode({
      // rehype-raw MUST come before rehypePerfectCodeBlocks in the pipeline
      rehypePlugins: [rehypeRaw],
    }),
  ],
});
```

### Standalone rehype

```ts
unified()
  .use(remarkParse)
  .use(remarkPreserveCodeMeta)
  .use(remarkRehype, { allowDangerousHtml: true })  // pass raw HTML through
  .use(rehypeRaw)                                    // parse raw HTML into HAST
  .use(rehypePerfectCodeBlocks, { ... })             // our plugin
  .use(rehypeStringify)
```

### What works with `rehype-raw`

| Element | Without `rehype-raw` | With `rehype-raw` |
| --- | --- | --- |
| Code blocks in `<details>` | ❌ Stripped | ✅ Rendered |
| `<kbd>Ctrl</kbd>` | ❌ Plain text | ✅ Styled |
| `<mark>highlight</mark>` | ❌ Stripped | ✅ Styled |
| `<abbr title="...">` | ❌ Stripped | ✅ Tooltip |
| `<sub>` / `<sup>` | ❌ Stripped | ✅ Sub/superscript |
| `<del>` / `<ins>` | ❌ Stripped | ✅ Strike/underline |
| `<dl>` definition lists | ❌ Stripped | ✅ Rendered |
| `<figure>` + `<figcaption>` | ❌ Stripped | ✅ Rendered |
| `<address>` | ❌ Stripped | ✅ Rendered |
| `<cite>` / `<q>` | ❌ Stripped | ✅ Rendered |

> **Note:** Code blocks inside markdown blockquotes (`>`) and callouts (`> [!note]`) **always work** — they're parsed as markdown by `remark-parse`, not as raw HTML. `rehype-raw` is only needed for code blocks inside explicit HTML tags.

## Per-block meta syntax

Full reference for the meta string after the language identifier:

````md
```ts title="src/store.ts" {1,3-5} ln{5} /foo/ /bar/2-4#v1 wrap showLineNumbers caption="Source: docs/x.ts"
//   ^^^         ^^^^^^^^^^^^^^^^^^^^ ^^^^^^^^^^ ^^^ ^^^^^^^^^^^^^^^^^^^^^^^ ^^^^ ^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//   lang        title                highlight  ln  word highlight           flag caption        caption text
```
````

### Flags

| Flag | Effect |
| --- | --- |
| `title="..."` | Sets the filename in the header bar |
| `caption="..."` | Renders a `<figcaption>` below the block |
| `{1,3-5}` | Highlights those lines |
| `{1,2}#id` | Group highlighted lines by id for per-group styling |
| `/word/` | Highlights all occurrences of `word` |
| `/word/3-5` | Highlights occurrences 3 through 5 |
| `/word/#id` | Assign id to word-highlight group |
| `ln{N}` or `showLineNumbers{N}` | Show line numbers starting at N |
| `wrap` / `noWrap` | Force wrap on/off |
| `ln` / `noLn` | Force line numbers on/off |
| `bar` / `noBar` | Force header bar on/off |
| `decorations` / `noDecorations` | Toggle traffic-light dots |
| `lang` / `noLang` | Toggle language badge |
| `copy` / `noCopy` | Toggle copy button |
| `collapse` | Force collapsible (`<details>`) |

### Inline-comment notations (VitePress-style)

Write comments inside the code to mark lines. Syntax colors are preserved (unlike `+`/`-` prefix diffing):

```ts
const a = 1 // [!code highlight]
const b = 2 // [!code focus]
const c = 3 // [!code focus:2]
const d = 4 // [!code ++]
const e = 5 // [!code --]
const f = 6 // [!code error]
const g = 7 // [!code warning]
// [!code word:foo]
const foo = 'foo'
```

### Magic comments (Docusaurus-style)

```ts
// highlight-next-line
const a = 1
// highlight-start
const b = 2
const c = 3
// highlight-end
const d = 4
```

Register your own magic comments via the `magicComments` option:

```ts
perfectCode({
  magicComments: [
    {
      className: 'pcb__line--error',
      line: 'error-next-line',
      block: { start: 'error-start', end: 'error-end' },
    },
  ],
})
```

## Options

All options are optional. Defaults match the demo.

### Ornaments

| Option | Type | Default |
| --- | --- | --- |
| `decorations` | `boolean` | `true` |
| `showLanguage` | `boolean` | `true` |
| `copyButton` | `boolean \| CopyButtonOptions` | `true` |

`CopyButtonOptions`:

```ts
{
  visibility?: 'always' | 'hover'  // default 'always'
  feedbackDuration?: number         // default 1600 (ms)
  copyIcon?: string                 // default: built-in SVG
  successIcon?: string              // default: built-in check SVG
  label?: string | null             // default 'copy'; null = icon-only
  doneLabel?: string                // default 'copied!'
}
```

### Structure

| Option | Type | Default |
| --- | --- | --- |
| `lineNumbers` | `'always' \| 'never' \| 'auto'` | `'auto'` (on when title present) |
| `titleBar` | `'always' \| 'never' \| 'auto'` | `'auto'` |
| `lineNumbersStart` | `number` | `1` |

### Modes

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `highlight` | `boolean` | `true` | Enable `{1,3-5}` meta + `// [!code highlight]` |
| `diff` | `boolean` | `true` | Enable `+`/`-` prefix + `// [!code ++]` / `[!code --]` |
| `wordDiff` | `boolean` | `false` | **(v1.3.0)** When `diff` is also true, wrap changed words in `<mark class="pcb__word-diff--{add,del}">` within adjacent `+`/`-` diff line pairs. Uses LCS-based word diff. |
| `focus` | `boolean` | `true` | Enable `// [!code focus]` |
| `errorLevels` | `boolean` | `true` | Enable `// [!code error]` / `[!code warning]` |
| `wrap` | `boolean` | `false` | Default wrap mode |
| `collapseAfter` | `number \| null` | `null` | Auto-collapse blocks > N lines |
| `showWhitespace` | `false \| 'all' \| 'boundary' \| 'trailing' \| 'leading'` | `false` | Visible whitespace |
| `indentGuides` | `boolean \| number` | `false` | Render indent guides |
| `caption` | `boolean` | `true` | Render `caption="..."` meta as `<figcaption>` |

#### Word-level diff example (v1.3.0+)

```ts
perfectCode({
  diff: true,
  wordDiff: true,  // opt-in
})
```

With this markdown:

````md
```js
- const x = computeValue(1)
+ const y = computeValue(2)
```
````

The output wraps `x`→`y` and `1`→`2` in `<mark>` elements so readers can see exactly what changed within each diff line, not just which lines changed:

```html
<span class="pcb__line pcb__line--del">
  <span class="pcb__code">
    <mark class="pcb__word-diff pcb__word-diff--del">x</mark>
    <!-- unchanged words render as plain text -->
    <mark class="pcb__word-diff pcb__word-diff--del">1</mark>
  </span>
</span>
<span class="pcb__line pcb__line--add">
  <span class="pcb__code">
    <mark class="pcb__word-diff pcb__word-diff--add">y</mark>
    <mark class="pcb__word-diff pcb__word-diff--add">2</mark>
  </span>
</span>
```

### Engine

| Option | Type | Default |
| --- | --- | --- |
| `engine` | `'auto' \| 'shiki' \| 'passthrough'` | `'auto'` |
| `keepBackground` | `boolean` | `false` (we own `--pcb-bg`) |
| `shiki.theme` | `string \| { light, dark }` | `{ light: 'github-light', dark: 'github-dark' }` |
| `shiki.langs` | `string[]` | `[]` (sensible defaults pre-loaded) |
| `shiki.transformers` | `ShikiTransformer[]` | `[]` |
| `shiki.getHighlighter` | `(opts) => Promise<Highlighter>` | `undefined` (escape hatch) |

### Customization

| Option | Type | Default |
| --- | --- | --- |
| `customNotations` | `Record<string, string>` | `{}` |
| `magicComments` | `MagicComment[]` | Docusaurus-style defaults |
| `inlineCode` | `false \| 'lang' \| 'token'` | `false` |
| `inlineDefaultLang` | `string` | `''` |
| `tokensMap` | `Record<string, string>` | `{}` |
| `terminalLangs` | `string[]` | `['sh','bash','zsh','shell','console','powershell','bat','cmd']` |
| `extractFileNameFromCode` | `boolean` | `false` |

### Hooks

```ts
perfectCode({
  filterMetaString: (meta) => meta.replace(/#.*$/, ''),  // strip ids
  onVisitLine: ({ element, lineNumber }) => { /* mutate hast */ },
  onVisitHighlightedLine: ({ element, lineNumber, id }) => { /* ... */ },
  onVisitHighlightedChars: ({ element, text, id }) => { /* ... */ },
  onVisitTitle: (element) => { /* ... */ },
  onVisitCaption: (element) => { /* ... */ },
})
```

## Advanced APIs (v1.3.0+)

These exported functions are for advanced use cases — long-running dev servers, parallel build pipelines, custom diff tooling. Most users don't need them.

### `runHighlighterTask<T>(taskFn: () => Promise<T>): Promise<T>`

**Source:** Pattern 1, adopted from [expressive-code](https://github.com/expressive-code/expressive-code).

A mutually exclusive FIFO queue that serializes all highlighter operations (createHighlighter, loadLanguage, codeToHast) globally. The plugin uses this internally to prevent race conditions in parallel static-site builds where multiple unified pipelines share the same module-level highlighter cache.

You can use it directly if you're calling Shiki outside the plugin and want to share the same serialization guarantee:

```ts
import { runHighlighterTask } from '@dr-ishaan/rehype-perfect-code-blocks';

// Ensure this runs in the same queue as plugin-internal highlighter calls
const result = await runHighlighterTask(async () => {
  return highlighter.codeToHtml(code, { lang: 'ts' });
});
```

### `disposeHighlighter(): void`

**Source:** Pattern 3, adopted from [VitePress](https://vitepress.dev).

Releases all cached Shiki highlighters (WASM engine + loaded grammars + theme cache) and clears the cache. Intended for long-running dev servers / watch mode where themes change over time, or during cleanup of a build pipeline.

After calling, the next render creates a fresh highlighter.

```ts
import { disposeHighlighter } from '@dr-ishaan/rehype-perfect-code-blocks';

// In a Vite dev server shutdown hook:
server.http2.close(() => disposeHighlighter());

// Or when the user changes their theme in a config-reload hook:
configReloadEmitter.on('reload', () => {
  disposeHighlighter();
  // next render will create a fresh highlighter with the new theme
});
```

### `wordDiff(oldStr: string, newStr: string): DiffToken[]`

**Source:** Pattern 5, selective adoption from [expressive-code](https://github.com/expressive-code/expressive-code/blob/main/packages/%40expressive-code/plugin-text-markers/src/index.ts).

A self-contained LCS-based word diff algorithm (~80 lines, no external deps). Computes a per-word diff between two strings and returns an array of `{ text, type }` tokens where `type` is `'add'`, `'del'`, or `'equal'`.

You can use it standalone for custom diff UIs outside the plugin:

```ts
import { wordDiff, hasChanges } from '@dr-ishaan/rehype-perfect-code-blocks';

const tokens = wordDiff('const x = 1', 'const y = 2');
// → [
//   { text: 'const ', type: 'equal' },
//   { text: 'x',       type: 'del'    },
//   { text: 'y',       type: 'add'    },
//   { text: ' = ',     type: 'equal' },
//   { text: '1',       type: 'del'    },
//   { text: '2',       type: 'add'    },
// ]

if (hasChanges(tokens)) {
  // render the diff in your own UI
}
```

The plugin uses this internally when the `wordDiff: true` option is set — see the [Modes](#modes) table above.

### `hasChanges(tokens: DiffToken[]): boolean`

Returns `true` if the diff result contains at least one `add` or `del` token. Useful for skipping the rendering of unchanged diff pairs.

### `DiffToken` type

```ts
interface DiffToken {
  text: string;
  type: 'add' | 'del' | 'equal';
}
```

### Styling

| Option | Type | Default |
| --- | --- | --- |
| `preset` | `'default' \| 'terminal' \| 'minimal'` | `'default'` |
| `injectStyles` | `boolean` | `true` |
| `theme` | `'auto' \| 'dark' \| 'light'` | `'auto'` |

## Theming

### Theme-aware defaults (v1.3.0+)

The `<pre>` element receives inline `--pcb-*` CSS variable defaults **derived from the loaded Shiki theme** — automatically, with no configuration. This means code blocks look good with ANY Shiki theme out of the box, without you having to manually tune line-number colors, diff backgrounds, or focus highlights.

The defaults computed per theme:

| Variable | How it's derived |
| --- | --- |
| `--pcb-bg` | Theme background color |
| `--pcb-fg` | Theme foreground color |
| `--pcb-ln-fg` | Line-number color, contrast-adjusted against `--pcb-bg` to meet WCAG AA (ratio ≥ 3.0) |
| `--pcb-line-highlight-bg` | Subtle highlight tint: 12% mix of `--pcb-fg` over `--pcb-bg` |
| `--pcb-line-add-bg` | Diff add background: 18% mix of green (`#22863a`) over `--pcb-bg` |
| `--pcb-line-del-bg` | Diff del background: 18% mix of red (`#cb2431`) over `--pcb-bg` |
| `--pcb-line-focus-bg` | Focus dim: 4% mix of `--pcb-fg` over `--pcb-bg` |

The static `dist/styles.css` continues to ship its own generic defaults; the runtime overrides them with theme-aware values via inline styles on `<pre>`. You can still override any `--pcb-*` variable in your own CSS — the cascade order is: `dist/styles.css` < inline `<pre style>` < your CSS.

### Manual overrides

Every visual property is a `--pcb-*` CSS variable on `.pcb`. Override any subset:

```css
.pcb {
  --pcb-bg: #1a1b26;
  --pcb-accent: #7aa2f7;
  --pcb-radius: 8px;
  --pcb-font-mono: 'Cascadia Code', monospace;
  --pcb-line-highlight: rgba(122, 162, 247, 0.18);
  --pcb-line-error: rgba(247, 118, 142, 0.22);
  --pcb-word-bg: rgba(224, 175, 104, 0.30);
}
```

Light mode activates automatically via `prefers-color-scheme`, or manually via `<html data-theme="light">`.

### Dual themes (CSS variables)

When `shiki.theme` is `{ light, dark }`, Shiki emits `--shiki-light` and `--shiki-dark` CSS vars on every token span. The bundled CSS auto-switches them based on `prefers-color-scheme`:

```css
@media (prefers-color-scheme: light) {
  .pcb code span[style] { color: var(--shiki-light, inherit) !important; }
}
@media (prefers-color-scheme: dark) {
  .pcb code span[style] { color: var(--shiki-dark, inherit) !important; }
}
```

## Engine modes

| Mode | Behavior |
| --- | --- |
| `auto` | Post-process Shiki output if present; otherwise call Shiki directly. **Default.** |
| `shiki` | Always call Shiki directly (re-tokenizes raw blocks). |
| `passthrough` | Never tokenize; just wrap existing `<pre><code>` as-is. |

## Architecture

```
Markdown fence
    │
    ▼
┌──────────────────────────────┐
│  remarkPreserveCodeMeta      │  ← copies fence meta to <code data-meta="...">
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│  Shiki (via Astro or direct) │  ← tokenizes to <pre><code>...tokens...</code></pre>
│  + @shikijs/transformers     │  ← applies diff/focus/highlight/error/word
│  + runHighlighterTask queue  │  ← (v1.3.0) serializes all Shiki calls
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│  rehypePerfectCodeBlocks     │  ← wraps <pre> in <figure class="pcb">
│  - reads data-meta           │  - maps Shiki classes → pcb__line--* namespace
│  - builds header bar         │  - adds gutter, copy button, caption
│  - applies keepBackground    │  - calls visitor hooks
│  - applies theme-aware       │  - (v1.3.0) applies wordDiff post-processing
│    --pcb-* defaults (v1.3.0) │
└──────────────────────────────┘
    │
    ▼
  Final HTML (with inline --pcb-* theme-aware defaults on <pre>)
```

Key design decisions (learned from rehype-pretty-code + expressive-code + VitePress):

1. **Let Shiki do the work** — we delegate line splitting, diff detection, and word highlighting to Shiki's official transformers; we just remap their classes (`diff add` → `pcb__line--add`, etc.)
2. **Pass `meta: { __raw }` to Shiki** — this is the contract that lets all `@shikijs/transformers` work
3. **Cache by full theme spec** — dual-theme setups get one cached highlighter with both themes loaded
4. **Lazy-load languages** — any Shiki-bundled language just works, no preconfiguration needed
5. **Graceful unknown-language fallback** — filter out unknowns before `createHighlighter` (which throws synchronously) and fall back to `plaintext`
6. **`:where()` zero-specificity** — every default selector uses `:where(.pcb ...)` so user CSS always wins without `!important` arms races
7. **(v1.3.0) Mutually exclusive task queue** — all highlighter operations run inside `runHighlighterTask()`, preventing race conditions in parallel builds (from expressive-code)
8. **(v1.3.0) Theme-aware CSS variable defaults** — `--pcb-*` defaults are derived from the loaded Shiki theme with WCAG contrast enforcement, applied as inline styles on `<pre>` (from expressive-code)
9. **(v1.3.0) Disposable highlighter** — `disposeHighlighter()` releases the WASM engine + grammars for long-running dev servers (from VitePress)
10. **(v1.3.0) SPA-robust copy button** — event delegation + MutationObserver + `astro:page-load` for React/Vue/Astro view transitions (from VitePress + expressive-code)

## Testing

The package ships with **1092 tests** across seven suites:

```bash
npm test
```

| Suite | Tests | What it covers |
| --- | ---: | --- |
| `test-meta-parser.mjs` | 161 | Fence-meta parser: title, `{1,3-5}`, `/word/`, `ln{N}`, caption, flags, edge cases |
| `test-dom-structure.mjs` | 113 | Output HTML structure: `<figure>`, `<pre>`, `<code>`, header bar, gutter, copy button |
| `test-options.mjs` | 108 | All plugin options: ornaments, structure, modes, engine, customization, hooks, styling |
| `test-notations.mjs` | 51 | VitePress-style `// [!code xxx]` inline notations + Docusaurus-style magic comments |
| `test-security.mjs` | 49 | CSP nonce support, XSS prevention, `aria-*` accessibility attributes |
| `test-integration.mjs` | 69 | End-to-end integration with remark/rehype/rehype-raw pipelines |
| `test-regression.mjs` | 91 | Regression tests for historical bugs (issues #1–#10) |
| `test-css.mjs` | 120 | CSS output: `--pcb-*` variables, `:where()` specificity, dual-theme switching |
| `test-edge-cases.mjs` | 50 | Basic blocks, all meta flags, language detection, highlighting ranges, diff, presets, escape handling |
| `stress-tests.mjs` | 17 | 100-line blocks, CRLF, tabs, unicode, concurrent overrides, all-options-at-once |
| `new-feature-tests.mjs` | 43 | VitePress notations, magic comments, word highlights, dual themes, captions, visitor hooks, configurable copy button, terminal auto-detection, filename extraction |
| `test-issue-12.mjs` | 28 | Regression: case-insensitive language loader (`JS`/`TypeScript`/`Python`) |
| `test-issue-11.mjs` | 51 | Regression: line-range stack overflow (`{1-1000000}` DoS vector) |
| `test-architecture-patterns.mjs` | 41 | v1.3.0 architecture patterns: task queue, theme-aware defaults, dispose, SPA copy button, word-diff |

## Comparison with alternatives

| Feature | rehype-perfect-code-blocks | rehype-pretty-code | VitePress | Docusaurus | Expressive Code |
| --- | --- | --- | --- | --- | --- |
| Header bar + filename | ✅ | ✅ | ✅ | ✅ | ✅ |
| Line numbers | ✅ | ✅ | ✅ | ✅ | ✅ |
| Copy button | ✅ (configurable) | ⚠️ (separate pkg) | ✅ | ✅ | ✅ |
| `{1,3-5}` meta | ✅ | ✅ | ✅ | ✅ | ✅ |
| `// [!code highlight]` | ✅ | ❌ | ✅ | ❌ | ✅ |
| `// [!code focus]` | ✅ | ❌ | ✅ | ❌ | ✅ |
| `// [!code ++]` / `[!code --]` | ✅ | ❌ | ✅ | ❌ | ✅ |
| `// [!code error]` / `[!code warning]` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `// highlight-next-line` | ✅ | ❌ | ❌ | ✅ | ❌ |
| Custom magic comments | ✅ | ❌ | ❌ | ✅ | ❌ |
| `/word/` meta | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Word-level diff** (v1.3.0) | ✅ (`wordDiff: true`) | ❌ | ❌ | ❌ | ✅ (`plugin-text-markers`) |
| `caption="..."` | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dual themes via CSS vars | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| **Theme-aware color defaults** (v1.3.0) | ✅ (WCAG-enforced) | ❌ | ❌ | ❌ | ✅ |
| Auto terminal frame | ✅ | ❌ | ❌ | ❌ | ✅ |
| Filename from comment | ✅ | ❌ | ❌ | ❌ | ✅ |
| Visible whitespace | ✅ | ❌ | ❌ | ❌ | ❌ |
| Indent guides | ✅ | ❌ | ❌ | ❌ | ❌ |
| Visitor hooks | ✅ | ✅ | ❌ | ❌ | ❌ |
| `filterMetaString` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `getHighlighter` escape hatch | ✅ | ✅ | ❌ | ❌ | ❌ |
| User-supplied Shiki transformers | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Highlighter task queue** (v1.3.0) | ✅ (`runHighlighterTask`) | ❌ | ❌ | ❌ | ✅ |
| **`disposeHighlighter()` lifecycle** (v1.3.0) | ✅ | ❌ | ✅ | ❌ | ❌ |
| **SPA-robust copy button** (v1.3.0) | ✅ (MutationObserver + `astro:page-load`) | ❌ (inline `onclick`) | ✅ (event delegation) | ✅ (React) | ✅ (MutationObserver) |
| Zero-specificity CSS vars | ✅ | ❌ | ❌ | ❌ | ⚠️ |
| Astro integration | ✅ | ⚠️ | ❌ | ❌ | ✅ |
| Standalone rehype | ✅ | ✅ | ❌ | ❌ | ❌ |

## File structure

```
rehype-perfect-code-blocks/
├── package.json
├── tsconfig.json
├── README.md
├── CHANGELOG.md
├── LICENSE
├── .gitignore
├── .npmignore
├── examples/
│   └── astro.config.mjs
├── src/
│   ├── types.ts              ← full options + ParsedMeta + ResolvedBlock
│   ├── meta.ts               ← fence-meta parser (title, {1,3-5}, /word/, ln{N}, caption, flags)
│   ├── remark.ts             ← remarkPreserveCodeMeta (carries meta to hast)
│   ├── shiki.ts              ← Shiki caller: transformers, dual themes, lazy lang loading, task queue (v1.3.0)
│   ├── transformer.ts        ← hast walker: <pre> → <figure class="pcb">, word-diff post-processing (v1.3.0)
│   ├── copy-script.ts        ← ~1.2KB inline copy-button client script (event delegation + MutationObserver, v1.3.0)
│   ├── color-utils.ts        ← (v1.3.0) color manipulation + WCAG contrast + theme-aware default computation
│   ├── word-diff.ts          ← (v1.3.0) LCS-based word diff algorithm
│   ├── styles.css            ← full stylesheet with --pcb-* variables
│   ├── astro.ts              ← Astro integration (one-liner)
│   ├── index.ts              ← standalone rehype plugin entry (exports runHighlighterTask, disposeHighlighter, wordDiff, hasChanges)
│   └── vite-raw.d.ts         ← type shim for ?raw imports
├── dist/                     ← built ESM + .d.ts + styles.css
├── test-meta-parser.mjs             ← 161 tests
├── test-dom-structure.mjs           ← 113 tests
├── test-options.mjs                 ← 108 tests
├── test-notations.mjs               ← 51 tests
├── test-security.mjs                ← 49 tests
├── test-integration.mjs             ← 69 tests
├── test-regression.mjs              ← 91 tests
├── test-css.mjs                     ← 120 tests
├── test-edge-cases.mjs              ← 50 tests
├── stress-tests.mjs                 ← 17 tests
├── new-feature-tests.mjs            ← 43 tests
├── test-issue-12.mjs                ← 28 tests (case-insensitive lang loader)
├── test-issue-11.mjs                ← 51 tests (line-range stack overflow)
└── test-architecture-patterns.mjs   ← 41 tests (v1.3.0 patterns)
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history. Highlights:

- **v1.3.0** — Adopted 5 architectural patterns from community packages (highlighter task queue, theme-aware color defaults, `disposeHighlighter()` lifecycle, SPA-robust copy button, word-level diff).
- **v1.2.2** — Fixed `{1-1000000}` line-range stack overflow DoS (issue #11).
- **v1.2.1** — Fixed case-sensitive language loader rejecting `JS`/`TypeScript`/`Python` (issue #12).
- **v1.2.0** — Adopted 23 features from community competitors (transformers, terminal frames, i18n, CSP nonces, etc.).
- **v1.1.x** — Accessibility, performance, and security improvements.
- **v1.0.0** — Initial release.

## License

MIT
