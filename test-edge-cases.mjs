/**
 * Edge-case test harness for rehype-perfect-code-blocks.
 *
 * Run with: node /home/z/my-project/scripts/test-edge-cases.mjs
 *
 * Outputs:
 *   - Per-test pass/fail status to stdout
 *   - Serialized HTML for every test to /home/z/my-project/test-output/<n>.html
 *   - Visual gallery HTML to /home/z/my-project/download/test-report.html
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { rehypePerfectCodeBlocks, remarkPreserveCodeMeta } from '../rehype-perfect-code-blocks/dist/index.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('/home/z/my-project/test-output', { recursive: true });

const CSS = readFileSync(
  '/home/z/my-project/rehype-perfect-code-blocks/dist/styles.css',
  'utf8'
);

/** Run markdown through the plugin and return the resulting HTML body. */
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

/** Tiny assert helper that returns a result object. */
function check(name, condition, detail = '') {
  return { name, pass: !!condition, detail };
}

/** Extract first match of a regex from HTML, returns null if not found. */
function firstMatch(html, regex) {
  const m = html.match(regex);
  return m ? m[1] : null;
}

/** Count occurrences of a substring. */
function count(html, needle) {
  let n = 0, idx = 0;
  while ((idx = html.indexOf(needle, idx)) !== -1) { n++; idx += needle.length; }
  return n;
}

// ============================================================
// TEST CASES — each returns { name, pass, detail } and a render
// ============================================================

