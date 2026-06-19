/**
 * Regression tests for the architecture improvements (Patterns 1–5) adopted
 * from community packages.
 *
 * Pattern 1: Highlighter task queue (from expressive-code)
 * Pattern 2: Color-contrast-aware theme defaults (from expressive-code)
 * Pattern 3: disposeHighlighter() lifecycle (from VitePress)
 * Pattern 4: Event-delegation copy button + MutationObserver (from VitePress + expressive-code)
 * Pattern 5: Word-level diff (selective adoption from expressive-code)
 *
 * Run with: node test-architecture-patterns.mjs
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import {
  rehypePerfectCodeBlocks,
  remarkPreserveCodeMeta,
  disposeHighlighter,
  runHighlighterTask,
  wordDiff,
  hasChanges,
} from '../rehype-perfect-code-blocks/dist/index.js';

let pass = 0;
let fail = 0;
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
  if (cond) {
    pass++;
    console.log(`  [PASS] ${name}`);
  } else {
    fail++;
    failures.push({ name, detail });
    console.log(`  [FAIL] ${name}${detail ? ' — ' + detail : ''}`);
  }
}

console.log('Running architecture-pattern regression tests...\n');

// ===========================================================================
// Pattern 1: Highlighter task queue (from expressive-code)
// ===========================================================================

console.log('1. Highlighter task queue (Pattern 1):');

{
  // The queue should serialize tasks. Verify by submitting 5 tasks that each
  // record their start order; they should complete in submission order.
  const completionOrder = [];
  const tasks = [];
  for (let i = 0; i < 5; i++) {
    tasks.push(
      runHighlighterTask(async () => {
        // Add a small random delay to test serialization.
        await new Promise((r) => setTimeout(r, Math.random() * 20));
        completionOrder.push(i);
        return i;
      })
    );
  }
  await Promise.all(tasks);
  const expected = [0, 1, 2, 3, 4];
  assert(
    '  tasks complete in submission order (serialized)',
    JSON.stringify(completionOrder) === JSON.stringify(expected),
    `got ${JSON.stringify(completionOrder)}, expected ${JSON.stringify(expected)}`
  );
}

{
  // The queue should handle errors without breaking subsequent tasks.
  let secondTaskRan = false;
  try {
    await runHighlighterTask(async () => { throw new Error('test error'); });
  } catch (e) {
    // expected
  }
  try {
    await runHighlighterTask(async () => { secondTaskRan = true; });
  } catch (e) { /* ignore */ }
  assert('  queue continues after a task throws', secondTaskRan);
}

{
  // runHighlighterTask should be exported.
  assert('  runHighlighterTask is exported', typeof runHighlighterTask === 'function');
}

// ===========================================================================
// Pattern 2: Color-contrast-aware theme defaults (from expressive-code)
// ===========================================================================

console.log('\n2. Color-contrast-aware theme defaults (Pattern 2):');

{
  const html = await render('```js\nconst x = 1;\n```\n', {
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
  });
  // The <pre> should have a style attribute with --pcb-* defaults derived
  // from the github-dark theme.
  const preMatch = html.match(/<pre[^>]*style="([^"]*)"/);
  assert('  <pre> has style attribute', !!preMatch);
  if (preMatch) {
    const style = preMatch[1];
    assert('  style contains --pcb-bg', style.includes('--pcb-bg:'));
    assert('  style contains --pcb-fg', style.includes('--pcb-fg:'));
    assert('  style contains --pcb-ln-fg', style.includes('--pcb-ln-fg:'));
    assert('  style contains --pcb-line-highlight-bg', style.includes('--pcb-line-highlight-bg:'));
    assert('  style contains --pcb-line-add-bg', style.includes('--pcb-line-add-bg:'));
    assert('  style contains --pcb-line-del-bg', style.includes('--pcb-line-del-bg:'));
    // github-dark bg is #24292e
    assert('  --pcb-bg matches github-dark bg (#24292e)', /--pcb-bg:#24292e/i.test(style));
    // github-dark fg is #e1e4e8
    assert('  --pcb-fg matches github-dark fg (#e1e4e8)', /--pcb-fg:#e1e4e8/i.test(style));
  }
}

{
  // With a different theme, the defaults should differ.
  const htmlDracula = await render('```js\nconst x = 1;\n```\n', {
    shiki: { theme: { light: 'github-light', dark: 'dracula' } },
  });
  const htmlGithubDark = await render('```js\nconst x = 1;\n```\n', {
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
  });
  const draculaStyle = htmlDracula.match(/<pre[^>]*style="([^"]*)"/)?.[1] ?? '';
  const ghStyle = htmlGithubDark.match(/<pre[^>]*style="([^"]*)"/)?.[1] ?? '';
  assert('  dracula theme produces different defaults than github-dark', draculaStyle !== ghStyle);
}

// ===========================================================================
// Pattern 3: disposeHighlighter() lifecycle (from VitePress)
// ===========================================================================

console.log('\n3. disposeHighlighter() lifecycle (Pattern 3):');

{
  assert('  disposeHighlighter is exported', typeof disposeHighlighter === 'function');

  // Render something to populate the highlighter cache.
  await render('```js\nconst x = 1;\n```\n');

  // Dispose should not throw.
  let threw = false;
  try {
    disposeHighlighter();
  } catch (e) {
    threw = true;
  }
  assert('  disposeHighlighter() does not throw', !threw);

  // After dispose, a new render should still work (creates a fresh highlighter).
  const html = await render('```js\nconst y = 2;\n```\n');
  assert('  render works after disposeHighlighter()', typeof html === 'string' && html.length > 0);
}

// ===========================================================================
// Pattern 4: Event-delegation copy button + MutationObserver (from VitePress + expressive-code)
// ===========================================================================

