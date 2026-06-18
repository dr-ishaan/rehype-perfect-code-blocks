# rehype-perfect-code-blocks

Beautiful, configurable code blocks for Astro, MDX, and any rehype pipeline. Built on Shiki, inspired by [rehype-pretty-code](https://github.com/rehype-pretty/rehype-pretty-code), [VitePress](https://vitepress.dev/), [Docusaurus](https://docusaurus.io/), and [Expressive Code](https://expressive-code.com/).

## Why this exists

- **One-line Astro setup** — `perfectCode()` integration does everything
- **All VitePress notations work** — `// [!code highlight]`, `// [!code focus]`, `// [!code ++]`, `// [!code --]`, `// [!code error]`, `// [!code warning]`, `// [!code word:foo]`
- **Docusaurus magic comments** — `// highlight-next-line`, `// highlight-start` / `// highlight-end`
- **rehype-pretty-code meta syntax** — `title="..."`, `{1,3-5}`, `/word/`, `/word/3-5#id`
- **Auto terminal frame** for `sh`/`bash`/`zsh` etc., editor frame for everything else
- **Dual themes** via Shiki's `themes: { light, dark }` — emits `--shiki-light` / `--shiki-dark` CSS vars
- **CSS variables everywhere** — every visual property is a `--pcb-*` var, scoped with `:where()` for zero-specificity
- **Configurable copy button** — hover mode, custom icons, custom duration, custom labels
- **110 tests pass** — edge cases, stress tests, and feature parity tests

## Install

```bash
npm install rehype-perfect-code-blocks
```

Optional peers: `astro` (for the integration), `shiki` (only if you set `engine: 'shiki'`).

## Quick start (Astro)

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config';
import perfectCode from 'rehype-perfect-code-blocks/astro';

export default defineConfig({
  integrations: [
    perfectCode({
      // All options are optional — these are the defaults
      decorations: true,
      showLanguage: true,
      copyButton: true,
      shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
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
import rehypeStringify from 'rehype-stringify';
import {
  rehypePerfectCodeBlocks,
  remarkPreserveCodeMeta,
} from 'rehype-perfect-code-blocks';
import 'rehype-perfect-code-blocks/styles.css';

const html = await unified()
  .use(remarkParse)
  .use(remarkPreserveCodeMeta)   // ← required: preserves fence meta
  .use(remarkRehype)
  .use(rehypePerfectCodeBlocks, { copyButton: true })
  .use(rehypeStringify)
  .process(markdown);
```

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
| `focus` | `boolean` | `true` | Enable `// [!code focus]` |
| `errorLevels` | `boolean` | `true` | Enable `// [!code error]` / `[!code warning]` |
| `wrap` | `boolean` | `false` | Default wrap mode |
| `collapseAfter` | `number \| null` | `null` | Auto-collapse blocks > N lines |
| `showWhitespace` | `false \| 'all' \| 'boundary' \| 'trailing' \| 'leading'` | `false` | Visible whitespace |
| `indentGuides` | `boolean \| number` | `false` | Render indent guides |
| `caption` | `boolean` | `true` | Render `caption="..."` meta as `<figcaption>` |

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

### Styling

| Option | Type | Default |
| --- | --- | --- |
| `preset` | `'default' \| 'terminal' \| 'minimal'` | `'default'` |
| `injectStyles` | `boolean` | `true` |
| `theme` | `'auto' \| 'dark' \| 'light'` | `'auto'` |

## Theming

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
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│  rehypePerfectCodeBlocks     │  ← wraps <pre> in <figure class="pcb">
│  - reads data-meta           │  - maps Shiki classes → pcb__line--* namespace
│  - builds header bar         │  - adds gutter, copy button, caption
│  - applies keepBackground    │  - calls visitor hooks
└──────────────────────────────┘
    │
    ▼
  Final HTML
```

Key design decisions (learned from rehype-pretty-code):

1. **Let Shiki do the work** — we delegate line splitting, diff detection, and word highlighting to Shiki's official transformers; we just remap their classes (`diff add` → `pcb__line--add`, etc.)
2. **Pass `meta: { __raw }` to Shiki** — this is the contract that lets all `@shikijs/transformers` work
3. **Cache by full theme spec** — dual-theme setups get one cached highlighter with both themes loaded
4. **Lazy-load languages** — any Shiki-bundled language just works, no preconfiguration needed
5. **Graceful unknown-language fallback** — filter out unknowns before `createHighlighter` (which throws synchronously) and fall back to `plaintext`
6. **`:where()` zero-specificity** — every default selector uses `:where(.pcb ...)` so user CSS always wins without `!important` arms races

## Testing

The package ships with 110 tests across three suites:

```bash
npm test
```

| Suite | Tests | What it covers |
| --- | --- | --- |
| `test-edge-cases.mjs` | 50 | Basic blocks, all meta flags, language detection, highlighting ranges, diff, presets, escape handling, multiple blocks |
| `stress-tests.mjs` | 17 | 100-line blocks, CRLF, tabs, unicode, concurrent overrides, all-options-at-once |
| `new-feature-tests.mjs` | 43 | VitePress notations, magic comments, word highlights, dual themes, captions, visitor hooks, configurable copy button, terminal auto-detection, filename extraction |

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
| `caption="..."` | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dual themes via CSS vars | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Auto terminal frame | ✅ | ❌ | ❌ | ❌ | ✅ |
| Filename from comment | ✅ | ❌ | ❌ | ❌ | ✅ |
| Visible whitespace | ✅ | ❌ | ❌ | ❌ | ❌ |
| Indent guides | ✅ | ❌ | ❌ | ❌ | ❌ |
| Visitor hooks | ✅ | ✅ | ❌ | ❌ | ❌ |
| `filterMetaString` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `getHighlighter` escape hatch | ✅ | ✅ | ❌ | ❌ | ❌ |
| User-supplied Shiki transformers | ✅ | ✅ | ❌ | ❌ | ❌ |
| Zero-specificity CSS vars | ✅ | ❌ | ❌ | ❌ | ⚠️ |
| Astro integration | ✅ | ⚠️ | ❌ | ❌ | ✅ |
| Standalone rehype | ✅ | ✅ | ❌ | ❌ | ❌ |

## File structure

```
rehype-perfect-code-blocks/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
├── .gitignore
├── .npmignore
├── examples/
│   └── astro.config.mjs
├── src/
│   ├── types.ts              ← full options + ParsedMeta + ResolvedBlock
│   ├── meta.ts               ← fence-meta parser (title, {1,3-5}, /word/, ln{N}, caption, flags)
│   ├── remark.ts             ← remarkPreserveCodeMeta (carries meta to hast)
│   ├── shiki.ts              ← Shiki caller: transformers, dual themes, lazy lang loading
│   ├── transformer.ts        ← hast walker: <pre> → <figure class="pcb">
│   ├── copy-script.ts        ← ~500-byte inline copy-button client script
│   ├── styles.css            ← full stylesheet with --pcb-* variables
│   ├── astro.ts              ← Astro integration (one-liner)
│   ├── index.ts              ← standalone rehype plugin entry
│   └── vite-raw.d.ts         ← type shim for ?raw imports
├── dist/                     ← built ESM + .d.ts + styles.css
├── test-edge-cases.mjs       ← 50 tests
├── stress-tests.mjs          ← 17 tests
└── new-feature-tests.mjs     ← 43 tests
```

## License

MIT