const tests = [
  // ---------- 1. Basic block ----------
  {
    title: 'basic block — no title, no lang',
    md: '```\nhello world\n```',
    opts: {},
    check: (html) => {
      const hasFigure = html.includes('class="pcb"');
      const hasPre = html.includes('<pre>');
      const hasCode = html.includes('<code') && (html.includes('<code>') || html.includes('<code '));
      const hasBar = html.includes('pcb__bar');
      return check('basic block',
        hasFigure && hasPre && hasCode,
        `figure=${hasFigure} pre=${hasPre} code=${hasCode} bar=${hasBar}`);
    },
  },

  // ---------- 2. Block with title only ----------
  {
    title: 'title only',
    md: '```js title="app.js"\nconsole.log(1)\n```',
    opts: {},
    check: (html) => {
      const hasTitle = html.includes('pcb__title') && html.includes('app.js');
      const hasLang = html.includes('pcb__lang') && html.includes('js');
      const hasGutter = html.includes('pcb__ln');
      const hasCopy = html.includes('pcb__copy');
      const hasDots = html.includes('pcb__dots');
      return check('title only',
        hasTitle && hasLang && hasGutter && hasCopy && hasDots,
        `title=${hasTitle} lang=${hasLang} gutter=${hasGutter} copy=${hasCopy} dots=${hasDots}`);
    },
  },

  // ---------- 3. Block with lang only ----------
  {
    title: 'lang only',
    md: '```ts\nconst x: number = 1\n```',
    opts: {},
    check: (html) => {
      const hasLang = html.includes('pcb__lang') && html.includes('ts');
      const noTitle = !html.includes('app.js');
      return check('lang only', hasLang && noTitle, `lang=${hasLang} noTitle=${noTitle}`);
    },
  },

  // ---------- 4. noLn flag ----------
  {
    title: 'noLn flag suppresses gutter',
    md: '```js title="x.js" noLn\nconsole.log(1)\n```',
    opts: {},
    check: (html) => {
      const hasTitle = html.includes('pcb__title');
      const noGutter = !html.includes('pcb__ln');
      return check('noLn flag', hasTitle && noGutter, `title=${hasTitle} noGutter=${noGutter}`);
    },
  },

  // ---------- 5. lineNumbers: 'always' ----------
  {
    title: 'global lineNumbers=always',
    md: '```\nfoo\nbar\n```',
    opts: { lineNumbers: 'always' },
    check: (html) => {
      const hasGutter = html.includes('pcb__ln');
      // Gutter should contain <span>1</span> and <span>2</span>
      const has1 = html.includes('>1<');
      const has2 = html.includes('>2<');
      return check('lineNumbers=always', hasGutter && has1 && has2, `gutter=${hasGutter} 1=${has1} 2=${has2}`);
    },
  },

  // ---------- 6. lineNumbers: 'never' ----------
  {
    title: 'global lineNumbers=never (even with title)',
    md: '```js title="x.js"\nfoo\n```',
    opts: { lineNumbers: 'never' },
    check: (html) => !html.includes('pcb__ln'),
  },

  // ---------- 7. Highlight single line ----------
  {
    title: 'highlight single line {2}',
    md: '```js {2}\nline1\nline2\nline3\n```',
    opts: {},
    check: (html) => {
      const oneHl = count(html, 'pcb__line--hl') === 1;
      const hasHasHl = html.includes('pcb__body--has-hl');
      return check('highlight {2}', oneHl && hasHasHl, `hlCount=${count(html, 'pcb__line--hl')} hasHl=${hasHasHl}`);
    },
  },

  // ---------- 8. Highlight range ----------
  {
    title: 'highlight range {2-4}',
    md: '```js {2-4}\n1\n2\n3\n4\n5\n```',
    opts: {},
    check: (html) => count(html, 'pcb__line--hl') === 3,
  },

  // ---------- 9. Highlight multiple ranges ----------
  {
    title: 'highlight multi {1,3-5,7}',
    md: '```js {1,3-5,7}\n1\n2\n3\n4\n5\n6\n7\n```',
    opts: {},
    check: (html) => count(html, 'pcb__line--hl') === 5,
  },

  // ---------- 10. Highlight reverse range {5-1} ----------
  {
    title: 'highlight reverse range {5-1}',
    md: '```js {5-1}\n1\n2\n3\n4\n5\n```',
    opts: {},
    check: (html) => count(html, 'pcb__line--hl') === 5,
  },

  // ---------- 11. Highlight out-of-order {5,2,8} ----------
  {
    title: 'highlight unordered {5,2,8}',
    md: '```js {5,2,8}\n1\n2\n3\n4\n5\n6\n7\n8\n```',
    opts: {},
    check: (html) => count(html, 'pcb__line--hl') === 3,
  },

  // ---------- 12. Highlight overlap {1-5,3-7} ----------
  {
    title: 'highlight overlap {1-5,3-7} dedupes',
    md: '```js {1-5,3-7}\n1\n2\n3\n4\n5\n6\n7\n```',
    opts: {},
    check: (html) => count(html, 'pcb__line--hl') === 7,
  },

  // ---------- 13. Highlight disabled globally ----------
  {
    title: 'highlight disabled globally',
    md: '```js {1,2,3}\n1\n2\n3\n```',
    opts: { highlight: false },
    check: (html) => count(html, 'pcb__line--hl') === 0,
  },

  // ---------- 14. Diff + line ----------
  {
    title: 'diff + line coloring',
    md: '```diff\n+added\n-removed\n ctx\n```',
    opts: {},
    check: (html) => {
      const add = html.includes('pcb__line--add');
      const del = html.includes('pcb__line--del');
      return check('diff', add && del, `add=${add} del=${del}`);
    },
  },

  // ---------- 15. Diff disabled ----------
  {
    title: 'diff disabled globally',
    md: '```diff\n+added\n-removed\n```',
    opts: { diff: false },
    check: (html) => !html.includes('pcb__line--add') && !html.includes('pcb__line--del'),
  },

  // ---------- 16. wrap flag ----------
  {
    title: 'wrap flag adds pcb--wrap class',
    md: '```js wrap\nconst x = "long string that should wrap"\n```',
    opts: {},
    check: (html) => html.includes('pcb--wrap'),
  },

  // ---------- 17. noDecorations flag ----------
  {
    title: 'noDecorations hides dots',
    md: '```js title="x.js" noDecorations\nfoo\n```',
    opts: {},
    check: (html) => !html.includes('pcb__dots'),
  },

  // ---------- 18. noLang flag ----------
  {
    title: 'noLang hides language badge',
    md: '```js title="x.js" noLang\nfoo\n```',
    opts: {},
    check: (html) => !html.includes('pcb__lang'),
  },

  // ---------- 19. noCopy flag ----------
  {
    title: 'noCopy hides copy button',
    md: '```js title="x.js" noCopy\nfoo\n```',
    opts: {},
    check: (html) => !html.includes('pcb__copy'),
  },

  // ---------- 20. noBar flag ----------
  {
    title: 'noBar hides entire header',
    md: '```js title="x.js" noBar\nfoo\n```',
    opts: {},
    check: (html) => !html.includes('pcb__bar'),
  },

  // ---------- 21. collapse flag ----------
  {
    title: 'collapse wraps in <details>',
    md: '```js title="x.js" collapse\nfoo\nbar\n```',
    opts: {},
    check: (html) => html.includes('pcb--collapse') && html.includes('<details'),
  },

  // ---------- 22. collapseAfter ----------
  {
    title: 'collapseAfter=3 triggers on 4-line block',
    md: '```js\n1\n2\n3\n4\n```',
    opts: { collapseAfter: 3 },
    check: (html) => html.includes('pcb--collapse'),
  },

  // ---------- 23. collapseAfter does not trigger on short ----------
  {
    title: 'collapseAfter=10 does NOT trigger on 3-line block',
    md: '```js\n1\n2\n3\n```',
    opts: { collapseAfter: 10 },
    check: (html) => !html.includes('pcb--collapse'),
  },

  // ---------- 24. copyButtonLabel null ----------
  {
    title: 'copyButtonLabel=null (icon only)',
    md: '```js title="x.js"\nfoo\n```',
    opts: { copyButtonLabel: null },
    check: (html) => {
      const hasBtn = html.includes('pcb__copy');
      const hasSvg = html.includes('<svg');
      const noLabelSpan = !/>copy</.test(html);
      return check('icon-only copy', hasBtn && hasSvg && noLabelSpan, `btn=${hasBtn} svg=${hasSvg} noLabel=${noLabelSpan}`);
    },
  },

  // ---------- 25. preset terminal ----------
  {
    title: 'preset=terminal adds pcb--terminal class',
    md: '```bash\n$ npm install\n```',
    opts: { preset: 'terminal' },
    check: (html) => html.includes('pcb--terminal'),
  },

  // ---------- 26. preset minimal ----------
  {
    title: 'preset=minimal adds pcb--minimal class',
    md: '```bash\n$ npm install\n```',
    opts: { preset: 'minimal' },
    check: (html) => html.includes('pcb--minimal'),
  },

  // ---------- 27. Empty code block ----------
  {
    title: 'empty code block',
    md: '```js\n```',
    opts: {},
    check: (html) => html.includes('class="pcb"') && html.includes('<pre>'),
  },

  // ---------- 28. Single-line block ----------
  {
    title: 'single-line block',
    md: '```js\nconsole.log("single")\n```',
    opts: {},
    check: (html) => html.includes('pcb__lang') && html.includes('js'),
  },

  // ---------- 29. Special chars in title ----------
  {
    title: 'title with special chars',
    md: '```js title="src/<app>/utils.ts"\nfoo\n```',
    opts: {},
    check: (html) => {
      // The < should be HTML-escaped (either as &lt; or &#x3C;) — both are valid.
      const hasEscapedLT = html.includes('&lt;app') || html.includes('&#x3C;app');
      const hasFilename = html.includes('utils.ts');
      return check('special chars title', hasEscapedLT && hasFilename, `escapedLT=${hasEscapedLT} filename=${hasFilename}`);
    },
  },

  // ---------- 30. Title with escaped quote (single-quote syntax) ----------
  {
    title: 'title with quote via single-quote syntax',
    md: "```js title='say \"hi\".js'\nfoo\n```",
    opts: {},
    check: (html) => html.includes('say') && html.includes('hi') && html.includes('.js'),
  },

  // ---------- 31. Unknown meta tokens ignored ----------
  {
    title: 'unknown meta tokens ignored gracefully',
    md: '```js title="x.js" fooBar baz=42 {1}\nline1\n```',
    opts: {},
    check: (html) => html.includes('pcb__title') && html.includes('pcb__line--hl'),
  },

  // ---------- 32. engine=passthrough skips Shiki ----------
  {
    title: 'engine=passthrough skips Shiki call',
    md: '```js\nconst x = 1\n```',
    opts: { engine: 'passthrough' },
    check: (html) => html.includes('class="pcb"'),
  },

  // ---------- 33. Multiple blocks on one page ----------
  {
    title: 'multiple blocks on one page',
    md: '```js title="a.js"\nfoo\n```\n\nText between\n\n```ts title="b.ts" {1}\nbar\n```',
    opts: {},
    check: (html) => {
      const twoFigures = count(html, '<figure class="pcb') === 2;
      const twoTitles = html.includes('a.js') && html.includes('b.ts');
      return check('multi-block', twoFigures && twoTitles, `figures=${count(html, '<figure class="pcb')} titles=${twoTitles}`);
    },
  },

  // ---------- 34. HTML escaping in code body ----------
  {
    title: 'HTML chars in code body are escaped',
    md: '```html\n<div class="x">&amp;</div>\n```',
    opts: {},
    check: (html) => {
      // < should be escaped (either &lt; or &#x3C;); the text “div” should appear
      const hasEscapedLT = html.includes('&lt;div') || html.includes('&#x3C;div') || html.includes('&#x3C;/div');
      const hasDivText = html.includes('>div<');
      return check('HTML escape', hasEscapedLT || hasDivText, `escaped=${hasEscapedLT} divText=${hasDivText}`);
    },
  },

  // ---------- 35. Indented code block IS processed (same as fenced) ----------
  {
    title: 'indented code block is also processed',
    md: '    indented code\n',
    opts: {},
    check: (html) => html.includes('class="pcb"'),
  },

  // ---------- 36. wrap global default ----------
  {
    title: 'global wrap=true applies to all blocks',
    md: '```js\nfoo\n```',
    opts: { wrap: true },
    check: (html) => html.includes('pcb--wrap'),
  },

  // ---------- 37. copyButton disabled globally ----------
  {
    title: 'global copyButton=false hides button',
    md: '```js title="x.js"\nfoo\n```',
    opts: { copyButton: false },
    check: (html) => !html.includes('pcb__copy'),
  },

  // ---------- 38. decorations disabled globally ----------
  {
    title: 'global decorations=false hides dots',
    md: '```js title="x.js"\nfoo\n```',
    opts: { decorations: false },
    check: (html) => !html.includes('pcb__dots'),
  },

  // ---------- 39. showLanguage disabled globally ----------
  {
    title: 'global showLanguage=false hides badge',
    md: '```js title="x.js"\nfoo\n```',
    opts: { showLanguage: false },
    check: (html) => !html.includes('pcb__lang'),
  },

  // ---------- 40. Mixed: all ornaments off + highlight ----------
  {
    title: 'all ornaments off, highlight still works',
    md: '```js title="x.js" {2} noDecorations noLang noCopy\n1\n2\n3\n```',
    opts: {},
    check: (html) => {
      const noDots = !html.includes('pcb__dots');
      const noLang = !html.includes('pcb__lang');
      const noCopy = !html.includes('pcb__copy');
      const hasHl = html.includes('pcb__line--hl');
      return check('all-off + highlight',
        noDots && noLang && noCopy && hasHl,
        `dots=${!noDots} lang=${!noLang} copy=${!noCopy} hl=${hasHl}`);
    },
  },

  // ---------- 41. Title with spaces ----------
  {
    title: 'title with spaces preserved',
    md: '```js title="my cool file.js"\nfoo\n```',
    opts: {},
    check: (html) => html.includes('my cool file.js'),
  },

  // ---------- 42. Multiline code body line counting ----------
  {
    title: 'multiline: 5 lines produce 5 gutter numbers',
    md: '```js title="x.js"\n1\n2\n3\n4\n5\n```',
    opts: {},
    check: (html) => {
      // Gutter spans like <span>1</span>...<span>5</span>
      const has5 = html.includes('>5<');
      return check('5-line gutter', has5, `has5=${has5}`);
    },
  },

  // ---------- 43. Inline code (when disabled, default) ----------
  {
    title: 'inline code NOT styled by default',
    md: 'Use `npm install` to install.',
    opts: {},
    check: (html) => !html.includes('pcb--inline'),
  },

  // ---------- 44. lang=plaintext (treated as no-language) ----------
  {
    title: 'plaintext language — no badge shown',
    md: '```plaintext\njust text\n```',
    opts: {},
    check: (html) => {
      // Plaintext is intentionally treated as "no language" — no badge should appear.
      const noBadge = !html.includes('pcb__lang');
      const hasBody = html.includes('pcb__body');
      return check('plaintext no-badge', noBadge && hasBody, `noBadge=${noBadge} body=${hasBody}`);
    },
  },

  // ---------- 45. no language at all ----------
  {
    title: 'no language shows no badge',
    md: '```\nplain\n```',
    opts: { lineNumbers: 'always' },
    check: (html) => {
      const hasGutter = html.includes('pcb__ln');
      const noLang = !html.includes('pcb__lang');
      return check('no-lang', hasGutter && noLang, `gutter=${hasGutter} lang=${!noLang}`);
    },
  },

  // ---------- 46. Very long single line ----------
  {
    title: 'very long single line (horizontal scroll)',
    md: '```js\n' + 'const x = "' + 'a'.repeat(200) + '";\n```',
    opts: {},
    check: (html) => html.includes('pcb__body'),
  },

  // ---------- 47. Multiple meta flags combined ----------
  {
    title: 'multiple meta flags together',
    md: '```ts title="x.ts" {1} wrap ln copy noLang\nline1\nline2\n```',
    opts: { lineNumbers: 'never', wrap: false, copyButton: false },
    check: (html) => {
      const ln = html.includes('pcb__ln');   // ln forces on
      const wrap = html.includes('pcb--wrap');   // wrap forces on
      const copy = html.includes('pcb__copy');   // copy forces on
      const noLang = !html.includes('pcb__lang');
      const hl = html.includes('pcb__line--hl');
      return check('multi-flag override',
        ln && wrap && copy && noLang && hl,
        `ln=${ln} wrap=${wrap} copy=${copy} noLang=${noLang} hl=${hl}`);
    },
  },

  // ---------- 48. Copy button has aria-label ----------
  {
    title: 'copy button has accessible aria-label',
    md: '```js title="x.js"\nfoo\n```',
    opts: {},
    check: (html) => html.includes('aria-label="Copy code"'),
  },

  // ---------- 49. Title with quotes via single backslash ----------
  {
    title: 'title with backslash in middle',
    md: '```js title="path\\\\to\\\\file.js"\nfoo\n```',
    opts: {},
    check: (html) => html.includes('path') && html.includes('file.js'),
  },

  // ---------- 50. Title attribute contains equals sign ----------
  {
    title: 'title value with = sign',
    md: '```js title="x=y.js"\nfoo\n```',
    opts: {},
    check: (html) => html.includes('x=y.js'),
  },
];

