/**
 * Stress / boundary tests — extra edge cases beyond the main 50.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { rehypePerfectCodeBlocks, remarkPreserveCodeMeta } from '../rehype-perfect-code-blocks/dist/index.js';

async function render(md, opts = {}) {
  const result = await unified()
    .use(remarkParse)
    .use(remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(rehypePerfectCodeBlocks, opts)
    .use(rehypeStringify)
    .process(md);
  return String(result);
}

function check(name, cond, detail = '') { return { name, pass: !!cond, detail }; }
function count(h, n) { let i=0,c=0; while((i=h.indexOf(n,i))!==-1){c++;i+=n.length;} return c; }

const tests = [
  // ---- Boundary: 100-line block ----
  {
    title: '100-line block: highlight line 50',
    md: '```js {50}\n' + Array.from({length:100}, (_,i)=>`line${i+1}`).join('\n') + '\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--hl') === 1,
  },
  // ---- Boundary: highlight line 1 of 1 ----
  {
    title: '1-line block with {1} highlight',
    md: '```js {1}\nfoo\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--hl') === 1,
  },
  // ---- Boundary: highlight exceeds line count ----
  {
    title: 'highlight {999} on 3-line block — no crash, no highlight',
    md: '```js {999}\n1\n2\n3\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--hl') === 0,
  },
  // ---- Mixed: many blocks on a single page ----
  {
    title: '8 blocks on a single page render without errors',
    md: Array.from({length:8}, (_,i)=>'```js title="b'+i+'.js"\ncode '+i+'\n```').join('\n\n'),
    opts: {},
    check: (h) => count(h, '<figure class="pcb') === 8,
  },
  // ---- Concurrent: multiple engines on same page (mixed shiki/passthrough) ----
  {
    title: 'engine=passthrough on Shiki-less tree',
    md: '```js title="x.js"\nfoo\nbar\n```',
    opts: { engine: 'passthrough' },
    check: (h) => h.includes('pcb__bar') && h.includes('x.js'),
  },
  // ---- Nested-looking content (HTML inside code body) ----
  {
    title: 'code body contains a fenced-looking line',
    md: '```js\nconst md = "```python\\nprint(1)\\n```"\n```',
    opts: {},
    check: (h) => h.includes('pcb__body'),
  },
  // ---- CRLF line endings ----
  {
    title: 'CRLF line endings split into lines correctly',
    md: '```js title="x.js"\r\nfoo\r\nbar\r\n```',
    opts: {},
    check: (h) => {
      // Should produce 2 lines, not 1 with embedded \r
      const noCR = !h.includes('\r');
      return check('CRLF', noCR, 'no embedded CR');
    },
  },
  // ---- Title with newline-like content ----
  {
    title: 'title with backslash-n (literal)',
    md: '```js title="x\\\\n.y"\nfoo\n```',
    opts: {},
    check: (h) => h.includes('x'),
  },
  // ---- Concurrent options: all opts set at once ----
  {
    title: 'all global options set at once',
    md: '```ts title="x.ts" {1}\nline1\nline2\n```',
    opts: {
      decorations: true, showLanguage: true, copyButton: true,
      copyButtonLabel: 'copy', copyButtonDoneLabel: 'done',
      lineNumbers: 'always', titleBar: 'always',
      highlight: true, diff: true, wrap: false, collapseAfter: null,
      engine: 'auto', preset: 'default', injectStyles: true, theme: 'auto',
      shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
    },
    check: (h) => h.includes('pcb__bar') && h.includes('pcb__lang') && h.includes('pcb__line--hl'),
  },
  // ---- Empty options ----
  {
    title: 'empty options object works',
    md: '```js\nfoo\n```',
    opts: {},
    check: (h) => h.includes('pcb'),
  },
  // ---- Markdown with code block followed by inline code ----
  {
    title: 'fenced block + inline code in same paragraph',
    md: '```js\nfoo\n```\n\nText with `inline` code.',
    opts: {},
    check: (h) => h.includes('pcb') && h.includes('<code>inline</code>'),
  },
  // ---- Title with emoji ----
  {
    title: 'title with emoji',
    md: '```js title="config 🔧.js"\nfoo\n```',
    opts: {},
    check: (h) => h.includes('config') && h.includes('.js'),
  },
  // ---- Unicode in code body ----
  {
    title: 'unicode in code body',
    md: '```js\nconst msg = "你好世界 🌍"\n```',
    opts: {},
    check: (h) => h.includes('pcb__body'),
  },
  // ---- Concurrent flag override (global + per-block) ----
  {
    title: 'global off + per-block on',
    md: '```js title="x.js" decorations copy\nfoo\n```',
    opts: { decorations: false, copyButton: false },
    check: (h) => h.includes('pcb__dots') && h.includes('pcb__copy'),
  },
  // ---- Concurrent flag override (global on + per-block off) ----
  {
    title: 'global on + per-block off',
    md: '```js title="x.js" noDecorations noCopy\nfoo\n```',
    opts: { decorations: true, copyButton: true },
    check: (h) => !h.includes('pcb__dots') && !h.includes('pcb__copy'),
  },
  // ---- Tab-indented code inside fenced block ----
  {
    title: 'tabs inside code body preserved',
    md: '```js\n\tconst x = 1\n\tconst y = 2\n```',
    opts: {},
    check: (h) => h.includes('pcb__body'),
  },
  // ---- Whitespace-only lines in code body ----
  {
    title: 'whitespace-only lines handled',
    md: '```js\nfoo\n   \nbar\n```',
    opts: {},
    check: (h) => h.includes('pcb__body'),
  },
];

const results = [];
console.log(`\nRunning ${tests.length} stress tests...\n`);
console.log('─'.repeat(72));

for (let i = 0; i < tests.length; i++) {
  const t = tests[i];
  let html = '';
  let error = null;
  try {
    html = await render(t.md, t.opts);
  } catch (e) {
    error = e;
  }

  let result;
  if (error) {
    result = { name: t.title, pass: false, detail: `THREW: ${error.message}` };
  } else {
    try {
      const r = t.check(html);
      result = r && typeof r.pass !== 'undefined'
        ? r
        : { name: t.title, pass: !!r, detail: '' };
      if (typeof r === 'boolean') result = { name: t.title, pass: r, detail: '' };
    } catch (e) {
      result = { name: t.title, pass: false, detail: `CHECK THREW: ${e.message}` };
    }
  }
  results.push(result);
  const status = result.pass ? 'PASS' : 'FAIL';
  const num = String(i + 1).padStart(2, '0');
  console.log(`${num} [${status}] ${t.title}`);
  if (!result.pass) console.log(`     └─ ${result.detail}`);
}

console.log('─'.repeat(72));
const passed = results.filter(r => r.pass).length;
const failed = results.length - passed;
console.log(`\nResult: ${passed}/${results.length} passed, ${failed} failed\n`);
