/**
 * Regression tests for issue #12 — case-sensitive language loader.
 *
 * Before the fix, fenced code blocks with non-lowercase language identifiers
 * (e.g. ```JS, ```TypeScript, ```Python) would throw:
 *
 *   Language `JS` is not included in this bundle.
 *
 * because the plugin's lazy loader called highlighter.loadLanguage(lang)
 * with the raw case-preserving identifier, while Shiki's bundled grammars
 * all use lowercase IDs.
 *
 * After the fix, the loader normalizes to lowercase, matching Shiki's own
 * case-insensitive behavior in codeToHast/codeToHtml and matching what
 * every other CommonMark renderer accepts.
 *
 * Run with: node test-issue-12.mjs
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import {
  rehypePerfectCodeBlocks,
  remarkPreserveCodeMeta,
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

console.log('Running regression tests for issue #12 (case-sensitive language loader)...\n');

// ---------------------------------------------------------------------------
// 1. The exact cases from the bug report — must not throw.
// ---------------------------------------------------------------------------

console.log('1. Exact reproduction cases from issue #12:');

await assertRenders(
  '```JS renders without throwing',
  '```JS\nconst x = 1;\n```\n'
);

await assertRenders(
  '```TypeScript renders without throwing',
  '```TypeScript\nconst x: number = 1;\n```\n'
);

await assertRenders(
  '```Python renders without throwing',
  '```Python\nx = 1\n```\n'
);

await assertRenders(
  '```JavaScript renders without throwing',
  '```JavaScript\nconst x = 1;\n```\n'
);

await assertRenders(
  '```Rust renders without throwing',
  '```Rust\nfn main() {}\n```\n'
);

await assertRenders(
  '```Cpp renders without throwing',
  '```Cpp\nint main() { return 0; }\n```\n'
);

// ---------------------------------------------------------------------------
// 2. The rendered output actually contains syntax-highlighted tokens
//    (proves we're not silently falling back to plaintext).
// ---------------------------------------------------------------------------

console.log('\n2. Output contains real syntax highlighting (not plaintext fallback):');

{
  // JavaScript `const` keyword should be colored (F97583 in github-dark theme
  // for the keyword token). If we got plaintext fallback, all text would be
  // the default text color (#E1E4E8 in github-dark).
  const html = await assertRenders(
    '```JS colors the `const` keyword',
    '```JS\nconst x = 1;\n```\n',
    { shiki: { theme: { light: 'github-light', dark: 'github-dark' } } }
  );
  if (html) {
    const hasKeywordColor = /color:#F97583/i.test(html) || /--shiki-light:#D73A49/i.test(html);
    assert('  keyword token has non-default color', hasKeywordColor,
      hasKeywordColor ? '' : 'no keyword color found — likely plaintext fallback');
  }
}

{
  const html = await assertRenders(
    '```TypeScript colors the `const` keyword',
    '```TypeScript\nconst x: number = 1;\n```\n',
    { shiki: { theme: { light: 'github-light', dark: 'github-dark' } } }
  );
  if (html) {
    const hasKeywordColor = /color:#F97583/i.test(html) || /--shiki-light:#D73A49/i.test(html);
    assert('  keyword token has non-default color', hasKeywordColor,
      hasKeywordColor ? '' : 'no keyword color found — likely plaintext fallback');
  }
}

// ---------------------------------------------------------------------------
// 3. Mixed-case and uppercase produce the SAME colored output as lowercase
//    (proves they all hit the same Shiki grammar).
// ---------------------------------------------------------------------------

console.log('\n3. Case variants produce identical output to lowercase baseline:');

{
  const baseline = await render('```js\nconst x = 1;\n```\n', {
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
  });
  const upper = await render('```JS\nconst x = 1;\n```\n', {
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
  });
  const title = await render('```Js\nconst x = 1;\n```\n', {
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
  });
  assert('  ```JS output === ```js output', upper === baseline);
  assert('  ```Js output === ```js output', title === baseline);
}

{
  const baseline = await render('```typescript\nconst x: number = 1;\n```\n', {
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
  });
  const title = await render('```TypeScript\nconst x: number = 1;\n```\n', {
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
  });
  const upper = await render('```TYPESCRIPT\nconst x: number = 1;\n```\n', {
    shiki: { theme: { light: 'github-light', dark: 'github-dark' } },
  });
  assert('  ```TypeScript output === ```typescript output', title === baseline);
  assert('  ```TYPESCRIPT output === ```typescript output', upper === baseline);
}

// ---------------------------------------------------------------------------
// 4. Language aliases (e.g. { ts: 'typescript' }) still work, AND can be
//    looked up by either lowercase or original-case keys.
// ---------------------------------------------------------------------------

console.log('\n4. languageAliases still work with case-insensitive lookup:');

{
  // User config uses lowercase alias key — should work both before and after fix.
  const html = await assertRenders(
    'lowercase alias `ts` → typescript',
    '```ts\nconst x: number = 1;\n```\n',
    { languageAliases: { ts: 'typescript' } }
  );
  if (html) {
    // Should be tokenized as TypeScript, not as the literal lang 'ts' (which
    // Shiki doesn't have a grammar for and would fall back to plaintext).
    const hasKeywordColor = /color:#F97583/i.test(html) || /--shiki-light:#D73A49/i.test(html);
    assert('  ts alias produces TypeScript highlighting', hasKeywordColor);
  }
}

{
  // User config uses TitleCase alias key — should also work after the fix
  // (previously would not have matched because rawLang is preserved as-is).
  const html = await assertRenders(
    'TitleCase alias `TS` → typescript (config case-insensitive)',
    '```TS\nconst x: number = 1;\n```\n',
    { languageAliases: { TS: 'typescript' } }
  );
  if (html) {
    const hasKeywordColor = /color:#F97583/i.test(html) || /--shiki-light:#D73A49/i.test(html);
    assert('  TS alias produces TypeScript highlighting', hasKeywordColor);
  }
}

// ---------------------------------------------------------------------------
// 6. The data-language attribute on the output <code> reflects the
//    normalized (lowercase) language, so downstream CSS / JS targeting works.
//    (Note: the plugin intentionally strips Shiki's `language-*` class from
//    <pre> elements as part of its "shiki / astro-code classes stripped"
//    feature — see existing test "shiki / astro-code classes stripped from
//    <pre>". The data-language attribute is the canonical language indicator
//    in the output.)
// ---------------------------------------------------------------------------

console.log('\n6. data-language attribute uses lowercase normalized form:');

{
  const html = await render('```JavaScript\nconst x = 1;\n```\n');
  const m = html.match(/data-language="([^"]*)"/);
  assert('  data-language is "javascript" (lowercase)', m?.[1] === 'javascript',
    `got: ${m?.[1]}`);
}

{
  const html = await render('```TypeScript\nconst x = 1;\n```\n');
  const m = html.match(/data-language="([^"]*)"/);
  assert('  data-language is "typescript" (lowercase)', m?.[1] === 'typescript',
    `got: ${m?.[1]}`);
}

{
  const html = await render('```Python\nx = 1\n```\n');
  const m = html.match(/data-language="([^"]*)"/);
  assert('  data-language is "python" (lowercase)', m?.[1] === 'python',
    `got: ${m?.[1]}`);
}

// ---------------------------------------------------------------------------
// 8. Multi-block document with mixed case — none of them crash.
// ---------------------------------------------------------------------------

console.log('\n8. Multi-block document with mixed case:');

{
  const md = [
    '# Mixed Case Test',
    '',
    '```JavaScript',
    'const a = 1;',
    '```',
    '',
    '```TypeScript',
    'const b: number = 2;',
    '```',
    '',
    '```Python',
    'c = 3',
    '```',
    '',
    '```Rust',
    'fn main() {}',
    '```',
    '',
    '```GO',
    'func main() {}',
    '```',
    '',
  ].join('\n');

  const html = await assertRenders('5-block mixed-case document renders', md);
  if (html) {
    // Each language should have its lowercase data-language attribute.
    const langs = [...html.matchAll(/data-language="([^"]*)"/g)].map((m) => m[1]);
    assert('  has 5 data-language attributes', langs.length >= 5, `got ${langs.length}`);
    assert('  includes javascript', langs.includes('javascript'));
    assert('  includes typescript', langs.includes('typescript'));
    assert('  includes python', langs.includes('python'));
    assert('  includes rust', langs.includes('rust'));
    assert('  includes go', langs.includes('go'));
  }
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
