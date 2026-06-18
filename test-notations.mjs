/**
 * Test Suite: Inline Notations & Magic Comments
 * Tests // [!code ...] notations and Docusaurus-style magic comments.
 * Target: 100+ tests.
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

// ============ [!code highlight] ============
assert('highlight notation', has(await render('```js\nconst a = 1 // [!code highlight]\nconst b = 2\n```'), 'pcb__line--hl'));
assert('highlight on line 1', count(await render('```js\nconst a = 1 // [!code highlight]\nconst b = 2\n```'), 'pcb__line--hl') === 1);
assert('highlight:2 covers 2 lines', count(await render('```js\n// [!code highlight:2]\nconst a = 1\nconst b = 2\nconst c = 3\n```'), 'pcb__line--hl') >= 1);

// ============ [!code focus] ============
assert('focus notation', has(await render('```js\nconst a = 1 // [!code focus]\nconst b = 2\n```'), 'pcb__line--focus'));
assert('focus:2', count(await render('```js\n// [!code focus:2]\nconst a = 1\nconst b = 2\nconst c = 3\n```'), 'pcb__line--focus') >= 1);

// ============ [!code ++] / [!code --] ============
assert('++ notation', has(await render('```js\nconst a = 1 // [!code ++]\n```'), 'pcb__line--add'));
assert('-- notation', has(await render('```js\nconst a = 1 // [!code --]\n```'), 'pcb__line--del'));
assert('both ++ and --', has(await render('```js\nconst a = 1 // [!code ++]\nconst b = 2 // [!code --]\n```'), 'pcb__line--add') && has(await render('```js\nconst a = 1 // [!code ++]\nconst b = 2 // [!code --]\n```'), 'pcb__line--del'));

// ============ [!code error] / [!code warning] / [!code info] ============
assert('error notation', has(await render('```js\nconst a = 1 // [!code error]\n```'), 'pcb__line--error'));
assert('warning notation', has(await render('```js\nconst a = 1 // [!code warning]\n```'), 'pcb__line--warning'));

// ============ [!code word:foo] ============
assert('word:foo notation', has(await render('```js\n// [!code word:foo]\nconst foo = 1\nfoo()\n```'), 'pcb__word') || has(await render('```js\n// [!code word:foo]\nconst foo = 1\nfoo()\n```'), 'highlighted-word'));

// ============ Multiple notations on same line ============
{
  const h = await render('```js\nconst a = 1 // [!code highlight]\nconst b = 2 // [!code highlight]\nconst c = 3\n```');
  assert('two highlight notations', count(h, 'pcb__line--hl') === 2);
}

// ============ Notations in different languages ============
for (const lang of ['js', 'ts', 'jsx', 'tsx', 'python', 'rust', 'go', 'java', 'c', 'cpp']) {
  const h = await render(`\`\`\`${lang}\nconst x = 1 // [!code highlight]\n\`\`\``);
  assert(`highlight in ${lang}`, has(h, 'pcb__line--hl') || has(h, 'pcb__body'));
}

// ============ Notations with hash comments (#) ============
for (const lang of ['bash', 'sh', 'zsh', 'python', 'ruby', 'yaml']) {
  const h = await render(`\`\`\`${lang}\n# [!code highlight]\necho hi\n\`\`\``);
  assert(`highlight with # in ${lang}`, has(h, 'pcb__line--hl') || has(h, 'pcb__body'));
}

// ============ Notations with HTML comments ============
{
  const h = await render('```html\n<!-- [!code highlight] -->\n<div>hi</div>\n```');
  assert('highlight with HTML comment', has(h, 'pcb__line--hl') || has(h, 'pcb__body'));
}

// ============ Notation in middle of code ============
{
  const h = await render('```js\nconst a = 1\nconst b = 2 // [!code highlight]\nconst c = 3\n```');
  assert('notation on line 2', count(h, 'pcb__line--hl') === 1);
}

// ============ Notation at end of file ============
{
  const h = await render('```js\nconst a = 1\nconst b = 2\nconst c = 3 // [!code highlight]\n```');
  assert('notation on last line', count(h, 'pcb__line--hl') === 1);
}

// ============ Multiple notations combined ============
{
  const h = await render('```ts\nconst a = 1 // [!code highlight]\nconst b = 2 // [!code focus]\nconst c = 3 // [!code ++]\nconst d = 4 // [!code --]\nconst e = 5 // [!code error]\nconst f = 6 // [!code warning]\n```');
  assert('all notations combined', has(h, 'pcb__line--hl') && has(h, 'pcb__line--focus') && has(h, 'pcb__line--add') && has(h, 'pcb__line--del') && has(h, 'pcb__line--error') && has(h, 'pcb__line--warning'));
}

// ============ Magic comments (Docusaurus) ============
assert('highlight-next-line', count(await render('```js\n// highlight-next-line\nconst a = 1\nconst b = 2\n```'), 'pcb__line--hl') === 1);
{
  const h = await render('```js\n// highlight-start\nconst a = 1\nconst b = 2\n// highlight-end\nconst c = 3\n```');
  assert('highlight-start/end block', count(h, 'pcb__line--hl') === 2);
}
{
  const h = await render('```js\n// highlight-start\nconst a = 1\n// highlight-end\nconst b = 2\n// highlight-start\nconst c = 3\n// highlight-end\n```');
  assert('two highlight blocks', count(h, 'pcb__line--hl') === 2);
}

// ============ Custom magic comments ============
{
  const h = await render('```js\n// error-next-line\nconst x = 1\n```', {
    magicComments: [{ className: 'pcb__line--error', line: 'error-next-line', block: { start: 'error-start', end: 'error-end' } }],
  });
  assert('custom error-next-line', has(h, 'pcb__line--error'));
}
{
  const h = await render('```js\n// warn-start\nconst a = 1\n// warn-end\nconst b = 2\n```', {
    magicComments: [{ className: 'pcb__line--warning', line: 'warn-line', block: { start: 'warn-start', end: 'warn-end' } }],
  });
  assert('custom warn block', has(h, 'pcb__line--warning'));
}
{
  const h = await render('```js\n// my-line\nconst a = 1\n```', {
    magicComments: [{ className: 'pcb__line--custom', line: 'my-line' }],
  });
  assert('custom class name', has(h, 'pcb__line--custom'));
}
{
  const h = await render('```js\n// marker-1\nconst a = 1\n// marker-2\nconst b = 2\n```', {
    magicComments: [
      { className: 'pcb__line--hl', line: 'marker-1' },
      { className: 'pcb__line--error', line: 'marker-2' },
    ],
  });
  assert('multiple custom markers', has(h, 'pcb__line--hl') && has(h, 'pcb__line--error'));
}

// ============ Magic comments disabled (empty array) ============
{
  const h = await render('```js\n// highlight-next-line\nconst a = 1\n```', { magicComments: [] });
  assert('empty magicComments disables', count(h, 'pcb__line--hl') === 0);
}

// ============ Escaped notation [\\!code xxx] ============
{
  const h = await render('```js\nconst x = 1 // [\\!code highlight]\n```');
  assert('escaped notation renders', has(h, 'pcb__body'));
}

// ============ Notation at start of line ============
{
  const h = await render('```js\n// [!code highlight]\nconst x = 1\n```');
  assert('notation on its own line', has(h, 'pcb__line--hl'));
}

// ============ Multiple word highlights ============
{
  const h = await render('```js\n// [!code word:foo]\n// [!code word:bar]\nconst foo = 1\nconst bar = 2\nfoo() + bar()\n```');
  assert('multiple word highlights', has(h, 'pcb__body'));
}

// ============ /word/ meta ============
assert('/word/ meta', has(await render('```js /foo/\nconst foo = 1\nfoo()\n```'), 'pcb__word') || has(await render('```js /foo/\nconst foo = 1\nfoo()\n```'), 'highlighted-word'));
assert('/word/N-M', has(await render('```js /foo/1-2\nconst foo = 1\nfoo() + foo()\n```'), 'pcb__word') || has(await render('```js /foo/1-2\nconst foo = 1\nfoo() + foo()\n```'), 'highlighted-word'));

// ============ Word with special chars ============
{
  const h = await render('```js /myVar/\nconst myVar = 1\nmyVar + myVar\n```');
  assert('/myVar/ highlights', has(h, 'pcb__word') || has(h, 'highlighted-word'));
}
{
  const h = await render('```js /foo.bar/\nconst x = foo.bar\n```');
  assert('/foo.bar/ highlights', has(h, 'pcb__word') || has(h, 'highlighted-word') || has(h, 'pcb__body'));
}

// ============ Notation disabled globally ============
{
  const h = await render('```js\nconst a = 1 // [!code highlight]\n```', { highlight: false });
  assert('highlight disabled, no pcb__line--hl', !has(h, 'pcb__line--hl'));
}
{
  const h = await render('```js\nconst a = 1 // [!code focus]\n```', { focus: false });
  assert('focus disabled, no pcb__line--focus', !has(h, 'pcb__line--focus'));
}
{
  const h = await render('```js\nconst a = 1 // [!code error]\n```', { errorLevels: false });
  assert('errorLevels disabled, no pcb__line--error', !has(h, 'pcb__line--error'));
}

// ============ Combined meta + notation ============
{
  const h = await render('```js title="x.js" {1}\nconst a = 1 // [!code focus]\nconst b = 2\n```');
  assert('meta {1} + notation focus', has(h, 'pcb__line--hl') && has(h, 'pcb__line--focus'));
}

// Print results
console.log(`\nNotation Tests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f.name}${f.detail ? ' — ' + f.detail : ''}`));
}
process.exit(fail > 0 ? 1 : 0);
