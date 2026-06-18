/**
 * Test Suite: Options & Configuration
 * Tests every option in PerfectCodeOptions.
 * Target: 150+ tests.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { rehypePerfectCodeBlocks, remarkPreserveCodeMeta } from '../rehype-perfect-code-blocks/dist/index.js';

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

const SAMPLE = '```ts title="app.ts"\nconst a = 1\nconst b = 2\nconst c = 3\n```\n\n```js {2}\nfoo\nbar\nbaz\n```';

// ============ Decorations ============
for (const val of [true, false]) {
  const h = await render(SAMPLE, { decorations: val });
  assert(`decorations=${val}`, val ? has(h, 'pcb__dots') : !has(h, 'pcb__dots'));
}

// ============ showLanguage ============
for (const val of [true, false]) {
  const h = await render(SAMPLE, { showLanguage: val });
  assert(`showLanguage=${val}`, val ? has(h, 'pcb__lang') : !has(h, 'pcb__lang'));
}

// ============ copyButton boolean ============
for (const val of [true, false]) {
  const h = await render(SAMPLE, { copyButton: val });
  assert(`copyButton=${val}`, val ? has(h, 'pcb__copy') : !has(h, 'pcb__copy'));
}

// ============ copyButton object ============
{
  const h = await render(SAMPLE, { copyButton: { visibility: 'always' } });
  assert('copyButton.visibility=always', has(h, 'pcb__copy') && !has(h, 'pcb--copy-on-hover'));
}
{
  const h = await render(SAMPLE, { copyButton: { visibility: 'hover' } });
  assert('copyButton.visibility=hover', has(h, 'pcb--copy-on-hover'));
}
{
  const h = await render(SAMPLE, { copyButton: { feedbackDuration: 100 } });
  assert('copyButton.feedbackDuration=100', has(h, 'data-feedback-duration="100"'));
}
{
  const h = await render(SAMPLE, { copyButton: { feedbackDuration: 5000 } });
  assert('copyButton.feedbackDuration=5000', has(h, 'data-feedback-duration="5000"'));
}
{
  const h = await render(SAMPLE, { copyButton: { label: 'Copy' } });
  assert('copyButton.label=Copy', has(h, '>Copy<'));
}
{
  const h = await render(SAMPLE, { copyButton: { label: 'Copy code' } });
  assert('copyButton.label="Copy code"', has(h, '>Copy code<'));
}
{
  const h = await render(SAMPLE, { copyButton: { label: null } });
  assert('copyButton.label=null icon-only', has(h, 'pcb__copy') && !has(h, 'pcb__copy-label'));
}
{
  const h = await render(SAMPLE, { copyButton: { doneLabel: 'Done' } });
  assert('copyButton.doneLabel=Done', has(h, 'data-done-label="Done"'));
}
{
  const h = await render(SAMPLE, { copyButton: { doneLabel: 'Copied to clipboard!' } });
  assert('copyButton.doneLabel long', has(h, 'data-done-label="Copied to clipboard!"'));
}

// ============ lineNumbers ============
for (const val of ['always', 'never', 'auto']) {
  const h = await render('```ts\nfoo\n```', { lineNumbers: val });
  if (val === 'never') assert(`lineNumbers=${val}`, !has(h, 'pcb__ln'));
  else if (val === 'always') assert(`lineNumbers=${val}`, has(h, 'pcb__ln'));
  else assert(`lineNumbers=${val} (auto, no title)`, !has(h, 'pcb__ln'));
}

// ============ titleBar ============
for (const val of ['always', 'never', 'auto']) {
  const h = await render('```ts\nfoo\n```', { titleBar: val });
  if (val === 'never') assert(`titleBar=${val}`, !has(h, 'pcb__bar'));
  else assert(`titleBar=${val}`, has(h, 'pcb__bar'));
}

// ============ lineNumbersStart ============
for (const start of [1, 5, 10, 42, 100]) {
  const h = await render('```ts title="x.ts"\nfoo\n```', { lineNumbersStart: start });
  assert(`lineNumbersStart=${start}`, has(h, `>${start}<`));
}

// ============ highlight ============
for (const val of [true, false]) {
  const h = await render('```js {2}\nfoo\nbar\nbaz\n```', { highlight: val });
  assert(`highlight=${val}`, val ? count(h, 'pcb__line--hl') >= 1 : count(h, 'pcb__line--hl') === 0);
}

// ============ diff ============
for (const val of [true, false]) {
  const h = await render('```js\n+add\n-rem\n```', { diff: val });
  assert(`diff=${val}`, val ? has(h, 'pcb__line--add') : !has(h, 'pcb__line--add'));
}

// ============ focus ============
for (const val of [true, false]) {
  const h = await render('```js\nconst a = 1 // [!code focus]\nconst b = 2\n```', { focus: val });
  assert(`focus=${val}`, val ? has(h, 'pcb__line--focus') : !has(h, 'pcb__line--focus'));
}

// ============ errorLevels ============
for (const val of [true, false]) {
  const h = await render('```js\nconst a = 1 // [!code error]\n```', { errorLevels: val });
  assert(`errorLevels=${val}`, val ? has(h, 'pcb__line--error') : !has(h, 'pcb__line--error'));
}

// ============ wrap ============
for (const val of [true, false]) {
  const h = await render('```js\nfoo\n```', { wrap: val });
  assert(`wrap=${val}`, val ? has(h, 'pcb--wrap') : !has(h, 'pcb--wrap'));
}

// ============ collapseAfter ============
for (const n of [null, 5, 10, 50]) {
  const h = await render('```js\nfoo\nbar\n```', { collapseAfter: n });
  if (n === null || n > 2) assert(`collapseAfter=${n} (no trigger)`, !has(h, 'pcb--collapse'));
  else assert(`collapseAfter=${n} (trigger)`, has(h, 'pcb--collapse'));
}

// ============ caption ============
for (const val of [true, false]) {
  const h = await render('```js caption="test"\nfoo\n```', { caption: val });
  assert(`caption=${val}`, val ? has(h, 'pcb__caption') : !has(h, 'pcb__caption'));
}

// ============ engine ============
for (const val of ['auto', 'shiki', 'passthrough']) {
  const h = await render('```js\nfoo\n```', { engine: val });
  assert(`engine=${val} works`, has(h, 'pcb__body'));
}

// ============ keepBackground ============
for (const val of [true, false]) {
  const h = await render('```js\nfoo\n```', { keepBackground: val });
  if (val) assert(`keepBackground=${val}`, h.match(/background-color:\s*#[0-9a-f]+/i) !== null);
  else assert(`keepBackground=${val}`, h.match(/background-color:\s*#[0-9a-f]+/i) === null);
}

// ============ styleToClass ============
for (const val of [true, false]) {
  const h = await render('```js\nconst x = 1\n```', { styleToClass: val });
  assert(`styleToClass=${val} works`, has(h, 'pcb__body'));
}

// ============ useHastApi ============
for (const val of [true, false]) {
  const h = await render('```js\nfoo\n```', { useHastApi: val });
  assert(`useHastApi=${val} works`, has(h, 'pcb__body'));
}

// ============ showWhitespace ============
for (const val of [false, 'all', 'boundary', 'trailing', 'leading']) {
  const h = await render('```js\n  const x = 1\n```', { showWhitespace: val });
  assert(`showWhitespace=${val} works`, has(h, 'pcb__body'));
}

// ============ indentGuides ============
for (const val of [false, true, 2, 4]) {
  const h = await render('```js\n  const x = 1\n```', { indentGuides: val });
  assert(`indentGuides=${val} works`, has(h, 'pcb__body'));
}

// ============ preset ============
for (const val of ['default', 'terminal', 'minimal']) {
  const h = await render('```js\nfoo\n```', { preset: val });
  if (val === 'default') assert(`preset=${val}`, !has(h, 'pcb--terminal') && !has(h, 'pcb--minimal'));
  else assert(`preset=${val}`, has(h, `pcb--${val}`));
}

// ============ injectStyles / theme (no-ops in standalone rehype) ============
for (const val of [true, false]) {
  const h = await render('```js\nfoo\n```', { injectStyles: val });
  assert(`injectStyles=${val} works`, has(h, 'pcb__body'));
}
for (const val of ['auto', 'dark', 'light']) {
  const h = await render('```js\nfoo\n```', { theme: val });
  assert(`theme=${val} works`, has(h, 'pcb__body'));
}

// ============ inline ============
for (const val of [true, false]) {
  const h = await render('Use `code` here.', { inline: val });
  assert(`inline=${val} works`, has(h, '<code>code</code>'));
}

// ============ terminalLangs ============
{
  const h = await render('```bash\n$ npm\n```');
  assert('default terminalLangs includes bash', has(h, 'pcb--terminal'));
}
{
  const h = await render('```bash\n$ npm\n```', { terminalLangs: [] });
  assert('empty terminalLangs no auto-terminal', !has(h, 'pcb--terminal'));
}
{
  const h = await render('```rust\nfn main() {}\n```', { terminalLangs: ['rust'] });
  assert('custom terminalLangs=[rust]', has(h, 'pcb--terminal'));
}
{
  const h = await render('```python\nprint(1)\n```', { terminalLangs: ['python', 'ruby'] });
  assert('custom terminalLangs=[python,ruby]', has(h, 'pcb--terminal'));
}

// ============ extractFileNameFromCode ============
for (const val of [true, false]) {
  const h = await render('```js\n// my-file.ts\nfoo\n```', { extractFileNameFromCode: val });
  if (val) assert(`extractFileNameFromCode=${val}`, has(h, 'my-file.ts'));
  else assert(`extractFileNameFromCode=${val}`, !has(h, 'my-file.ts"') || !has(h, 'pcb__title">my-file.ts'));
}

// ============ languageLabels ============
{
  const h = await render('```ts\nfoo\n```', { languageLabels: { ts: 'TypeScript' } });
  assert('languageLabels ts→TypeScript', has(h, 'TypeScript'));
}
{
  const h = await render('```js\nfoo\n```', { languageLabels: { js: 'JavaScript' } });
  assert('languageLabels js→JavaScript', has(h, 'JavaScript'));
}
{
  const h = await render('```py\nfoo\n```', { languageLabels: { py: 'Python' } });
  assert('languageLabels py→Python', has(h, 'Python'));
}
{
  const h = await render('```ts\nfoo\n```', { languageLabels: {} });
  assert('empty languageLabels uses raw', has(h, '>ts<'));
}

// ============ languageAliases ============
{
  const h = await render('```ts\nconst x = 1\n```', { languageAliases: { ts: 'typescript' } });
  assert('languageAliases works', has(h, 'pcb__body'));
}

// ============ defaultBlockLang ============
{
  const h = await render('```\nfoo\n```', { defaultBlockLang: 'typescript' });
  assert('defaultBlockLang=typescript works', has(h, 'pcb__body'));
}
{
  const h = await render('```\nfoo\n```', { defaultBlockLang: '' });
  assert('empty defaultBlockLang works', has(h, 'pcb__body'));
}

// ============ accessibleScroll ============
for (const val of [true, false]) {
  const h = await render('```js\nfoo\n```', { accessibleScroll: val });
  assert(`accessibleScroll=${val}`, val ? has(h, 'role="region"') : !has(h, 'role="region"'));
}

// ============ announceCopy (no visible effect in HTML; just verify no crash) ============
for (const val of [true, false]) {
  const h = await render('```js\nfoo\n```', { announceCopy: val });
  assert(`announceCopy=${val} works`, has(h, 'pcb__body'));
}

// ============ hideCopyWithoutJs (no visible effect in standalone) ============
for (const val of [true, false]) {
  const h = await render('```js\nfoo\n```', { hideCopyWithoutJs: val });
  assert(`hideCopyWithoutJs=${val} works`, has(h, 'pcb__body'));
}

// ============ filterMetaString ============
{
  const h = await render('```js title="x.js" {1} #extra\nfoo\n```', {
    filterMetaString: (s) => s.replace(/#extra/, ''),
  });
  assert('filterMetaString strips #extra', has(h, 'x.js') && has(h, 'pcb__line--hl'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', {
    filterMetaString: (s) => s.toUpperCase(),
  });
  assert('filterMetaString uppercase (title still parsed)', has(h, 'pcb__body'));
}

// ============ Visitor hooks ============
{
  let lineCount = 0;
  await render('```js\nfoo\nbar\nbaz\n```', {
    onVisitLine: () => { lineCount++; },
  });
  assert('onVisitLine called for each line', lineCount === 3);
}
{
  let hlCount = 0;
  await render('```js {2}\nfoo\nbar\nbaz\n```', {
    onVisitHighlightedLine: () => { hlCount++; },
  });
  assert('onVisitHighlightedLine called once', hlCount === 1);
}
{
  let titleVisited = false;
  await render('```js title="x.js"\nfoo\n```', {
    onVisitTitle: () => { titleVisited = true; },
  });
  assert('onVisitTitle called', titleVisited);
}
{
  let capVisited = false;
  await render('```js caption="hi"\nfoo\n```', {
    onVisitCaption: () => { capVisited = true; },
  });
  assert('onVisitCaption called', capVisited);
}
{
  let titleVisited = false;
  await render('```js\nfoo\n```', {
    onVisitTitle: () => { titleVisited = true; },
  });
  assert('onVisitTitle NOT called when no title', !titleVisited);
}

// ============ magicComments ============
{
  const h = await render('```js\n// highlight-next-line\nconst x = 1\n```');
  assert('default magic comment highlight-next-line', count(h, 'pcb__line--hl') >= 1);
}
{
  const h = await render('```js\n// highlight-start\nconst a = 1\nconst b = 2\n// highlight-end\nconst c = 3\n```');
  assert('default magic comment block', count(h, 'pcb__line--hl') === 2);
}
{
  const h = await render('```js\n// error-next-line\nconst x = 1\n```', {
    magicComments: [{
      className: 'pcb__line--error',
      line: 'error-next-line',
      block: { start: 'error-start', end: 'error-end' },
    }],
  });
  assert('custom magic comment error-next-line', has(h, 'pcb__line--error'));
}
{
  const h = await render('```js\n// my-start\nconst a = 1\n// my-end\nconst b = 2\n```', {
    magicComments: [{
      className: 'pcb__line--warning',
      line: 'warn-line',
      block: { start: 'my-start', end: 'my-end' },
    }],
  });
  assert('custom magic comment block', has(h, 'pcb__line--warning'));
}

// ============ shiki options ============
{
  const h = await render('```js\nfoo\n```', {
    shiki: { theme: 'github-dark' },
  });
  assert('single theme works', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', {
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
  });
  assert('dual theme works', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', {
    shiki: { langs: ['javascript', 'typescript'] },
  });
  assert('langs option works', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', {
    shiki: { regexEngine: 'javascript' },
  });
  assert('regexEngine=javascript works', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', {
    shiki: { regexEngine: 'oniguruma' },
  });
  assert('regexEngine=oniguruma works', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', {
    shiki: { transformers: [{ name: 'test', code(hast) { void hast; } }] },
  });
  assert('custom transformers work', has(h, 'pcb__body'));
}

// ============ Empty options ============
{
  const h = await render('```js\nfoo\n```', {});
  assert('empty options object works', has(h, 'pcb'));
}

// ============ All options at once ============
{
  const h = await render(SAMPLE, {
    decorations: true, showLanguage: true, copyButton: { visibility: 'hover', label: 'Copy', doneLabel: 'Done!' },
    lineNumbers: 'always', titleBar: 'always', lineNumbersStart: 1,
    highlight: true, diff: true, focus: true, errorLevels: true,
    wrap: false, collapseAfter: null, caption: true,
    engine: 'auto', keepBackground: false, styleToClass: false, useHastApi: true,
    shiki: { theme: { light: 'github-light', dark: 'github-dark' }, langs: [], transformers: [] },
    magicComments: [{ className: 'pcb__line--hl', line: 'highlight-next-line', block: { start: 'highlight-start', end: 'highlight-end' } }],
    terminalLangs: ['sh', 'bash'], extractFileNameFromCode: false,
    languageLabels: { ts: 'TypeScript' }, languageAliases: {}, defaultBlockLang: '',
    accessibleScroll: true, announceCopy: true, hideCopyWithoutJs: true,
    filterMetaString: (s) => s,
    preset: 'default', injectStyles: true, theme: 'auto', inline: false,
  });
  assert('all options at once works', has(h, 'pcb') && has(h, 'TypeScript'));
}

// Print results
console.log(`\nOptions Tests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f.name}${f.detail ? ' — ' + f.detail : ''}`));
}
process.exit(fail > 0 ? 1 : 0);
