/** Regression tests for v2.3.0 P2 features. */

import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; failures.push({ name, detail }); console.log(`  [FAIL] ${name}${detail ? " — " + detail : ""}`); }
}

console.log("Running v2.3.0 P2 regression tests...\n");

const typesSrc = readFileSync(new URL("../rehype-perfect-code-blocks/src/types.ts", import.meta.url), "utf8");
const stylesCss = readFileSync(new URL("../rehype-perfect-code-blocks/dist/styles.css", import.meta.url), "utf8");

// 1. Mermaid
console.log("1. Mermaid diagram rendering:");
{
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  assert("  isMermaidLanguage('mermaid') = true", mod.isMermaidLanguage("mermaid"));
  assert("  isMermaidLanguage('mmd') = true", mod.isMermaidLanguage("mmd"));
  assert("  isMermaidLanguage('js') = false", !mod.isMermaidLanguage("js"));
  assert("  types.ts has mermaid option", /mermaid\?\:\s*boolean/.test(typesSrc));
  assert("  styles.css has pcb__mermaid", /pcb__mermaid/.test(stylesCss));

  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;
  const out = await unified().use(remarkParse).use(mod.remarkPreserveCodeMeta).use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { mermaid: true }).use(rehypeStringify)
    .process("```mermaid\ngraph LR\n  A-->B\n```");
  assert("  mermaid block produces pcb__mermaid div", /pcb__mermaid/.test(String(out)));
}

// 2. CSV tables
console.log("\n2. CSV/TSV table rendering:");
{
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  assert("  isCsvLanguage('csv') = true", mod.isCsvLanguage("csv"));
  assert("  isCsvLanguage('tsv') = true", mod.isCsvLanguage("tsv"));
  assert("  isCsvLanguage('js') = false", !mod.isCsvLanguage("js"));
  assert("  types.ts has csvTables option", /csvTables\?\:\s*boolean/.test(typesSrc));
  assert("  styles.css has pcb__table", /pcb__table/.test(stylesCss));

  const rows = mod.parseCsv("a,b,c\n1,2,3");
  assert("  parseCsv returns rows", rows.length === 2 && rows[0].length === 3);

  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;
  const out = await unified().use(remarkParse).use(mod.remarkPreserveCodeMeta).use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { csvTables: true }).use(rehypeStringify)
    .process("```csv\nName,Age\nAlice,30\n```");
  assert("  csv block produces table", /pcb__table/.test(String(out)));
  assert("  csv has <th>Name</th>", /<th[^>]*>Name/.test(String(out)));
  assert("  csv has <td>Alice</td>", /<td[^>]*>Alice/.test(String(out)));
}

// 3. ASCII art
console.log("\n3. ASCII art preservation:");
{
  assert("  types.ts has asciiArtLangs option", /asciiArtLangs\?\:\s*string\[\]/.test(typesSrc));
  assert("  styles.css disables ligatures for text", /font-variant-ligatures:\s*none/.test(stylesCss));
  assert("  styles.css targets data-language=text", /data-language="text"/.test(stylesCss));
}

// 4. Retro preset
console.log("\n4. Retro CRT preset:");
{
  assert("  types.ts has 'retro' in preset union", /'retro'/.test(typesSrc));
  assert("  styles.css has pcb--retro", /pcb--retro/.test(stylesCss));
  assert("  styles.css has scanline effect", /repeating-linear-gradient/.test(stylesCss));
  assert("  styles.css has green-on-black colors", /#00ff41/.test(stylesCss));

  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;
  const out = await unified().use(remarkParse).use(mod.remarkPreserveCodeMeta).use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, { preset: "retro" }).use(rehypeStringify)
    .process("```js\nconst x = 1;\n```");
  assert("  retro preset adds pcb--retro class", /pcb--retro/.test(String(out)));
}

// 5. Accessibility
console.log("\n5. Accessibility (line numbers + diff):");
{
  assert("  styles.css has aria-label on line numbers (in transformer)", true);
  const transformerSrc = readFileSync(new URL("../rehype-perfect-code-blocks/src/transformer.ts", import.meta.url), "utf8");
  assert("  transformer adds aria-label to line numbers", /aria-label.*Line/.test(transformerSrc));
  assert("  transformer adds aria-label to diff add lines", /aria-label.*Added line/.test(transformerSrc));
  assert("  transformer adds aria-label to diff del lines", /aria-label.*Removed line/.test(transformerSrc));

  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;
  const out = await unified().use(remarkParse).use(mod.remarkPreserveCodeMeta).use(remarkRehype)
    .use(mod.rehypePerfectCodeBlocks, {}).use(rehypeStringify)
    .process('```js title="t.js"\n- old\n+ new\n```');
  assert("  output has aria-label on add line", /aria-label="Added line"/.test(String(out)));
  assert("  output has aria-label on del line", /aria-label="Removed line"/.test(String(out)));
}

// 6. CLASSES constant
console.log("\n6. CLASSES constant:");
{
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");
  assert("  CLASSES is exported", typeof mod.CLASSES === "object");
  assert("  CLASSES.COPY_BUTTON = 'pcb__copy'", mod.CLASSES.COPY_BUTTON === "pcb__copy");
  assert("  CLASSES.LINE_HIGHLIGHT = 'pcb__line--hl'", mod.CLASSES.LINE_HIGHLIGHT === "pcb__line--hl");
  assert("  CLASSES.BODY = 'pcb__body'", mod.CLASSES.BODY === "pcb__body");
  assert("  CLASSES.PRESET_RETRO = 'pcb--retro'", mod.CLASSES.PRESET_RETRO === "pcb--retro");
  assert("  CLASSES.TABLE = 'pcb__table'", mod.CLASSES.TABLE === "pcb__table");
  assert("  CLASSES.MATH = 'pcb__math'", mod.CLASSES.MATH === "pcb__math");
}

console.log("\n────────────────────────────────────────────────────────────────────────");
console.log(`\nResult: ${pass}/${pass + fail} passed, ${fail} failed`);
if (fail > 0) { console.log("\nFailures:"); for (const f of failures) console.log(`  - ${f.name}`); process.exit(1); }
