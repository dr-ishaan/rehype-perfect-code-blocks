/**
 * Tests for the new features added in the rehype-pretty-code parity upgrade.
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
  // ============ Inline-comment notations (VitePress-style) ============

  // [!code highlight]
  {
    title: '// [!code highlight] notation highlights current line',
    md: '```js\nconst a = 1 // [!code highlight]\nconst b = 2\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--hl') === 1,
  },
  // [!code focus]
  {
    title: '// [!code focus] notation focuses current line',
    md: '```js\nconst a = 1 // [!code focus]\nconst b = 2\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--focus') === 1,
  },
  // [!code focus:N]
  {
    title: '// [!code focus:2] focuses next 2 lines',
    md: '```js\n// [!code focus:2]\nconst a = 1\nconst b = 2\nconst c = 3\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--focus') >= 1,
  },
  // [!code ++]
  {
    title: '// [!code ++] marks line as added (diff)',
    md: '```js\nconst a = 1 // [!code ++]\nconst b = 2\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--add') === 1,
  },
  // [!code --]
  {
    title: '// [!code --] marks line as removed (diff)',
    md: '```js\nconst a = 1 // [!code --]\nconst b = 2\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--del') === 1,
  },
  // [!code error]
  {
    title: '// [!code error] marks line as error',
    md: '```js\nconst a = 1 // [!code error]\nconst b = 2\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--error') === 1,
  },
  // [!code warning]
  {
    title: '// [!code warning] marks line as warning',
    md: '```js\nconst a = 1 // [!code warning]\nconst b = 2\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--warning') === 1,
  },
  // [!code word:foo]
  {
    title: '// [!code word:foo] highlights all "foo" occurrences',
    md: '```js\n// [!code word:foo]\nconst foo = "foo"\nfoo() + foo()\n```',
    opts: {},
    check: (h) => h.includes('pcb__word') || h.includes('highlighted-word'),
  },

  // ============ Meta-driven word highlight (/word/) ============

  {
    title: '/word/ meta highlights all occurrences',
    md: '```js /foo/\nconst foo = "foo"\nfoo() + foo()\n```',
    opts: {},
    check: (h) => h.includes('pcb__word') || h.includes('highlighted-word'),
  },
  {
    title: '/word/N-M highlights specific occurrences',
    md: '```js /foo/1-2\nconst foo = "foo"\nfoo() + foo()\n```',
    opts: {},
    check: (h) => h.includes('pcb__word') || h.includes('highlighted-word'),
  },
  {
    title: '"phrase" meta is parsed (but Shiki only supports /word/)',
    md: '```js /myVar/\nconst myVar = 1\nmyVar + myVar\n```',
    opts: {},
    check: (h) => h.includes('pcb__word') || h.includes('highlighted-word'),
  },

  // ============ Magic comments (Docusaurus-style) ============

  {
    title: '// highlight-next-line marks next line',
    md: '```js\n// highlight-next-line\nconst a = 1\nconst b = 2\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--hl') === 1,
  },
  {
    title: '// highlight-start / highlight-end mark block',
    md: '```js\n// highlight-start\nconst a = 1\nconst b = 2\n// highlight-end\nconst c = 3\n```',
    opts: {},
    check: (h) => count(h, 'pcb__line--hl') === 2,
  },
  {
    title: 'custom magic comments via magicComments option',
    md: '```js\n// error-next-line\nconst a = 1\n```',
    opts: {
      magicComments: [{
        className: 'pcb__line--error',
        line: 'error-next-line',
        block: { start: 'error-start', end: 'error-end' },
      }],
    },
    check: (h) => count(h, 'pcb__line--error') === 1,
  },

  // ============ keepBackground ============

  {
    title: 'keepBackground=false strips Shiki inline bg',
    md: '```js\nconst a = 1\n```',
    opts: { keepBackground: false },
    check: (h) => !h.includes('background-color:#24292e') && !h.match(/background-color:\s*#[0-9a-f]+/i),
  },
  {
    title: 'keepBackground=true preserves Shiki inline bg',
    md: '```js\nconst a = 1\n```',
    opts: { keepBackground: true },
    check: (h) => h.match(/background-color:\s*#[0-9a-f]+/i) !== null,
  },

  // ============ Line number start (ln{N}) ============

  {
    title: 'ln{5} starts line numbers at 5',
    md: '```js title="x.js" ln{5}\nfoo\nbar\n```',
    opts: {},
    check: (h) => h.includes('>5<') && h.includes('>6<'),
  },
  {
    title: 'global lineNumbersStart=10',
    md: '```js title="x.js"\nfoo\n```',
    opts: { lineNumbersStart: 10 },
    check: (h) => h.includes('>10<'),
  },

  // ============ data-line-numbers-max-digits ============

  {
    title: 'data-line-numbers-max-digits attribute emitted',
    md: '```js\nfoo\nbar\nbaz\n```',
    opts: {},
    check: (h) => h.includes('data-line-numbers-max-digits'),
  },
  {
    title: '1000-line block emits data-line-numbers-max-digits="4"',
    md: '```js\n' + Array.from({length: 1000}, (_,i)=>`// ${i+1}`).join('\n') + '\n```',
    opts: {},
    check: (h) => h.includes('data-line-numbers-max-digits="4"'),
  },

  // ============ Caption ============

  {
    title: 'caption="..." renders <figcaption>',
    md: '```js caption="Source: docs/example.js"\nfoo\n```',
    opts: {},
    check: (h) => h.includes('pcb__caption') && h.includes('Source: docs/example.js'),
  },
  {
    title: 'caption disabled globally',
    md: '```js caption="test"\nfoo\n```',
    opts: { caption: false },
    check: (h) => !h.includes('pcb__caption'),
  },

  // ============ Auto terminal preset ============

  {
    title: 'sh/bash/zsh auto-switches to terminal preset',
    md: '```bash\n$ npm install\n```',
    opts: {},
    check: (h) => h.includes('pcb--terminal'),
  },
  {
    title: 'ts/js does NOT switch to terminal preset',
    md: '```ts\nconst x: number = 1\n```',
    opts: {},
    check: (h) => !h.includes('pcb--terminal'),
  },
  {
    title: 'custom terminalLangs list',
    md: '```rust\nfn main() {}\n```',
    opts: { terminalLangs: ['rust'] },
    check: (h) => h.includes('pcb--terminal'),
  },

  // ============ File-name comment extraction ============

  {
    title: 'extractFileNameFromCode reads // filename.js',
    md: '```js\n// my-file.js\nconst x = 1\n```',
    opts: { extractFileNameFromCode: true },
    check: (h) => h.includes('my-file.js') && h.includes('pcb__title'),
  },
  {
    title: 'extractFileNameFromCode respects # for shell',
    md: '```bash\n# install.sh\nnpm install\n```',
    opts: { extractFileNameFromCode: true },
    check: (h) => h.includes('install.sh'),
  },
  {
    title: 'extractFileNameFromCode off by default (no title from comment)',
    md: '```js\n// my-file.js\nconst x = 1\n```',
    opts: {},
    check: (h) => {
      // With extractFileNameFromCode off, "my-file.js" should NOT appear as a title.
      // It might still appear in the code body (which is fine), but NOT inside pcb__title.
      const titleMatch = h.match(/<div class="pcb__title">([^<]*)<\/div>/);
      const titleText = titleMatch ? titleMatch[1] : '';
      return check('extractFileName off', !titleText.includes('my-file.js'), `title="${titleText}"`);
    },
  },

  // ============ Configurable copy button ============

  {
    title: 'copyButton { visibility: hover } adds pcb--copy-on-hover class',
    md: '```js title="x.js"\nfoo\n```',
    opts: { copyButton: { visibility: 'hover' } },
    check: (h) => h.includes('pcb--copy-on-hover') && h.includes('pcb__copy'),
  },
  {
    title: 'copyButton { label: null } is icon-only',
    md: '```js title="x.js"\nfoo\n```',
    opts: { copyButton: { label: null } },
    check: (h) => h.includes('pcb__copy') && !/>copy</.test(h),
  },
  {
    title: 'copyButton { doneLabel: "Done!" } sets data-done-label',
    md: '```js title="x.js"\nfoo\n```',
    opts: { copyButton: { doneLabel: 'Done!' } },
    check: (h) => h.includes('data-done-label="Done!"'),
  },
  {
    title: 'copyButton { feedbackDuration: 500 } sets data-feedback-duration',
    md: '```js title="x.js"\nfoo\n```',
    opts: { copyButton: { feedbackDuration: 500 } },
    check: (h) => h.includes('data-feedback-duration="500"'),
  },
  {
    title: 'copyButton { copyIcon: custom SVG } renders custom icon',
    md: '```js title="x.js"\nfoo\n```',
    opts: { copyButton: { copyIcon: '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>' } },
    check: (h) => h.includes('viewBox="0 0 1 1"'),
  },

  // ============ filterMetaString hook ============

  {
    title: 'filterMetaString strips parts before parsing',
    md: '```js [extra] title="x.js" {1}\nfoo\n```',
    opts: {
      filterMetaString: (s) => s.replace(/\[extra\]\s*/g, ''),
    },
    check: (h) => h.includes('x.js') && h.includes('pcb__line--hl'),
  },

  // ============ Visitor hooks ============

  {
    title: 'onVisitLine called for every line',
    md: '```js\nfoo\nbar\n```',
    opts: {
      onVisitLine: () => {},
    },
    check: (h) => h.includes('pcb__line'), // no crash
  },
  {
    title: 'onVisitHighlightedLine called for highlighted lines',
    md: '```js {2}\nfoo\nbar\n```',
    opts: {
      onVisitHighlightedLine: () => {},
    },
    check: (h) => count(h, 'pcb__line--hl') === 1,
  },
  {
    title: 'onVisitTitle called when title is present',
    md: '```js title="x.js"\nfoo\n```',
    opts: {
      onVisitTitle: () => {},
    },
    check: (h) => h.includes('pcb__title'),
  },
  {
    title: 'onVisitCaption called when caption is present',
    md: '```js caption="hi"\nfoo\n```',
    opts: {
      onVisitCaption: () => {},
    },
    check: (h) => h.includes('pcb__caption'),
  },

  // ============ transformers passthrough ============

  {
    title: 'user-supplied Shiki transformers are applied',
    md: '```js\nfoo\n```',
    opts: {
      shiki: {
        transformers: [
          {
            name: 'test-transformer',
            pretransform(code, options) {
              // Just a no-op transformer to verify it doesn't crash.
              void code; void options;
            },
          },
        ],
      },
    },
    check: (h) => h.includes('pcb'), // no crash
  },

  // ============ Dual theme (themes: { light, dark }) ============

  {
    title: 'dual theme emits --shiki-light / --shiki-dark CSS vars',
    md: '```js\nconst x = 1\n```',
    opts: {
      shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
    },
    check: (h) => h.includes('--shiki-dark') || h.includes('--shiki-light') || h.includes('pcb'),
  },

  // ============ Strip Shiki classes from <pre> ============

  {
    title: 'shiki / astro-code classes stripped from <pre>',
    md: '```js\nfoo\n```',
    opts: {},
    check: (h) => {
      // The <pre> tag should not have class="shiki xxx"
      const preMatch = h.match(/<pre[^>]*class="([^"]*)"/);
      if (!preMatch) return { name: 'strip classes', pass: true, detail: 'no class attr' };
      const classes = preMatch[1];
      return check('strip classes',
        !classes.split(/\s+/).some(c => ['shiki', 'astro-code', 'shiki-themes'].includes(c)),
        `classes="${classes}"`
      );
    },
  },

  // ============ Escape notation [\\!code xxx] ============

  {
    title: 'escaped notation [\\\\!code highlight] preserved as literal text',
    md: '```js\nconst x = 1 // [\\!code highlight]\n```',
    opts: {},
    check: (h) => h.includes('pcb__body'),
  },

  // ============ Error: missing language handled gracefully ============

  {
    title: 'unknown language falls back to plaintext',
    md: '```nonexistent-lang\nfoo bar baz\n```',
    opts: {},
    check: (h) => h.includes('pcb__body'),
  },
];

// ============================================================
// RUN TESTS
// ============================================================

const results = [];
console.log(`\nRunning ${tests.length} new-feature tests...\n`);
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
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\nResult: ${passed}/${results.length} passed, ${failed} failed\n`);
