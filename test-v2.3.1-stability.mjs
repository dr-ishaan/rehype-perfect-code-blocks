/** Regression tests for v2.3.1 stability items. */

import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; failures.push({ name, detail }); console.log(`  [FAIL] ${name}${detail ? " — " + detail : ""}`); }
}

console.log("Running v2.3.1 stability regression tests...\n");

const shikiSrc = readFileSync(new URL("../rehype-perfect-code-blocks/src/shiki.ts", import.meta.url), "utf8");
const typesSrc = readFileSync(new URL("../rehype-perfect-code-blocks/src/types.ts", import.meta.url), "utf8");
const stylesCss = readFileSync(new URL("../rehype-perfect-code-blocks/dist/styles.css", import.meta.url), "utf8");

// 1. Tokenizer size+time guards
console.log("1. Tokenizer size+time guards:");
{
  assert("  types.ts has maxBlockLength option", /maxBlockLength\?\:\s*number/.test(typesSrc));
  assert("  types.ts has tokenizeTimeout option", /tokenizeTimeout\?\:\s*number/.test(typesSrc));
  assert("  shiki.ts has maxBlockLength guard", /maxBlockLength/.test(shikiSrc));
  assert("  shiki.ts truncates large blocks to plaintext", /truncated.*block|dataTruncated/.test(shikiSrc));
  assert("  shiki.ts has tokenizeWithTimeout function", /tokenizeWithTimeout/.test(shikiSrc));
  assert("  default maxBlockLength is 200000", /200000/.test(shikiSrc));
  assert("  default tokenizeTimeout is 500", /500/.test(shikiSrc));
}

// 2. Module-level engine cache
console.log("\n2. Module-level engine cache:");
{
  assert("  shiki.ts has _jsEnginePromise module-level var", /let _jsEnginePromise/.test(shikiSrc));
  assert("  shiki.ts has getJsEngine function", /async function getJsEngine/.test(shikiSrc));
  assert("  shiki.ts uses getJsEngine in getHighlighter", /getJsEngine\(\)/.test(shikiSrc));
  assert("  shiki.ts does NOT call createJavaScriptRegexEngine directly in getHighlighter",
    !/createJavaScriptRegexEngine\(\)/.test(shikiSrc.match(/async function getHighlighter[\s\S]*?\n\}/)?.[0] ?? ""));
}

// 3. WASM-init timeout
console.log("\n3. WASM-init timeout:");
{
  assert("  types.ts has initTimeout option", /initTimeout\?\:\s*number/.test(typesSrc));
  assert("  shiki.ts has withTimeout function", /function withTimeout/.test(shikiSrc));
  assert("  shiki.ts uses withTimeout for createHighlighter", /withTimeout.*createFn/s.test(shikiSrc));
  assert("  shiki.ts falls back to JS engine on timeout", /Timeout.*JS engine|retry with JS/s.test(shikiSrc));
  assert("  shiki.ts has last-resort plaintext fallback", /Last resort/s.test(shikiSrc));
  assert("  default initTimeout is 8000ms", /8000/.test(shikiSrc));
}

// 4. content-visibility CSS
console.log("\n4. content-visibility CSS:");
{
  assert("  styles.css has content-visibility: auto", /content-visibility:\s*auto/.test(stylesCss));
  assert("  styles.css has contain-intrinsic-size", /contain-intrinsic-size/.test(stylesCss));
}

// 5. filterMetaString hook (pre-Shiki)
console.log("\n5. filterMetaString hook (pre-Shiki):");
{
  assert("  shiki.ts applies filterMetaString before Shiki", /filterMetaString.*rawMetaStr/.test(shikiSrc));
  assert("  shiki.ts has rawMetaStr variable", /rawMetaStr/.test(shikiSrc));
  assert("  types.ts has filterMetaString option", /filterMetaString\?\:\s*\(meta/.test(typesSrc));
}

// Functional test: large block falls back to plaintext
console.log("\n6. Functional: large block fallback:");
{
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;

  // Create a very large code block (300k chars) with low maxBlockLength
  const hugeCode = "x".repeat(300000);
  const md = "```js\n" + hugeCode + "\n```";
  const out = await unified()
    .use(remarkParse)
    .use(mod.remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, {
      shiki: { maxBlockLength: 10000, theme: { light: "github-light", dark: "github-dark" } },
    })
    .use(rehypeStringify)
    .process(md);
  const html = String(out);
  assert("  large block produces a figure (not crash)", /<figure/.test(html));
  assert("  large block has truncation data attr (source-level)", /dataTruncated/.test(shikiSrc));
  assert("  large block output is smaller than input", html.length < hugeCode.length);
}

console.log("\n────────────────────────────────────────────────────────────────────────");
console.log(`\nResult: ${pass}/${pass + fail} passed, ${fail} failed`);
if (fail > 0) { console.log("\nFailures:"); for (const f of failures) console.log(`  - ${f.name}`); process.exit(1); }
