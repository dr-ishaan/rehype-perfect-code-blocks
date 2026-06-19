/**
 * Regression tests for issue #11 — `{1-1000000}` line-highlight range
 * causes `RangeError: Maximum call stack size exceeded` (DoS vector).
 *
 * Before the fix, a fenced code block whose meta string requested a very
 * large line-highlight range (e.g. {1-1000000}) would throw:
 *
 *   RangeError: Maximum call stack size exceeded
 *
 * This happened because:
 *   1. parseRanges() expanded `{1-1000000}` into a 1,000,000-element Set
 *      via a `for` loop.
 *   2. The call site then did `result.highlight.push(...lines)`, where the
 *      spread operator on a 1M-element array exhausted V8's call stack
 *      (spread passes each element as a separate stack argument, and V8
 *      caps this at ~100k args).
 *
 * After the fix:
 *   - parseRanges() short-circuits ranges whose total span exceeds 10,000
 *     lines, returning an empty array (skip highlighting for that spec).
 *   - The call site uses a `for` loop instead of `push(...lines)` so even
 *     a future code path that bypasses the cap can't blow the stack.
 *
 * The block still renders normally — it just doesn't have line-highlighting
 * applied. This is the correct behavior: a request to highlight 1,000,000
 * lines is either a typo or an abuse attempt, not a real use case.
 *
 * Run with: node test-issue-11.mjs
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import {
  rehypePerfectCodeBlocks,
  remarkPreserveCodeMeta,
} from '../rehype-perfect-code-blocks/dist/index.js';
import { parseMeta } from '../rehype-perfect-code-blocks/dist/meta.js';

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

async function assertRenders(name, md, opts = {}) {
  try {
    const html = await render(md, opts);
    assert(name, typeof html === 'string' && html.length > 0, `got len=${html?.length}`);
    return html;
  } catch (e) {
    assert(name, false, `threw: ${e?.message ?? String(e)}`);
    return null;
  }
}

console.log('Running regression tests for issue #11 (line-range stack overflow)...\n');

// ---------------------------------------------------------------------------
// 1. Unit tests for parseMeta — the bug is in parseRanges, called by parseMeta.
// ---------------------------------------------------------------------------

console.log('1. parseMeta unit tests (the underlying bug):');

{
  // The exact repro from issue #11.
  const t0 = Date.now();
  let result;
  try {
    result = parseMeta('fsharp {1-1000000}');
    const elapsed = Date.now() - t0;
    assert(
      '{1-1000000} does not throw',
      true,
      `took ${elapsed}ms`
    );
    assert(
      '  highlight array is empty (range exceeds cap)',
      result.highlight.length === 0,
      `got length ${result.highlight.length}`
    );
  } catch (e) {
    assert('{1-1000000} does not throw', false, e.message);
  }
}

{
  // Multiple huge ranges combined.
  try {
    const result = parseMeta('js {1-500000} {1-500000}');
    assert(
      'multiple huge ranges do not throw',
      true
    );
    assert(
      '  highlight array is empty',
      result.highlight.length === 0,
      `got length ${result.highlight.length}`
    );
  } catch (e) {
    assert('multiple huge ranges do not throw', false, e.message);
  }
}

{
  // Just over the cap.
  const result = parseMeta('js {1-10001}');
  assert(
    '{1-10001} (just over 10k cap) returns empty',
    result.highlight.length === 0,
    `got length ${result.highlight.length}`
  );
}

{
  // Exactly at the cap — should still work.
  const result = parseMeta('js {1-10000}');
  assert(
    '{1-10000} (exactly at cap) returns all 10000 lines',
    result.highlight.length === 10000,
    `got length ${result.highlight.length}`
  );
}

{
  // Just under the cap.
  const result = parseMeta('js {1-9999}');
  assert(
    '{1-9999} (just under cap) returns all 9999 lines',
    result.highlight.length === 9999,
    `got length ${result.highlight.length}`
  );
}

// ---------------------------------------------------------------------------
// 2. Normal ranges still work — no false positives.
// ---------------------------------------------------------------------------

console.log('\n2. Normal ranges still work (no false positives):');

{
  const r = parseMeta('js {1,3-5}');
  assert(
    '{1,3-5} → [1,3,4,5]',
    JSON.stringify(r.highlight) === '[1,3,4,5]',
    `got ${JSON.stringify(r.highlight)}`
  );
}

{
  const r = parseMeta('js {1-10}');
  assert(
    '{1-10} → [1..10]',
    r.highlight.length === 10 && r.highlight[0] === 1 && r.highlight[9] === 10,
    `got ${JSON.stringify(r.highlight)}`
  );
}

{
  const r = parseMeta('js {1,2,3,4,5}');
  assert(
    '{1,2,3,4,5} → [1,2,3,4,5]',
    JSON.stringify(r.highlight) === '[1,2,3,4,5]',
    `got ${JSON.stringify(r.highlight)}`
  );
}

{
  const r = parseMeta('js {1-3,7,10-12}');
  assert(
    '{1-3,7,10-12} → [1,2,3,7,10,11,12]',
    JSON.stringify(r.highlight) === '[1,2,3,7,10,11,12]',
    `got ${JSON.stringify(r.highlight)}`
  );
}

{
  // Whitespace-insensitive: {1, 3 - 5, 7} should normalize to {1,3-5,7}
  const r = parseMeta('js {1, 3 - 5, 7}');
  assert(
    '{1, 3 - 5, 7} (whitespace) → [1,3,4,5,7]',
    JSON.stringify(r.highlight) === '[1,3,4,5,7]',
    `got ${JSON.stringify(r.highlight)}`
  );
}

{
  // Zero / negative / malformed entries are skipped (pre-existing behavior).
  const r = parseMeta('js {0,-1,1-0,1}');
  // {0} and {-1} don't match /^(\d+)(?:-(\d+))?$/ so they're skipped.
  // {1-0} parses as start=1, end=0 → lo=0, hi=1 → [0,1].
  // {1} → [1].
  // Combined Set: {0, 1}.
  assert(
    '{0,-1,1-0,1} (malformed) does not throw',
    r.highlight.length >= 0,
    `got ${JSON.stringify(r.highlight)}`
  );
}

// ---------------------------------------------------------------------------
// 3. End-to-end: the full pipeline no longer crashes on the repro from
//    the issue. This is the core fix — the throw is gone, the block renders.
// ---------------------------------------------------------------------------

console.log('\n3. End-to-end pipeline tests (issue #11 repro):');

{
  // The exact repro from the issue body.
  const md = '```fsharp {1-1000000}\nline 1\nline 2\nline 3\n```\n';
  const html = await assertRenders(
    '```fsharp {1-1000000} renders without throwing',
    md
  );
  if (html) {
    // The block should still render — that's the core fix.
    assert('  output contains <figure class="pcb"', /<figure[^>]*class="[^"]*\bpcb\b/.test(html));
    // The code text is tokenized by Shiki (e.g. "line " + "1" as separate
    // spans), so we check for the tokens individually with word boundaries.
    assert('  output contains "line" token', /line/.test(html));
    assert('  output contains "1" token', /[^0-9]1[^0-9]/.test(html));
    assert('  output contains "3" token', /[^0-9]3[^0-9]/.test(html));
    // Note: pcb__line--hl MAY still be present because Shiki's own
    // transformerMetaHighlight reads the meta string independently and
    // applies the class. That's correct behavior — the user asked for
    // lines 1-1000000 to be highlighted, and lines 1-3 are in that range.
    // The bug was the THROW, not the highlighting.
  }
}

{
  // Various languages with the huge range — all should render without throwing.
  const langs = ['js', 'ts', 'python', 'rust', 'go', 'c', 'cpp', 'ruby', 'bash', 'json'];
  for (const lang of langs) {
    const md = '```' + lang + ' {1-1000000}\nfoo\nbar\nbaz\n```\n';
    const html = await assertRenders(
      `mixed lang ${lang} with {1-1000000} renders`,
      md
    );
    if (html) {
      // Code text is tokenized; check for the bare token "foo" which
      // is a single identifier in most languages.
      assert(`  ${lang}: output contains "foo"`, /foo/.test(html));
    }
  }
}

{
  // Multiple blocks in one document — none should crash.
  const md = [
    '# DoS Test',
    '',
    '```js {1-1000000}',
    'const a = 1;',
    '```',
    '',
    'Some text in between.',
    '',
    '```python {1-999999}',
    'b = 2',
    '```',
    '',
    'More text.',
    '',
    '```rust {1-500000}',
    'fn main() {}',
    '```',
    '',
  ].join('\n');
  const html = await assertRenders(
    '3-block document with huge ranges renders fully',
    md
  );
  if (html) {
    // Code text is tokenized; check for individual tokens with word boundaries.
    // Shiki groups whitespace with the following token (e.g. "const", " a", " ="),
    // so we check for the bare identifier with non-letter neighbors.
    assert('  contains "const" token', /const/.test(html));
    assert('  contains "a" variable', /[^a-zA-Z]a[^a-zA-Z]/.test(html));
    assert('  contains "b" variable', /[^a-zA-Z]b[^a-zA-Z]/.test(html));
    assert('  contains "fn" token', /fn/.test(html));
    assert('  contains "main" token', /main/.test(html));
    // Non-code markdown text appears as plain text.
    assert('  contains "Some text in between."', /Some text in between\./.test(html));
    assert('  contains "More text."', /More text\./.test(html));
  }
}

// ---------------------------------------------------------------------------
// 4. Performance: the fix should be fast (sub-100ms) even for pathological
//    inputs. Before the fix, the throw happened "instantly" — but a
//    naive fix that expanded the full range and then filtered would be
//    slow (50ms+ for 1M elements).
// ---------------------------------------------------------------------------

console.log('\n4. Performance: pathological inputs return quickly:');

{
  const t0 = Date.now();
  parseMeta('js {1-1000000}');
  const elapsed = Date.now() - t0;
  assert(
    '{1-1000000} parses in <100ms',
    elapsed < 100,
    `took ${elapsed}ms`
  );
}

{
  const t0 = Date.now();
  parseMeta('js {1-1000000000}');
  const elapsed = Date.now() - t0;
  assert(
    '{1-1000000000} (even larger) parses in <100ms',
    elapsed < 100,
    `took ${elapsed}ms`
  );
}

{
  const t0 = Date.now();
  parseMeta('js {1-999999999999999999999}');
  const elapsed = Date.now() - t0;
  assert(
    'absurdly large range parses in <100ms',
    elapsed < 100,
    `took ${elapsed}ms`
  );
}

// ---------------------------------------------------------------------------
// 5. The cap doesn't break the realistic large-block use case.
//    A 5000-line code block with {1,1000,2000,3000,4000,5000} is unusual
//    but legitimate — it should still work.
// ---------------------------------------------------------------------------

console.log('\n5. Realistic large-block use cases still work:');

{
  const r = parseMeta('js {1,1000,2000,3000,4000,5000}');
  assert(
    '{1,1000,2000,3000,4000,5000} → 6 lines',
    r.highlight.length === 6 &&
    r.highlight[0] === 1 &&
    r.highlight[5] === 5000,
    `got ${JSON.stringify(r.highlight)}`
  );
}

{
  // A 5000-line range — under cap, should still work.
  const r = parseMeta('js {1000-6000}');
  assert(
    '{1000-6000} → 5001 lines',
    r.highlight.length === 5001,
    `got length ${r.highlight.length}`
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n────────────────────────────────────────────────────────────────────────');
console.log(`\nResult: ${pass}/${pass + fail} passed, ${fail} failed`);

if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
  }
  process.exit(1);
}
