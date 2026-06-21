/** Regression tests for v2.4.0 community patterns (items 6-13). */

import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; failures.push({ name, detail }); console.log(`  [FAIL] ${name}${detail ? " — " + detail : ""}`); }
}

console.log("Running v2.4.0 community patterns regression tests...\n");

const typesSrc = readFileSync(new URL("../rehype-perfect-code-blocks/src/types.ts", import.meta.url), "utf8");
const shikiSrc = readFileSync(new URL("../rehype-perfect-code-blocks/src/shiki.ts", import.meta.url), "utf8");
const transformerSrc = readFileSync(new URL("../rehype-perfect-code-blocks/src/transformer.ts", import.meta.url), "utf8");
const stylesCss = readFileSync(new URL("../rehype-perfect-code-blocks/dist/styles.css", import.meta.url), "utf8");

// Item 6: CSS variables theme
console.log("6. CSS variables theme:");
{
  assert("  types.ts has cssVariablesTheme option", /cssVariablesTheme\?\:\s*boolean/.test(typesSrc));
  assert("  shiki.ts has createCssVariablesTheme import", /createCssVariablesTheme/.test(shikiSrc));
  assert("  shiki.ts has useCssVariablesTheme variable", /useCssVariablesTheme/.test(shikiSrc));
  assert("  styles.css has --pcb-token- rule", /--pcb-token-/.test(stylesCss));
}

// Item 7: Watch-mode cache
console.log("\n7. Watch-mode cache:");
{
  assert("  types.ts has watchModeCache option", /watchModeCache\?\:\s*boolean/.test(typesSrc));
  assert("  transformer.ts has hashBlock function", /function hashBlock/.test(transformerSrc));
  assert("  transformer.ts has _watchCache Map", /_watchCache/.test(transformerSrc));
}

// Item 8: Colorized brackets
console.log("\n8. Colorized brackets:");
{
  assert("  types.ts has colorizedBrackets option", /colorizedBrackets\?\:\s*boolean/.test(typesSrc));
  assert("  shiki.ts has getColorizedBracketsTransformer", /getColorizedBracketsTransformer/.test(shikiSrc));
  assert("  shiki.ts wires colorizedBrackets option", /colorizedBrackets[\s\S]*?colorizedTransformer/s.test(shikiSrc));
  assert("  styles.css has .shiki-bracket rule", /shiki-bracket/.test(stylesCss));
}

// Item 9: classActiveCode
console.log("\n9. classActiveCode:");
{
  assert("  types.ts has classActiveCode option", /classActiveCode\?\:\s*boolean/.test(typesSrc));
  assert("  transformer.ts adds classes to <code>", /classActiveCode[\s\S]*?codeDataProps/s.test(transformerSrc));
}

// Item 10: Singleton highlighter
console.log("\n10. Singleton highlighter:");
{
  assert("  types.ts has shikiSingleton option", /shikiSingleton\?\:\s*boolean/.test(typesSrc));
  assert("  shiki.ts has getSingletonHighlighter usage", /getSingletonHighlighter/.test(shikiSrc));
  assert("  shiki.ts has useSingleton branch", /useSingleton/.test(shikiSrc));
}

// Item 11: Language icons
console.log("\n11. Language icons:");
{
  assert("  types.ts has languageIcons option", /languageIcons\?\:\s*boolean/.test(typesSrc));
  assert("  transformer.ts has getLanguageIcon function", /function getLanguageIcon/.test(transformerSrc));
  assert("  transformer.ts adds dataIcon to pre", /dataIcon[\s\S]*?newPreProps/s.test(transformerSrc));
  assert("  styles.css has data-icon rule", /data-icon/.test(stylesCss));
}

// Functional tests
console.log("\n12. Functional tests:");
{
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;

  // classActiveCode (default: true)
  const out1 = await unified().use(remarkParse).use(mod.remarkPreserveCodeMeta).use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, {})
    .use(rehypeStringify)
    .process("```js\n- old\n+ new\n```");
  assert("  classActiveCode: has-diff on <code>", /<code[^>]*has-diff/.test(String(out1)));

  // Language icons
  const out2 = await unified().use(remarkParse).use(mod.remarkPreserveCodeMeta).use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { languageIcons: true })
    .use(rehypeStringify)
    .process("```js\nconst x = 1;\n```");
  assert("  languageIcons: has data-icon attr", /data-icon/.test(String(out2)));
}

console.log("\n────────────────────────────────────────────────────────────────────────");
console.log(`\nResult: ${pass}/${pass + fail} passed, ${fail} failed`);
if (fail > 0) { console.log("\nFailures:"); for (const f of failures) console.log(`  - ${f.name}`); process.exit(1); }
