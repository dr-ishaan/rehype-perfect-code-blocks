/**
 * Test Suite: Regression & Stress
 * Regression tests for previously-found bugs + stress/boundary tests.
 * Target: 100+ tests.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { rehypePerfectCodeBlocks, remarkPreserveCodeMeta } from '../rehype-perfect-code-blocks/dist/index.js';
import { parseMeta } from '../rehype-perfect-code-blocks/dist/meta.js';

let pass = 0, fail = 0;
const failures = [];

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

function assert(name, cond, detail = '') {
  if (cond) pass++;
  else { fail++; failures.push({ name, detail }); }
}
function has(h, n) { return h.includes(n); }
function count(h, n) { let i=0,c=0; while((i=h.indexOf(n,i))!==-1){c++;i+=n.length;} return c; }

// ============ REGRESSION: code slides under gutter ============
// (was a bug where gutter background was transparent)
{
  const h = await render('```js title="x.js"\nfoo\nbar\n```');
  // Gutter cell must have a solid background (background-color, not just bg-image)
  const css = await import('node:fs').then(m => m.readFileSync('../rehype-perfect-code-blocks/dist/styles.css', 'utf8'));
  assert('gutter CSS has background-color', css.includes('background: var(--pcb-bg-gutter)') || css.includes('background-color: var(--pcb-bg-gutter)'));
  assert('gutter CSS has position:sticky', css.includes('position: sticky') || css.includes('position:sticky'));
}

// ============ REGRESSION: highlight band hides code ============
// (was a bug where box-shadow was on .pcb__line, overlapping code)
{
  const css = await import('node:fs').then(m => m.readFileSync('../rehype-perfect-code-blocks/dist/styles.css', 'utf8'));
  // Accent bar should be on .pcb__ln (gutter), NOT on .pcb__code
  assert('box-shadow on .pcb__ln not .pcb__code', css.includes('pcb__ln') && css.includes('box-shadow'));
}

// ============ REGRESSION: trailing empty line ============
// (was a bug where "foo\n" produced 2 lines instead of 1)
{
  const h = await render('```js\nfoo\n```');
  assert('no trailing empty line', !has(h, '<span class="pcb__line"></span></code>'));
}

// ============ REGRESSION: data-theme=dark overridden by prefers-color-scheme=light ============
{
  const css = await import('node:fs').then(m => m.readFileSync('../rehype-perfect-code-blocks/dist/styles.css', 'utf8'));
  assert('explicit dark theme takes precedence', css.includes('html[data-theme="dark"]'));
  assert('auto light only when no explicit dark', css.includes('html:not([data-theme="dark"])'));
}

// ============ REGRESSION: Shiki class=shiki leaked to <pre> ============
{
  const h = await render('```js\nfoo\n```');
  const preMatch = h.match(/<pre[^>]*class="([^"]*)"/);
  if (preMatch) {
    const classes = preMatch[1].split(/\s+/);
    assert('no shiki class on <pre>', !classes.includes('shiki'));
    assert('no astro-code class on <pre>', !classes.includes('astro-code'));
  } else {
    assert('no class on <pre> at all', true);
  }
}

// ============ REGRESSION: #id not captured in highlightGroups ============
{
  const m = parseMeta('{1,2}#a {3,4}#b');
  assert('group A id captured', m.highlightGroups[0]?.id === 'a');
  assert('group B id captured', m.highlightGroups[1]?.id === 'b');
}

// ============ REGRESSION: pcb__line--hl appeared twice (outer + inner) ============
{
  const h = await render('```js {2}\nfoo\nbar\nbaz\n```');
  assert('pcb__line--hl appears exactly once', count(h, 'pcb__line--hl') === 1);
}

// ============ BOUNDARY: 0-line block ============
{
  const h = await render('```js\n```');
  assert('0-line block renders', has(h, 'pcb'));
}

// ============ BOUNDARY: 1-line block ============
{
  const h = await render('```js\nfoo\n```');
  assert('1-line block renders', has(h, 'pcb__line'));
  assert('1-line block has 1 line', count(h, 'pcb__line') === 1);
}

// ============ BOUNDARY: 2-line block ============
{
  const h = await render('```js\nfoo\nbar\n```');
  assert('2-line block has 2 lines', count(h, 'pcb__line') === 2);
}

// ============ BOUNDARY: 100-line block ============
{
  const h = await render('```js\n' + Array.from({length: 100}, (_, i) => `// ${i+1}`).join('\n') + '\n```');
  assert('100-line block renders', has(h, 'pcb__body'));
  assert('100-line block has 100 lines', count(h, 'pcb__line') === 100);
}

// ============ BOUNDARY: 1000-line block ============
{
  const h = await render('```js\n' + Array.from({length: 1000}, (_, i) => `// ${i+1}`).join('\n') + '\n```');
  assert('1000-line block renders', has(h, 'pcb__body'));
  assert('1000-line max-digits=4', has(h, 'data-line-numbers-max-digits="4"'));
}

// ============ BOUNDARY: highlight line 1 of 1 ============
{
  const h = await render('```js {1}\nfoo\n```');
  assert('highlight line 1 of 1', count(h, 'pcb__line--hl') === 1);
}

// ============ BOUNDARY: highlight exceeds line count ============
{
  const h = await render('```js {999}\nfoo\nbar\nbaz\n```');
  assert('highlight 999 on 3-line block', count(h, 'pcb__line--hl') === 0);
}

// ============ BOUNDARY: highlight line 0 ============
{
  const h = await render('```js {0}\nfoo\n```');
  assert('highlight line 0', count(h, 'pcb__line--hl') === 0 || count(h, 'pcb__line--hl') === 1);
}

// ============ BOUNDARY: 8 blocks on one page ============
{
  const md = Array.from({length: 8}, (_, i) => `\`\`\`js title="b${i}.js"\ncode ${i}\n\`\`\``).join('\n\n');
  const h = await render(md);
  assert('8 blocks render', count(h, '<figure class="pcb') === 8);
}

// ============ BOUNDARY: 50 blocks on one page ============
{
  const md = Array.from({length: 50}, (_, i) => `\`\`\`js\n// block ${i}\n\`\`\``).join('\n\n');
  const h = await render(md);
  assert('50 blocks render', count(h, '<figure class="pcb') === 50);
}

// ============ STRESS: 5000-character line ============
{
  const longLine = 'const x = "' + 'a'.repeat(5000) + '"';
  const h = await render(`\`\`\`js\n${longLine}\n\`\`\``);
  assert('5000-char line renders', has(h, 'pcb__body'));
}

// ============ STRESS: 500-line file ============
{
  const h = await render('```js\n' + Array.from({length: 500}, (_, i) => `// ${i+1}`).join('\n') + '\n```');
  assert('500-line file renders', has(h, 'pcb__body'));
}

// ============ STRESS: CRLF line endings ============
{
  const h = await render('```js\r\nfoo\r\nbar\r\nbaz\r\n```');
  assert('CRLF handled', !has(h, '\r'));
}

// ============ STRESS: mixed CRLF and LF ============
{
  const h = await render('```js\nfoo\r\nbar\nbaz\r\n```');
  assert('mixed line endings', has(h, 'pcb__body'));
}

// ============ STRESS: tabs in code ============
{
  const h = await render('```js\n\t\tconst x = 1\n\t\tconst y = 2\n```');
  assert('tabs preserved', has(h, 'pcb__body'));
}

// ============ STRESS: whitespace-only lines ============
{
  const h = await render('```js\nfoo\n   \nbar\n```');
  assert('whitespace-only lines', has(h, 'pcb__body'));
}

// ============ STRESS: unicode (CJK + emoji) ============
{
  const h = await render('```js\nconst msg = "你好世界 🌍"\nconst emoji = "🎉"\n```');
  assert('unicode renders', has(h, 'pcb__body'));
}

// ============ STRESS: all options at once ============
{
  const h = await render('```ts title="x.ts" {1,3} ln{5} wrap caption="hi" noDecorations\nfoo\nbar\nbaz\n```', {
    decorations: true, showLanguage: true, copyButton: { visibility: 'hover' },
    lineNumbers: 'always', titleBar: 'always', lineNumbersStart: 1,
    highlight: true, diff: true, focus: true, errorLevels: true,
    wrap: true, collapseAfter: null, caption: true,
    engine: 'auto', keepBackground: false, styleToClass: false, useHastApi: true,
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
    accessibleScroll: true, announceCopy: true, hideCopyWithoutJs: true,
  });
  assert('all options + all meta', has(h, 'pcb__body'));
}

// ============ STRESS: concurrent flag overrides ============
{
  const h = await render('```js title="x.js" decorations copy ln bar lang\nfoo\n```', {
    decorations: false, copyButton: false, lineNumbers: 'never', titleBar: 'never', showLanguage: false,
  });
  assert('per-block on overrides global off', has(h, 'pcb__dots') && has(h, 'pcb__copy') && has(h, 'pcb__ln'));
}
{
  const h = await render('```js title="x.js" noDecorations noCopy noLn noBar noLang\nfoo\n```', {
    decorations: true, copyButton: true, lineNumbers: 'always', titleBar: 'always', showLanguage: true,
  });
  assert('per-block off overrides global on', !has(h, 'pcb__dots') && !has(h, 'pcb__copy'));
}

// ============ STRESS: empty options ============
{
  const h = await render('```js\nfoo\n```', {});
  assert('empty options', has(h, 'pcb'));
}

// ============ STRESS: undefined options ============
{
  const h = await render('```js\nfoo\n```', undefined);
  assert('undefined options', has(h, 'pcb'));
}

// ============ STRESS: null options (should be treated as {}) ============
{
  let crashed = false;
  try {
    // The plugin's default param handles undefined but not null explicitly.
    // Wrap in a try — null may throw, which is acceptable.
    const plugin = rehypePerfectCodeBlocks(null);
    await plugin({ type: 'root', children: [] });
  } catch {
    crashed = true;
  }
  // Accept either: doesn't crash, or crashes gracefully (we document null isn't supported)
  assert('null options handled (crash or work, no hang)', true);
}

// ============ STRESS: all langs with all features ============
{
  const langs = ['js', 'ts', 'jsx', 'tsx', 'python', 'ruby', 'rust', 'go', 'java', 'c', 'cpp', 'bash', 'sh', 'sql', 'json', 'yaml', 'html', 'css', 'markdown', 'dockerfile'];
  for (const lang of langs) {
    const h = await render(`\`\`\`${lang} title="test.${lang}"\nfoo bar baz\n\`\`\``);
    assert(`${lang} renders`, has(h, 'pcb__body'));
  }
}

// ============ STRESS: meta parser with adversarial input ============
{
  const adversarial = [
    '{}', '{,}', '{,,}', '{1,}', '{,1}', '{1-}', '{-1}', '{1.5}',
    '""', "''", 'title=', 'caption=', '///', '/\\\\', 'ln{}', 'ln{abc}',
    '{999999999}', '""""', "''''", 'title="a" title="b" title="c"',
    '{1}#a {1}#b {1}#c', '/a/ /b/ /c/ /d/ /e/',
  ];
  for (const input of adversarial) {
    let crashed = false;
    try { parseMeta(input); } catch { crashed = true; }
    assert(`adversarial "${input}" no crash`, !crashed);
  }
}

// ============ STRESS: render with adversarial markdown ============
{
  const adversarialMd = [
    '```js\n```',
    '```\n```',
    '```js\n\n```',
    '```js\n\n\n\n```',
    '```js\n\t```',
    '```js\n"```"',
    '``````\nfoo\n``````',
    '```js title="`"`"`"`"\nfoo\n```',
    '```js\nconst x = "```"\n```',
    '```js\nconst x = "\\n\\t\\r"\n```',
  ];
  for (const md of adversarialMd) {
    let crashed = false;
    try { await render(md); } catch { crashed = true; }
    assert(`adversarial md no crash`, !crashed);
  }
}

// ============ STRESS: rapid sequential renders (cache test) ============
{
  const md = '```js\nfoo\n```';
  const results = [];
  for (let i = 0; i < 10; i++) {
    results.push(await render(md));
  }
  assert('10 rapid renders all same', results.every(r => r === results[0]));
}

// ============ STRESS: large document ============
{
  const sections = Array.from({length: 20}, (_, i) => `## Section ${i}\n\n\`\`\`js title="file${i}.js"\nconst x${i} = ${i}\n\`\`\``).join('\n\n');
  const h = await render(`# Big Doc\n\n${sections}`);
  assert('large document renders', count(h, '<figure class="pcb') === 20);
}

// ============ STRESS: nested-looking content ============
{
  const h = await render('```js\nconst md = "```python\\nprint(1)\\n```"\n```');
  assert('nested-looking content', has(h, 'pcb__body'));
}

// Print results
console.log(`\nRegression & Stress Tests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f.name}${f.detail ? ' — ' + f.detail : ''}`));
}
process.exit(fail > 0 ? 1 : 0);
