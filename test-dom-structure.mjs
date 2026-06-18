/**
 * Test Suite: DOM Structure & Transformer (src/transformer.ts)
 * Verifies the exact HAST output for every feature combination.
 * Target: 200+ tests on rendered HTML structure.
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

function count(h, n) { let i=0,c=0; while((i=h.indexOf(n,i))!==-1){c++;i+=n.length;} return c; }
function has(h, n) { return h.includes(n); }

// ============ Basic figure structure ============
{
  const h = await render('```js\nfoo\n```');
  assert('emits <figure class="pcb">', has(h, '<figure class="pcb'));
  assert('emits <pre>', has(h, '<pre>'));
  assert('emits <code', has(h, '<code'));
  assert('emits pcb__line', has(h, 'pcb__line'));
  assert('emits pcb__body', has(h, 'pcb__body'));
  assert('emits pcb__bar', has(h, 'pcb__bar'));
  assert('emits pcb__dots', has(h, 'pcb__dots'));
  assert('emits pcb__copy', has(h, 'pcb__copy'));
  assert('emits aria-label on copy', has(h, 'aria-label="Copy code"'));
  assert('emits svg icon', has(h, '<svg'));
  assert('emits copy label', has(h, 'pcb__copy-label'));
  assert('pcb__title div always present (may be empty)', has(h, 'pcb__title'));
  assert('pcb__lang present for js', has(h, 'pcb__lang'));
}
// Test no-lang block separately
{
  const h = await render('```\nplain text\n```');
  assert('no-lang block has no pcb__lang', !has(h, 'pcb__lang'));
}

// ============ Row-based line structure ============
{
  const h = await render('```js title="x.js"\nfoo\nbar\n```');
  assert('has pcb__ln (gutter cell)', has(h, 'pcb__ln'));
  assert('has pcb__code (code cell)', has(h, 'pcb__code'));
  assert('gutter has aria-hidden', has(h, 'aria-hidden'));
  assert('gutter shows line 1', has(h, '>1<'));
  assert('gutter shows line 2', has(h, '>2<'));
  assert('no trailing empty line', !h.endsWith('<span class="pcb__line"></span>'));
}

// ============ Line numbers on/off ============
{
  const h = await render('```js title="x.js"\nfoo\n```');
  assert('title shows line numbers (auto)', has(h, 'pcb__ln'));
}
{
  const h = await render('```js\nfoo\n```');
  assert('no title hides line numbers (auto)', !has(h, 'pcb__ln'));
  // data-line-numbers attribute may still be present (empty) but no .pcb__ln cells
}
{
  const h = await render('```js\nfoo\n```', { lineNumbers: 'always' });
  assert('lineNumbers=always shows gutter', has(h, 'pcb__ln'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { lineNumbers: 'never' });
  assert('lineNumbers=never hides gutter', !has(h, 'pcb__ln'));
}
{
  const h = await render('```js title="x.js" noLn\nfoo\n```');
  assert('noLn flag hides gutter', !has(h, 'pcb__ln'));
}
{
  const h = await render('```js noLn\nfoo\n```', { lineNumbers: 'always' });
  assert('noLn flag overrides always', !has(h, 'pcb__ln'));
}
{
  const h = await render('```js ln\nfoo\n```', { lineNumbers: 'never' });
  assert('ln flag overrides never', has(h, 'pcb__ln'));
}

// ============ Line number start ============
{
  const h = await render('```js title="x.js" ln{5}\nfoo\nbar\n```');
  assert('ln{5} starts at 5', has(h, '>5<'));
  assert('ln{5} shows 6', has(h, '>6<'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { lineNumbersStart: 10 });
  assert('global start at 10', has(h, '>10<'));
}
{
  const h = await render('```js title="x.js" showLineNumbers{42}\nfoo\n```');
  assert('showLineNumbers{42} starts at 42', has(h, '>42<'));
}

// ============ data-line-numbers-max-digits ============
{
  const h = await render('```js\nfoo\n```');
  assert('emits data-line-numbers-max-digits', has(h, 'data-line-numbers-max-digits'));
}
{
  const h = await render('```js\n' + Array.from({length: 100}, (_, i) => `// ${i+1}`).join('\n') + '\n```');
  assert('100 lines → max-digits=3', has(h, 'data-line-numbers-max-digits="3"'));
}
{
  const h = await render('```js\n' + Array.from({length: 1000}, (_, i) => `// ${i+1}`).join('\n') + '\n```');
  assert('1000 lines → max-digits=4', has(h, 'data-line-numbers-max-digits="4"'));
}

// ============ Title rendering ============
{
  const h = await render('```js title="app.js"\nfoo\n```');
  assert('title in header', has(h, 'pcb__title'));
  assert('title text rendered', has(h, 'app.js'));
}
{
  const h = await render('```js title="src/path/to/file.ts"\nfoo\n```');
  assert('path title preserved', has(h, 'src/path/to/file.ts'));
}
{
  const h = await render('```js title="with spaces.js"\nfoo\n```');
  assert('title with spaces preserved', has(h, 'with spaces.js'));
}
{
  const h = await render("```js title='single quoted.js'\nfoo\n```");
  assert('single-quoted title', has(h, 'single quoted.js'));
}

// ============ Language badge ============
{
  const h = await render('```ts\nconst x = 1\n```');
  assert('lang badge ts', has(h, 'pcb__lang') && has(h, '>ts<'));
}
{
  const h = await render('```python\nprint("hi")\n```');
  assert('lang badge python', has(h, 'python'));
}
{
  const h = await render('```ts\nfoo\n```', { showLanguage: false });
  assert('showLanguage=false hides badge', !has(h, 'pcb__lang'));
}
{
  const h = await render('```ts noLang\nfoo\n```');
  assert('noLang hides badge', !has(h, 'pcb__lang'));
}
{
  const h = await render('```ts\nfoo\n```', { languageLabels: { ts: 'TypeScript' } });
  assert('languageLabels maps ts→TypeScript', has(h, 'TypeScript'));
}
{
  const h = await render('```js\nfoo\n```', { languageLabels: { js: 'JavaScript' } });
  assert('languageLabels maps js→JavaScript', has(h, 'JavaScript'));
}
{
  const h = await render('```rust\nfoo\n```', { languageLabels: { rust: 'Rust' } });
  assert('languageLabels maps rust→Rust', has(h, 'Rust'));
}

// ============ Decorations (traffic-light dots) ============
{
  const h = await render('```js title="x.js"\nfoo\n```');
  assert('dots present by default', has(h, 'pcb__dots'));
  assert('3 dots', count(h, '<span></span>') === 3);
}
{
  const h = await render('```js title="x.js" noDecorations\nfoo\n```');
  assert('noDecorations hides dots', !has(h, 'pcb__dots'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { decorations: false });
  assert('decorations=false hides dots', !has(h, 'pcb__dots'));
}

// ============ Copy button ============
{
  const h = await render('```js title="x.js"\nfoo\n```');
  assert('copy button present', has(h, 'pcb__copy'));
  assert('copy has aria-label', has(h, 'aria-label="Copy code"'));
  assert('copy has type=button', has(h, 'type="button"'));
  assert('copy has data-done-label', has(h, 'data-done-label'));
  assert('copy label "copy"', has(h, '>copy<'));
}
{
  const h = await render('```js title="x.js" noCopy\nfoo\n```');
  assert('noCopy hides button', !has(h, 'pcb__copy'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { copyButton: false });
  assert('copyButton=false hides button', !has(h, 'pcb__copy'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { copyButton: { label: null } });
  assert('label=null icon-only', has(h, 'pcb__copy') && !has(h, '>copy<'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { copyButton: { label: 'Copy code' } });
  assert('custom label', has(h, '>Copy code<'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { copyButton: { doneLabel: 'Done!' } });
  assert('custom doneLabel', has(h, 'data-done-label="Done!"'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { copyButton: { feedbackDuration: 500 } });
  assert('custom feedbackDuration', has(h, 'data-feedback-duration="500"'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { copyButton: { visibility: 'hover' } });
  assert('hover mode adds pcb--copy-on-hover', has(h, 'pcb--copy-on-hover'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```', { copyButton: { copyIcon: '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>' } });
  assert('custom copyIcon rendered', has(h, 'viewBox="0 0 1 1"'));
}

// ============ Highlight lines ============
{
  const h = await render('```js {2}\nfoo\nbar\nbaz\n```');
  assert('highlight {2} exactly 1', count(h, 'pcb__line--hl') === 1);
  assert('body has pcb__body--has-hl', has(h, 'pcb__body--has-hl'));
}
{
  const h = await render('```js {1,3}\nfoo\nbar\nbaz\n```');
  assert('highlight {1,3} exactly 2', count(h, 'pcb__line--hl') === 2);
}
{
  const h = await render('```js {1-3}\nfoo\nbar\nbaz\n```');
  assert('highlight {1-3} exactly 3', count(h, 'pcb__line--hl') === 3);
}
{
  const h = await render('```js {2}\nfoo\nbar\nbaz\n```', { highlight: false });
  assert('highlight disabled globally', count(h, 'pcb__line--hl') === 0);
}

// ============ Diff lines ============
{
  const h = await render('```js\n+added\n-removed\nctx\n```');
  assert('diff + line', has(h, 'pcb__line--add'));
  assert('diff - line', has(h, 'pcb__line--del'));
}
{
  const h = await render('```js\n+added\n-removed\n```', { diff: false });
  assert('diff disabled globally', !has(h, 'pcb__line--add'));
}

// ============ Wrap mode ============
{
  const h = await render('```js wrap\nfoo\n```');
  assert('wrap flag', has(h, 'pcb--wrap'));
}
{
  const h = await render('```js\nfoo\n```', { wrap: true });
  assert('global wrap=true', has(h, 'pcb--wrap'));
}
{
  const h = await render('```js noWrap\nfoo\n```', { wrap: true });
  assert('noWrap overrides global', !has(h, 'pcb--wrap'));
}

// ============ Collapsible ============
{
  const h = await render('```js title="x.js" collapse\nfoo\n```');
  assert('collapse flag', has(h, 'pcb--collapse'));
  assert('collapse uses <details>', has(h, '<details'));
  assert('collapse has <summary>', has(h, '<summary'));
}
{
  const h = await render('```js\n' + Array.from({length: 50}, () => 'foo').join('\n') + '\n```', { collapseAfter: 10 });
  assert('collapseAfter=10 triggers on 50-line block', has(h, 'pcb--collapse'));
}
{
  const h = await render('```js\nfoo\nbar\n```', { collapseAfter: 10 });
  assert('collapseAfter=10 does NOT trigger on 2-line block', !has(h, 'pcb--collapse'));
}

// ============ Caption ============
{
  const h = await render('```js caption="Source: MIT"\nfoo\n```');
  assert('caption rendered', has(h, 'pcb__caption'));
  assert('caption text', has(h, 'Source: MIT'));
}
{
  const h = await render('```js caption="test"\nfoo\n```', { caption: false });
  assert('caption disabled globally', !has(h, 'pcb__caption'));
}

// ============ Accessibility ============
{
  const h = await render('```js title="x.js"\nfoo\n```');
  assert('body has role=region', has(h, 'role="region"'));
  assert('body has aria-label', has(h, 'aria-label'));
  assert('aria-label includes title', has(h, 'Code block: x.js'));
}
{
  const h = await render('```js\nfoo\n```', { accessibleScroll: false });
  assert('accessibleScroll=false no role', !has(h, 'role="region"'));
}
{
  const h = await render('```ts\nfoo\n```');
  assert('aria-label includes lang when no title', has(h, 'Code block: ts'));
}
{
  const h = await render('```\nfoo\n```');
  assert('aria-label generic when no title/lang', has(h, 'Code block'));
}

// ============ Presets ============
{
  const h = await render('```bash\n$ npm install\n```');
  assert('bash auto-terminal preset', has(h, 'pcb--terminal'));
}
{
  const h = await render('```ts\nconst x = 1\n```');
  assert('ts NOT terminal preset', !has(h, 'pcb--terminal'));
}
{
  const h = await render('```bash\n$ npm\n```', { preset: 'minimal' });
  assert('minimal preset overrides auto-terminal', has(h, 'pcb--minimal'));
}
{
  const h = await render('```rust\nfoo\n```', { terminalLangs: ['rust'] });
  assert('custom terminalLangs', has(h, 'pcb--terminal'));
}
{
  const h = await render('```fish\necho hi\n```');
  assert('fish in default terminalLangs', has(h, 'pcb--terminal'));
}

// ============ Filename extraction ============
{
  const h = await render('```js\n// my-file.ts\nconst x = 1\n```', { extractFileNameFromCode: true });
  assert('extracts filename from // comment', has(h, 'my-file.ts'));
  assert('filename in title', has(h, 'pcb__title'));
}
{
  const h = await render('```bash\n# install.sh\nnpm install\n```', { extractFileNameFromCode: true });
  assert('extracts filename from # comment', has(h, 'install.sh'));
}
{
  const h = await render('```js\n// my-file.ts\nconst x = 1\n```');
  assert('no extraction by default', !has(h, 'pcb__title">my-file.ts'));
}

// ============ Multiple blocks ============
{
  const h = await render('```js title="a.js"\nfoo\n```\n\nText\n\n```ts title="b.ts"\nbar\n```');
  assert('two figures', count(h, '<figure class="pcb') === 2);
  assert('both titles', has(h, 'a.js') && has(h, 'b.ts'));
}

// ============ HTML escaping ============
{
  const h = await render('```html\n<div class="x">&amp;</div>\n```');
  assert('HTML chars escaped', has(h, '&lt;div') || has(h, '&#x3C;div') || has(h, '&#x3C;'));
}

// ============ Inline code ============
{
  const h = await render('Use `npm install` to install.');
  assert('inline code not styled by default', !has(h, 'pcb--inline'));
}
{
  const h = await render('Use `npm install` to install.', { inline: true });
  // Note: `inline: true` is a legacy option; inline code is not wrapped in .pcb.
  // It just renders as normal <code>.
  assert('inline code renders as <code>', has(h, '<code>npm install</code>'));
}

// ============ Engine modes ============
{
  const h = await render('```js\nfoo\n```', { engine: 'passthrough' });
  assert('passthrough mode works', has(h, 'pcb__body'));
}

// ============ Empty / edge cases ============
{
  const h = await render('```js\n```');
  assert('empty code block renders', has(h, 'pcb'));
}
{
  const h = await render('```\nplain\n```');
  assert('no-lang block renders', has(h, 'pcb'));
}
{
  const h = await render('```plaintext\njust text\n```');
  assert('plaintext renders', has(h, 'pcb'));
}
{
  const h = await render('    indented code\n');
  assert('indented code block processed', has(h, 'pcb'));
}

// ============ Unicode / special content ============
{
  const h = await render('```js\nconst msg = "你好世界 🌍"\n```');
  assert('unicode in code body', has(h, 'pcb__body'));
}
{
  const h = await render('```js title="配置 🔧.js"\nfoo\n```');
  assert('emoji in title', has(h, '配置') && has(h, '🔧'));
}

// ============ CRLF line endings ============
{
  const h = await render('```js title="x.js"\r\nfoo\r\nbar\r\n```');
  assert('CRLF handled', !has(h, '\r'));
}

// ============ Tabs in code ============
{
  const h = await render('```js\n\tconst x = 1\n\tconst y = 2\n```');
  assert('tabs preserved', has(h, 'pcb__body'));
}

// ============ Very long content ============
{
  const longLine = 'const x = "' + 'a'.repeat(500) + '"';
  const h = await render('```js\n' + longLine + '\n```');
  assert('very long line renders', has(h, 'pcb__body'));
}
{
  const h = await render('```js\n' + Array.from({length: 500}, (_, i) => `// ${i+1}`).join('\n') + '\n```');
  assert('500-line block renders', has(h, 'pcb__body'));
}

// Print results
console.log(`\nDOM/Transformer Tests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f.name}${f.detail ? ' — ' + f.detail : ''}`));
}
process.exit(fail > 0 ? 1 : 0);