console.log('\n4. Event-delegation copy button + MutationObserver (Pattern 4):');

{
  // The copy script (COPY_SCRIPT) is bundled in dist/copy-script.js.
  // Read it and check for the key Pattern 4 elements.
  const fs = await import('node:fs');
  const copyScript = fs.readFileSync(
    new URL('../rehype-perfect-code-blocks/dist/copy-script.js', import.meta.url),
    'utf8'
  );

  // The script should use event delegation (document.addEventListener('click', ...)).
  assert(
    '  copy script uses document.addEventListener("click") (event delegation)',
    /document\.addEventListener\(\s*['"]click['"]/.test(copyScript)
  );

  // The script should use closest('.pcb__copy') for selector matching.
  assert(
    '  copy script uses closest(".pcb__copy") for selector matching',
    /closest\(\s*['"]\.pcb__copy['"]/.test(copyScript)
  );

  // The script should register a MutationObserver.
  assert(
    '  copy script registers a MutationObserver',
    /new MutationObserver/.test(copyScript)
  );

  // The script should listen for astro:page-load (Astro view transitions).
  assert(
    '  copy script listens for astro:page-load',
    /astro:page-load/.test(copyScript)
  );

  // The script should NOT use inline onclick handlers (CSP-hostile).
  assert(
    '  copy script does NOT use inline onclick',
    !/onclick\s*=/.test(copyScript)
  );
}

// ===========================================================================
// Pattern 5: Word-level diff (selective adoption from expressive-code)
// ===========================================================================

console.log('\n5. Word-level diff (Pattern 5):');

{
  // The wordDiff() utility should be exported and work standalone.
  assert('  wordDiff is exported', typeof wordDiff === 'function');
  assert('  hasChanges is exported', typeof hasChanges === 'function');

  const tokens = wordDiff('const x = 1', 'const y = 2');
  assert('  wordDiff returns array', Array.isArray(tokens));
  assert('  wordDiff has changes', hasChanges(tokens));

  // 'const ' should be 'equal' (unchanged).
  const equalTokens = tokens.filter((t) => t.type === 'equal');
  const equalText = equalTokens.map((t) => t.text).join('');
  assert('  equal tokens include "const "', equalText.includes('const '));

  // 'x' should be 'del', 'y' should be 'add'.
  const delTokens = tokens.filter((t) => t.type === 'del').map((t) => t.text).join('');
  const addTokens = tokens.filter((t) => t.type === 'add').map((t) => t.text).join('');
  assert('  del tokens include "x"', delTokens.includes('x'));
  assert('  add tokens include "y"', addTokens.includes('y'));
}

{
  // wordDiff: identical strings → no changes.
  const tokens = wordDiff('hello world', 'hello world');
  assert('  identical strings produce no changes', !hasChanges(tokens));
}

{
  // wordDiff: completely different strings → all add/del.
  const tokens = wordDiff('aaa', 'bbb');
  assert('  completely different strings produce changes', hasChanges(tokens));
  const delText = tokens.filter((t) => t.type === 'del').map((t) => t.text).join('');
  const addText = tokens.filter((t) => t.type === 'add').map((t) => t.text).join('');
  assert('  del text is "aaa"', delText === 'aaa');
  assert('  add text is "bbb"', addText === 'bbb');
}

{
  // End-to-end: with wordDiff: true, diff lines should get <mark> wrappers.
  const md = '```js\n- const x = 1;\n+ const y = 2;\n```\n';
  const html = await render(md, { wordDiff: true });
  const marks = [...html.matchAll(/<mark[^>]*class="([^"]*pcb__word-diff[^"]*)"[^>]*>([^<]*)<\/mark>/g)];
  assert('  wordDiff: true produces <mark> elements', marks.length > 0);
  assert('  marks include pcb__word-diff--del', marks.some((m) => m[1].includes('pcb__word-diff--del')));
  assert('  marks include pcb__word-diff--add', marks.some((m) => m[1].includes('pcb__word-diff--add')));
  // The del mark should contain 'x' (the changed word).
  const delMarks = marks.filter((m) => m[1].includes('pcb__word-diff--del'));
  const delText = delMarks.map((m) => m[2]).join('');
  assert('  del marks contain "x"', delText.includes('x'));
  // The add mark should contain 'y'.
  const addMarks = marks.filter((m) => m[1].includes('pcb__word-diff--add'));
  const addText = addMarks.map((m) => m[2]).join('');
  assert('  add marks contain "y"', addText.includes('y'));
}

{
  // Without wordDiff (default), no <mark> elements should appear.
  const md = '```js\n- const x = 1;\n+ const y = 2;\n```\n';
  const html = await render(md, {}); // wordDiff defaults to false
  const marks = [...html.matchAll(/<mark[^>]*pcb__word-diff/g)];
  assert('  wordDiff defaults to false (no marks)', marks.length === 0);
}

{
  // wordDiff should work with multi-word changes.
  const md = '```js\n- function foo() { return 1; }\n+ function bar() { return 2; }\n```\n';
  const html = await render(md, { wordDiff: true });
  const marks = [...html.matchAll(/<mark[^>]*class="([^"]*pcb__word-diff[^"]*)"[^>]*>([^<]*)<\/mark>/g)];
  assert('  multi-word diff produces marks', marks.length > 0);
  const allText = marks.map((m) => m[2]).join('');
  assert('  marks contain "foo" (changed)', allText.includes('foo'));
  assert('  marks contain "bar" (changed)', allText.includes('bar'));
}

// ===========================================================================
// Summary
// ===========================================================================

console.log('\n────────────────────────────────────────────────────────────────────────');
console.log(`\nResult: ${pass}/${pass + fail} passed, ${fail} failed`);

if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
  }
  process.exit(1);
}