// ============================================================
// RUN TESTS
// ============================================================

const results = [];
const renderedHtml = [];

console.log(`\nRunning ${tests.length} edge-case tests...\n`);
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
  result.title = t.title;
  result.md = t.md;
  result.opts = t.opts;
  result.html = html;
  results.push(result);
  renderedHtml.push({ title: t.title, md: t.md, opts: t.opts, html });

  const status = result.pass ? 'PASS' : 'FAIL';
  const num = String(i + 1).padStart(2, '0');
  console.log(`${num} [${status}] ${t.title}`);
  if (!result.pass) console.log(`     └─ ${result.detail}`);
}

console.log('─'.repeat(72));
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\nResult: ${passed}/${results.length} passed, ${failed} failed\n`);

// ============================================================
// WRITE INDIVIDUAL HTML FILES + GALLERY
// ============================================================

renderedHtml.forEach((r, i) => {
  const num = String(i + 1).padStart(2, '0');
  writeFileSync(
    `/home/z/my-project/test-output/${num}.html`,
    `<!doctype html><html><head><meta charset="utf-8"><title>${r.title}</title>
<style>${CSS}body{background:#010409;color:#c9d1d9;padding:2rem;font-family:system-ui}</style>
</head><body><h2 style="color:#8b949e;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem">Test ${num}: ${r.title}</h2>${r.html}</body></html>`
  );
});

// Build gallery
const galleryItems = renderedHtml.map((r, i) => {
  const num = String(i + 1).padStart(2, '0');
  const status = results[i].pass ? 'pass' : 'fail';
  return `
  <section class="case ${status}">
    <header>
      <span class="num">${num}</span>
      <span class="title">${r.title}</span>
      <span class="status ${status}">${status.toUpperCase()}</span>
    </header>
    <details class="md">
      <summary>markdown input</summary>
      <pre>${escapeHtml(r.md)}</pre>
    </details>
    <details class="opts">
      <summary>options</summary>
      <pre>${escapeHtml(JSON.stringify(r.opts, null, 2))}</pre>
    </details>
    ${!results[i].pass && results[i].detail ? `<div class="detail">⚠ ${escapeHtml(results[i].detail)}</div>` : ''}
    <div class="rendered">${r.html}</div>
  </section>`;
}).join('\n');

const galleryHtml = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>rehype-perfect-code-blocks — test report</title>
<style>
  ${CSS}
  body {
    margin: 0; background: #010409; color: #c9d1d9;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    padding: 2rem 1.5rem 6rem;
  }
  .wrap { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
  .lede { color: #8b949e; margin: 0 0 0.5rem; font-size: .95rem; }
  .summary {
    display: flex; gap: 1rem; margin: 1.5rem 0; padding: 1rem;
    background: #0d1117; border: 1px solid #30363d; border-radius: 12px;
    font-family: ui-monospace, monospace;
  }
  .stat { display: flex; flex-direction: column; gap: 0.25rem; }
  .stat-num { font-size: 1.75rem; font-weight: 600; }
  .stat-label { color: #8b949e; font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; }
  .stat.pass .stat-num { color: #2ea043; }
  .stat.fail .stat-num { color: #f85149; }
  .case {
    margin: 1.5rem 0; background: #0d1117; border: 1px solid #30363d;
    border-radius: 12px; overflow: hidden;
  }
  .case.fail { border-color: #f85149; }
  .case > header {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.75rem 1rem; background: #161b22;
    border-bottom: 1px solid #30363d; font-size: .85rem;
  }
  .case .num {
    font-family: ui-monospace, monospace; color: #6e7681;
    background: #21262d; padding: .15rem .45rem; border-radius: 4px;
    font-size: .75rem;
  }
  .case .title { flex: 1; font-weight: 500; }
  .case .status {
    font-size: .7rem; padding: .2rem .5rem; border-radius: 4px;
    font-family: ui-monospace, monospace; letter-spacing: .05em;
  }
  .case .status.pass { background: rgba(46,160,67,.2); color: #2ea043; }
  .case .status.fail { background: rgba(248,81,73,.2); color: #f85149; }
  .case details {
    padding: .5rem 1rem; border-bottom: 1px solid #21262d;
    font-size: .8rem;
  }
  .case details summary {
    cursor: pointer; color: #8b949e; font-family: ui-monospace, monospace;
  }
  .case details pre {
    margin: .5rem 0 0; padding: .75rem; background: #010409;
    border-radius: 6px; color: #c9d1d9; font-size: .75rem;
    font-family: ui-monospace, monospace; overflow-x: auto;
  }
  .case .detail {
    padding: .5rem 1rem; background: rgba(248,81,73,.08);
    color: #f85149; font-family: ui-monospace, monospace; font-size: .8rem;
    border-bottom: 1px solid #21262d;
  }
  .case .rendered {
    padding: 1rem;
    background: #010409;
  }
  .case .rendered:empty::before {
    content: '(no output)'; color: #6e7681; font-style: italic;
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>rehype-perfect-code-blocks — edge-case test report</h1>
  <p class="lede">${tests.length} tests run. Each test renders a markdown snippet through the plugin and asserts on the resulting HTML.</p>
  <div class="summary">
    <div class="stat pass"><span class="stat-num">${passed}</span><span class="stat-label">passed</span></div>
    <div class="stat fail"><span class="stat-num">${failed}</span><span class="stat-label">failed</span></div>
    <div class="stat"><span class="stat-num">${tests.length}</span><span class="stat-label">total</span></div>
  </div>
  ${galleryItems}
</div>
<script>
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.pcb__copy');
    if (!btn) return;
    const figure = btn.closest('.pcb');
    const code = figure?.querySelector('pre code');
    if (!code) return;
    navigator.clipboard.writeText(code.innerText).then(() => {
      btn.classList.add('pcb__copy--done');
      const label = btn.querySelector('span');
      const old = label?.textContent;
      if (label) label.textContent = 'copied!';
      setTimeout(() => {
        btn.classList.remove('pcb__copy--done');
        if (label && old) label.textContent = old;
      }, 1600);
    });
  });
</script>
</body>
</html>`;

writeFileSync('/home/z/my-project/download/test-report.html', galleryHtml);
console.log(`\nGallery written → /home/z/my-project/download/test-report.html`);
console.log(`Per-test HTML   → /home/z/my-project/test-output/*.html`);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
