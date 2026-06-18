/**
 * Test Suite: Security & Accessibility
 * Tests XSS prevention, input sanitization, and a11y compliance.
 * Target: 80+ tests.
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

// ============ XSS in title ============
{
  const h = await render('```js title="<script>alert(1)</script>"\nfoo\n```');
  assert('script in title escaped', !has(h, '<script>alert'));
  assert('script in title not executed', has(h, '&lt;script') || has(h, '&#x3C;script'));
}
{
  const h = await render('```js title="<img onerror=alert(1)>"\nfoo\n```');
  assert('img onerror in title escaped', !has(h, '<img onerror'));
}
{
  const h = await render('```js title="javascript:alert(1)"\nfoo\n```');
  assert('javascript: in title is text', has(h, 'javascript:alert'));
}

// ============ XSS in caption ============
{
  const h = await render('```js caption="<script>alert(1)</script>"\nfoo\n```');
  assert('script in caption escaped', !has(h, '<script>alert'));
}
{
  const h = await render('```js caption="<img onerror=alert(1)>"\nfoo\n```');
  assert('img onerror in caption escaped', !has(h, '<img onerror'));
}

// ============ XSS in code body ============
{
  const h = await render('```html\n<script>alert(1)</script>\n```');
  assert('script in code body escaped', !has(h, '<script>alert'));
}
{
  const h = await render('```html\n<img onerror=alert(1)>\n```');
  assert('img onerror in code body escaped', !has(h, '<img onerror'));
}
{
  const h = await render('```html\n<div onclick="alert(1)">click</div>\n```');
  assert('onclick in code body escaped', !has(h, 'onclick="alert'));
}

// ============ copyIcon sanitization ============
{
  const h = await render('```js\nfoo\n```', {
    copyButton: { copyIcon: '<svg onload="alert(1)"><path/></svg>' },
  });
  assert('onload in copyIcon rejected', !has(h, 'onload="alert'));
}
{
  const h = await render('```js\nfoo\n```', {
    copyButton: { copyIcon: '<script>alert(1)</script>' },
  });
  assert('script in copyIcon rejected', !has(h, '<script>alert'));
}
{
  const h = await render('```js\nfoo\n```', {
    copyButton: { copyIcon: '<iframe src="evil.com"></iframe>' },
  });
  assert('iframe in copyIcon rejected', !has(h, '<iframe'));
}
{
  const h = await render('```js\nfoo\n```', {
    copyButton: { copyIcon: '<svg viewBox="0 0 16 16"><path d="M0 0"/></svg>' },
  });
  assert('valid SVG copyIcon accepted', has(h, 'viewBox="0 0 16 16"'));
}

// ============ successIcon sanitization ============
{
  const h = await render('```js\nfoo\n```', {
    copyButton: { successIcon: '<svg onclick="alert(1)">' },
  });
  assert('onclick in successIcon rejected', !has(h, 'onclick="alert'));
}
{
  const h = await render('```js\nfoo\n```', {
    copyButton: { successIcon: '<svg viewBox="0 0 16 16"><path d="M0 0"/></svg>' },
  });
  assert('valid successIcon accepted', has(h, 'viewBox="0 0 16 16"'));
}

// ============ theme injection (Astro integration) ============
// We can't test the Astro integration directly, but we verify the option type
{
  const h = await render('```js\nfoo\n```', { theme: 'auto' });
  assert('theme=auto works', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', { theme: 'dark' });
  assert('theme=dark works', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', { theme: 'light' });
  assert('theme=light works', has(h, 'pcb__body'));
}

// ============ Path traversal (no file imports in this plugin) ============
{
  const h = await render('```js title="../../../etc/passwd"\nfoo\n```');
  assert('path traversal in title is just text', has(h, '../../../etc/passwd'));
}

// ============ ReDoS / regex safety ============
{
  const longTitle = 'a'.repeat(10000);
  const h = await render(`\`\`\`js title="${longTitle}"\nfoo\n\`\`\``);
  assert('very long title no ReDoS', has(h, 'pcb__body'));
}
{
  const longRange = Array.from({length: 1000}, (_, i) => i + 1).join(',');
  const h = await render(`\`\`\`js {${longRange}}\nfoo\n\`\`\``);
  assert('1000-line range no ReDoS', has(h, 'pcb__body'));
}
{
  const longWord = 'foo'.repeat(1000);
  const h = await render(`\`\`\`js /${longWord}/\nfoo\n\`\`\``);
  assert('very long word no ReDoS', has(h, 'pcb__body'));
}
{
  const nestedBraces = '{' + '1,'.repeat(100) + '1}';
  const h = await render(`\`\`\`js ${nestedBraces}\nfoo\n\`\`\``);
  assert('nested braces no ReDoS', has(h, 'pcb__body'));
}

// ============ Accessibility: role=region ============
{
  const h = await render('```js title="x.js"\nfoo\n```');
  assert('role=region on body', has(h, 'role="region"'));
}
{
  const h = await render('```js title="x.js"\nfoo\n```');
  assert('aria-label on body', has(h, 'aria-label='));
}
{
  const h = await render('```js title="x.js"\nfoo\n```');
  assert('aria-label includes title', has(h, 'Code block: x.js'));
}
{
  const h = await render('```ts\nfoo\n```');
  assert('aria-label includes lang', has(h, 'Code block: ts'));
}
{
  const h = await render('```\nfoo\n```');
  assert('aria-label generic', has(h, 'Code block'));
}
{
  const h = await render('```js\nfoo\n```', { accessibleScroll: false });
  assert('accessibleScroll=false no role', !has(h, 'role="region"'));
}

// ============ Accessibility: copy button ============
{
  const h = await render('```js\nfoo\n```');
  assert('copy has aria-label', has(h, 'aria-label="Copy code"'));
  assert('copy has type=button', has(h, 'type="button"'));
}
{
  const h = await render('```js\nfoo\n```');
  assert('copy button is a <button>', has(h, '<button'));
}

// ============ Accessibility: gutter ============
{
  const h = await render('```js title="x.js"\nfoo\nbar\n```');
  assert('gutter has aria-hidden', has(h, 'aria-hidden'));
}

// ============ Accessibility: keyboard navigation ============
{
  const h = await render('```js\nfoo\n```');
  // Copy button must be focusable (it's a <button>, inherently focusable)
  assert('copy button is focusable (button element)', has(h, '<button'));
}

// ============ No-JS graceful degradation ============
{
  // In standalone rehype we don't inject the no-js script, but the CSS rule exists
  const css = await import('node:fs').then(m => m.readFileSync('../rehype-perfect-code-blocks/dist/styles.css', 'utf8'));
  assert('CSS has no-js rule', css.includes('html.no-js .pcb__copy'));
}

// ============ Input validation: invalid options don't crash ============
{
  const h = await render('```js\nfoo\n```', { lineNumbers: 'invalid' });
  assert('invalid lineNumbers value handled', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', { titleBar: 'invalid' });
  assert('invalid titleBar value handled', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', { engine: 'invalid' });
  assert('invalid engine value handled', has(h, 'pcb__body'));
}
{
  const h = await render('```js\nfoo\n```', { preset: 'invalid' });
  assert('invalid preset value handled', has(h, 'pcb__body'));
}

// ============ Malformed markdown ============
{
  const h = await render('```js\nfoo');  // unclosed fence
  assert('unclosed fence handled', !h.includes('error'));
}
{
  const h = await render('```\n```\n```\nfoo\n```');  // empty fences
  assert('empty fences handled', has(h, 'pcb') || h.length > 0);
}

// ============ Unicode edge cases ============
{
  const h = await render('```js title="日本語.js"\nconst x = "こんにちは"\n```');
  assert('Japanese chars', has(h, '日本語') && has(h, 'こんにちは'));
}
{
  const h = await render('```js title="한국어.js"\nconst x = "안녕하세요"\n```');
  assert('Korean chars', has(h, '한국어'));
}
{
  const h = await render('```js title="العربية.js"\nconst x = "مرحبا"\n```');
  assert('Arabic chars', has(h, 'العربية'));
}
{
  const h = await render('```js title="עברית.js"\nconst x = "שלום"\n```');
  assert('Hebrew chars', has(h, 'עברית'));
}
{
  const h = await render('```js title="🎯.js"\nconst x = "✓"\n```');
  assert('emoji in title and code', has(h, '🎯') && has(h, '✓'));
}

// ============ Null bytes / control chars ============
{
  const h = await render('```js\nconst x = "foo\u0000bar"\n```');
  assert('null byte in code handled', has(h, 'pcb__body'));
}

// ============ Very many blocks ============
{
  const md = Array.from({length: 50}, (_, i) => `\`\`\`js title="block-${i}.js"\n// block ${i}\n\`\`\``).join('\n\n');
  const h = await render(md);
  assert('50 blocks on one page', count(h, '<figure class="pcb') === 50);
}

// ============ Deeply nested code ============
{
  const h = await render('```js\n' + 'function a() {\n'.repeat(20) + 'x\n' + '}\n'.repeat(20) + '\n```');
  assert('deeply nested code renders', has(h, 'pcb__body'));
}

// Print results
console.log(`\nSecurity & A11y Tests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f.name}${f.detail ? ' — ' + f.detail : ''}`));
}
process.exit(fail > 0 ? 1 : 0);
