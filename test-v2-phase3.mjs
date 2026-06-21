/**
 * Regression tests for v2.2.0 Phase 3 features.
 *
 * P1-5: Side-by-side diff view (diffMode: 'split')
 * P1-6: Line annotations (// [!ann: "text"] notation)
 * P1-7: Code attribution (author/year/source meta)
 */

import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; failures.push({ name, detail }); console.log(`  [FAIL] ${name}${detail ? " — " + detail : ""}`); }
}

console.log("Running v2.2.0 Phase 3 regression tests...\n");

// Read source files for structural checks
const typesSrc = readFileSync(
  new URL("../rehype-perfect-code-blocks/src/types.ts", import.meta.url),
  "utf8"
);
const stylesCss = readFileSync(
  new URL("../rehype-perfect-code-blocks/dist/styles.css", import.meta.url),
  "utf8"
);

// ---------------------------------------------------------------------------
// P1-5: Side-by-side diff view
// ---------------------------------------------------------------------------

console.log("1. Side-by-side diff view (diffMode: 'split'):");

{
  assert("  types.ts has diffMode option", /diffMode\?\:\s*'unified'\s*\|\s*'split'/.test(typesSrc));
  assert("  styles.css has pcb--split-diff rules", /pcb--split-diff/.test(stylesCss));
  assert("  styles.css has grid-template-columns for split", /grid-template-columns:\s*1fr\s*1fr/.test(stylesCss));
  assert("  styles.css has mobile responsive stacking", /max-width:\s*768px/.test(stylesCss));

  // Functional test
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;

  const md = "```js\n- const x = 1;\n+ const y = 2;\n```";
  const out = await unified()
    .use(remarkParse)
    .use(mod.remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { diffMode: "split" })
    .use(rehypeStringify)
    .process(md);
  const html = String(out);
  assert("  split mode adds pcb--split-diff class", /pcb--split-diff/.test(html));

  // Default (unified) does NOT add the class
  const out2 = await unified()
    .use(remarkParse)
    .use(mod.remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { diffMode: "unified" })
    .use(rehypeStringify)
    .process(md);
  assert("  unified mode does NOT add pcb--split-diff", !/pcb--split-diff/.test(String(out2)));
}

// ---------------------------------------------------------------------------
// P1-6: Line annotations
// ---------------------------------------------------------------------------

console.log("\n2. Line annotations (// [!ann: \"text\"]):");

{
  assert("  types.ts has annotations option", /annotations\?\:\s*boolean/.test(typesSrc));
  assert("  styles.css has pcb__ann rules", /pcb__ann/.test(stylesCss));
  assert("  styles.css has pcb--annotations rules", /pcb--annotations/.test(stylesCss));
  assert("  styles.css has data-ann selector", /data-ann/.test(stylesCss));

  // Functional test
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;

  const md = "```ts\nconst x = 1; // [!ann: \"Initialize x\"]\nconst y = 2;\n```";
  const out = await unified()
    .use(remarkParse)
    .use(mod.remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { annotations: true })
    .use(rehypeStringify)
    .process(md);
  const html = String(out);

  assert("  annotations enabled adds pcb--annotations class", /pcb--annotations/.test(html));
  assert("  produces pcb__ann spans", /pcb__ann/.test(html));
  assert("  annotation text \"Initialize x\" is in output", /Initialize x/.test(html));
  assert("  annotation notation [!ann: is stripped from code", !/\[!ann:/.test(html));

  // Without annotations option → no annotation elements
  const out2 = await unified()
    .use(remarkParse)
    .use(mod.remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { annotations: false })
    .use(rehypeStringify)
    .process(md);
  assert("  annotations disabled: no pcb__ann spans", !/pcb__ann/.test(String(out2)));
  assert("  annotations disabled: notation preserved as text", /\[!ann:/.test(String(out2)));
}

// ---------------------------------------------------------------------------
// P1-7: Code attribution
// ---------------------------------------------------------------------------

console.log("\n3. Code attribution (author/year/source):");

{
  assert("  types.ts has attribution option", /attribution\?\:\s*boolean/.test(typesSrc));
  assert("  types.ts has author field in ParsedMeta", /author:\s*string\s*\|\s*null/.test(typesSrc));
  assert("  types.ts has year field in ParsedMeta", /year:\s*string\s*\|\s*null/.test(typesSrc));
  assert("  types.ts has source field in ParsedMeta", /source:\s*string\s*\|\s*null/.test(typesSrc));
  assert("  styles.css has pcb__attribution rules", /pcb__attribution/.test(stylesCss));

  // Meta parser test
  const { parseMeta } = await import("../rehype-perfect-code-blocks/dist/meta.js");
  const meta = parseMeta('ts title="app.ts" author="Rosenblatt" year="1958" source="Principles of Neurodynamics"');
  assert("  parseMeta extracts author", meta.author === "Rosenblatt");
  assert("  parseMeta extracts year", meta.year === "1958");
  assert("  parseMeta extracts source", meta.source === "Principles of Neurodynamics");
  assert("  parseMeta still extracts title", meta.title === "app.ts");

  // Meta without attribution fields
  const meta2 = parseMeta('ts title="app.ts"');
  assert("  parseMeta: author is null when not provided", meta2.author === null);
  assert("  parseMeta: year is null when not provided", meta2.year === null);
  assert("  parseMeta: source is null when not provided", meta2.source === null);

  // Functional test
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;

  const md = '```ts title="perceptron.ts" author="Rosenblatt" year="1958" source="Principles of Neurodynamics"\nconst output = 1;\n```';
  const out = await unified()
    .use(remarkParse)
    .use(mod.remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { attribution: true })
    .use(rehypeStringify)
    .process(md);
  const html = String(out);

  assert("  attribution enabled produces pcb__attribution", /pcb__attribution/.test(html));
  assert("  attribution contains author name", /Rosenblatt/.test(html));
  assert("  attribution contains year", /1958/.test(html));
  assert("  attribution contains source", /Principles of Neurodynamics/.test(html));

  // Without attribution option → no footer
  const out2 = await unified()
    .use(remarkParse)
    .use(mod.remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { attribution: false })
    .use(rehypeStringify)
    .process(md);
  assert("  attribution disabled: no pcb__attribution", !/pcb__attribution/.test(String(out2)));

  // Partial attribution (only author)
  const partialMd = '```ts author="Turing"\nconst x = 1;\n```';
  const partialOut = await unified()
    .use(remarkParse)
    .use(mod.remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { attribution: true })
    .use(rehypeStringify)
    .process(partialMd);
  assert("  partial attribution (author only) renders footer", /pcb__attribution/.test(String(partialOut)));
  assert("  partial attribution contains \"Turing\"", /Turing/.test(String(partialOut)));
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("\n────────────────────────────────────────────────────────────────────────");
console.log(`\nResult: ${pass}/${pass + fail} passed, ${fail} failed`);

if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f.name}${f.detail ? " — " + f.detail : ""}`);
  process.exit(1);
}
