/**
 * Generate a standalone HTML file showing the EXACT output the plugin produces.
 * Runs real markdown through the full unified pipeline (remarkParse →
 * remarkPreserveCodeMeta → remarkRehype → rehypePerfectCodeBlocks →
 * rehypeStringify) and wraps the resulting HTML in a complete document with
 * the plugin's bundled styles.css inlined.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { rehypePerfectCodeBlocks, remarkPreserveCodeMeta } from '../rehype-perfect-code-blocks/dist/index.js';
import { readFileSync, writeFileSync } from 'node:fs';

const CSS = readFileSync('/home/z/my-project/rehype-perfect-code-blocks/dist/styles.css', 'utf8');
const COPY_SCRIPT = readFileSync('/home/z/my-project/rehype-perfect-code-blocks/dist/copy-script.js', 'utf8')
  .replace(/^export const COPY_SCRIPT = `/, '')
  .replace(/`;\s*$/, '');

// A representative markdown document exercising every rendering mode.
const MARKDOWN = `# Sample documentation

Below is the actual output of the plugin. View source on this HTML file to
see the exact DOM structure.

## 1. Titled block with line numbers

\`\`\`ts title="src/env.ts"
export const API_URL = 'https://api.example.com'
export const TIMEOUT = 30000
export const RETRIES = 3
\`\`\`

## 2. Highlighted lines with focus mode

\`\`\`ts title="src/store.ts" {3,5-6}
import { createStore } from 'solid-js/store'

export const [state, setState] = createStore({
  count: 0,
  user: null as User | null,
  theme: 'dark' as 'dark' | 'light',
})
\`\`\`

## 3. Diff via // [!code ++] / [!code --]

\`\`\`json title="package.json"
{
  "name": "my-app",
  // [!code --]
  "version": "1.2.0",
  // [!code ++]
  "version": "1.3.0",
  "license": "MIT"
}
\`\`\`

## 4. Error and warning lines

\`\`\`ts title="validator.ts"
const x = getUserInput() // [!code error]
if (!x) {
  console.warn('empty input') // [!code warning]
}
\`\`\`

## 5. Word highlighting via /word/

\`\`\`js /foo/ /bar/
const foo = 'foo'
function bar() { return foo + foo }
bar() + bar()
\`\`\`

## 6. VitePress notations combined

\`\`\`ts title="example.ts"
const a = 1 // [!code highlight]
const b = 2 // [!code focus]
const c = 3 // [!code ++]
const d = 4 // [!code --]
const e = 5 // [!code error]
const f = 6 // [!code warning]
\`\`\`

## 7. Caption below the block

\`\`\`js title="auth.js" caption="Source: src/lib/auth.js — MIT licensed"
export function signIn(user) {
  return fetch('/api/login', { method: 'POST', body: JSON.stringify(user) })
}
\`\`\`

## 8. Wrap mode

\`\`\`js title="config.js" wrap
export const config = { apiBase: 'https://api.example.com/v2/long-endpoint-path', timeout: 30000, retries: 5, logLevel: 'info' }
\`\`\`

## 9. Collapsible block

\`\`\`js title="long-output.log" collapse
[INFO] booting worker...
[INFO] connecting to postgres://localhost:5432
[INFO] running migrations 0001..0042
[INFO] listening on :3000
[INFO] ready
\`\`\`

## 10. Start line numbers at N

\`\`\`js title="snippet.js" ln{42}
// continuation of the original file
function lateInit() {
  return true
}
\`\`\`

## 11. Auto terminal frame (sh/bash/zsh)

\`\`\`bash title="setup.sh"
$ npm install
$ npm run build
$ npm start
\`\`\`

## 12. All ornaments off

\`\`\`ts title="minimal.ts" noDecorations noLang noCopy
const x: number = 1
\`\`\`

## 13. Plain block (no title, no lang)

\`\`\`
just plain text
no language
\`\`\`
`;

// Render through the plugin pipeline using default options.
const rendered = String(
  await unified()
    .use(remarkParse)
    .use(remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(rehypePerfectCodeBlocks, {
      // Default options (matching what astro.config.mjs would set)
      decorations: true,
      showLanguage: true,
      copyButton: true,
      shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
    })
    .use(rehypeStringify)
    .process(MARKDOWN)
);

const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>rehype-perfect-code-blocks — exact plugin output</title>
<!-- ====================================================================
     rehype-perfect-code-blocks styles.css — inlined verbatim from dist/
     ==================================================================== -->
<style>
${CSS}

/* Page chrome (NOT part of the plugin) */
body {
  margin: 0;
  background: #ffffff;
  color: #1f2328;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  padding: 2rem 1.5rem 6rem;
  line-height: 1.6;
}
.wrap { max-width: 880px; margin: 0 auto; }
h1, h2 { color: #1f2328; }
h1 { font-size: 1.6rem; margin: 0 0 0.5rem; }
h2 { font-size: 1.1rem; margin: 2.5rem 0 0.5rem; color: #0969da; }
.lede { color: #636c76; font-size: 0.95rem; margin: 0 0 2rem; }
</style>
</head>
<body>
<div class="wrap">
  <h1>rehype-perfect-code-blocks — exact plugin output</h1>
  <p class="lede">
    Everything below this line is the actual HTML produced by running the
    plugin's default pipeline on a markdown file. The styles are inlined
    verbatim from <code>dist/styles.css</code>. View page source to inspect
    the DOM structure the plugin emits.
  </p>

${rendered}

</div>

<!-- ====================================================================
     rehype-perfect-code-blocks copy-script.ts — inlined verbatim from dist/
     ==================================================================== -->
<script>
${COPY_SCRIPT}
</script>
</body>
</html>`;

writeFileSync('/home/z/my-project/download/code-blocks-preview.html', html);
console.log('Written → /home/z/my-project/download/code-blocks-preview.html');
console.log(`Size: ${(html.length / 1024).toFixed(1)} KB`);
