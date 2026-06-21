/**
 * Regression tests for v2.1.0 Phase 2 features.
 *
 * P1-1: Math/LaTeX rendering (KaTeX integration)
 * P1-2: Lazy Shiki initialization
 * P1-3: Dev-mode warnings
 * P1-4: Screen reader copy announcement (aria-label changes)
 */

import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; failures.push({ name, detail }); console.log(`  [FAIL] ${name}${detail ? " — " + detail : ""}`); }
}

console.log("Running v2.1.0 Phase 2 regression tests...\n");

// ---------------------------------------------------------------------------
// P1-1: Math/LaTeX rendering
// ---------------------------------------------------------------------------

console.log("1. Math/LaTeX rendering:");

{
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");

  // isMathLanguage
  assert("  isMathLanguage('math') = true", mod.isMathLanguage("math"));
  assert("  isMathLanguage('latex') = true", mod.isMathLanguage("latex"));
  assert("  isMathLanguage('tex') = true", mod.isMathLanguage("tex"));
  assert("  isMathLanguage('LATEX') = true (case-insensitive)", mod.isMathLanguage("LATEX"));
  assert("  isMathLanguage('js') = false", !mod.isMathLanguage("js"));
  assert("  isMathLanguage('python') = false", !mod.isMathLanguage("python"));

  // resolveMathOptions
  const opts = mod.resolveMathOptions({ engine: "katex" });
  assert("  resolveMathOptions: engine = 'katex'", opts.engine === "katex");
  assert("  resolveMathOptions: inline = true (default)", opts.inline === true);
  assert("  resolveMathOptions: block = true (default)", opts.block === true);
  assert("  resolveMathOptions: throwOnError = true (default)", opts.throwOnError === true);

  const defaultOpts = mod.resolveMathOptions(undefined);
  assert("  resolveMathOptions(undefined): engine = 'none' (default)", defaultOpts.engine === "none");

  // renderMath — falls back to plain text when katex is not installed
  const rendered = await mod.renderMath("E = mc^2", false, opts);
  assert("  renderMath returns html string", typeof rendered.html === "string");
  assert("  renderMath isKatex = false when katex not installed", rendered.isKatex === false);
  assert("  renderMath fallback escapes HTML", rendered.html.includes("&amp;") || !rendered.html.includes("<"));

  const blockRendered = await mod.renderMath("\\sum_{i=1}^{n} i", true, opts);
  assert("  renderMath block mode works", typeof blockRendered.html === "string");

  // Math options in types
  const typesSrc = readFileSync(
    new URL("../rehype-perfect-code-blocks/src/types.ts", import.meta.url),
    "utf8"
  );
  assert("  types.ts has math option", /math\?\:\s*\{/.test(typesSrc));
  assert("  types.ts has math.engine option", /engine\?\:\s*'katex'/.test(typesSrc));
  assert("  types.ts has math.inline option", /inline\?\:\s*boolean/.test(typesSrc));
  assert("  types.ts has math.block option", /block\?\:\s*boolean/.test(typesSrc));

  // Math module exists in dist
  const mathJs = readFileSync(
    new URL("../rehype-perfect-code-blocks/dist/math.js", import.meta.url),
    "utf8"
  );
  assert("  dist/math.js exists", mathJs.length > 0);
  assert("  math.js exports isMathLanguage", /isMathLanguage/.test(mathJs));
  assert("  math.js exports renderMath", /renderMath/.test(mathJs));
  assert("  math.js exports resolveMathOptions", /resolveMathOptions/.test(mathJs));
  assert("  math.js has MATH_LANGS", /MATH_LANGS/.test(mathJs));
}

// ---------------------------------------------------------------------------
// P1-2: Lazy Shiki initialization
// ---------------------------------------------------------------------------

console.log("\n2. Lazy Shiki initialization:");

{
  const typesSrc = readFileSync(
    new URL("../rehype-perfect-code-blocks/src/types.ts", import.meta.url),
    "utf8"
  );
  assert("  types.ts has shiki.lazy option", /lazy\?\:\s*boolean/.test(typesSrc));
  assert("  types.ts has shiki.preloadLangs option", /preloadLangs\?\:\s*string\[\]/.test(typesSrc));

  const shikiJs = readFileSync(
    new URL("../rehype-perfect-code-blocks/dist/shiki.js", import.meta.url),
    "utf8"
  );
  assert("  shiki.js has lazy check", /isLazy/.test(shikiJs));
  assert("  shiki.js skips preload when lazy", /isLazy[\s\S]*?\[\]/.test(shikiJs));
}

// ---------------------------------------------------------------------------
// P1-3: Dev-mode warnings
// ---------------------------------------------------------------------------

console.log("\n3. Dev-mode warnings:");

{
  const mod = await import("../rehype-perfect-code-blocks/dist/index.js");

  assert("  runDevWarnings exported", typeof mod.runDevWarnings === "function");
  assert("  warnUnknownLanguage exported", typeof mod.warnUnknownLanguage === "function");

  const devWarnSrc = readFileSync(
    new URL("../rehype-perfect-code-blocks/src/dev-warnings.ts", import.meta.url),
    "utf8"
  );
  assert("  dev-warnings.ts checks conflicting options (wrap + collapseAfter)", /wrap.*collapseAfter/.test(devWarnSrc));
  assert("  dev-warnings.ts checks missing rehype-raw", /rehype-raw/.test(devWarnSrc));
  assert("  dev-warnings.ts checks invalid meta syntax", /Invalid meta syntax/.test(devWarnSrc));
  assert("  dev-warnings.ts dedupes warnings", /warnedMessages/.test(devWarnSrc));

  const typesSrc = readFileSync(
    new URL("../rehype-perfect-code-blocks/src/types.ts", import.meta.url),
    "utf8"
  );
  assert("  types.ts has devWarnings option", /devWarnings\?\:\s*boolean/.test(typesSrc));

  // Functional test — runDevWarnings doesn't throw
  const mockCtx = {
    logger: { warn: () => {}, error: () => {} },
    hasRehypeRaw: false,
    wrap: false,
    collapseAfter: null,
  };
  mod.runDevWarnings({ type: "root", children: [] }, mockCtx);
  assert("  runDevWarnings runs without throwing", true);
}

// ---------------------------------------------------------------------------
// P1-4: Screen reader copy announcement
// ---------------------------------------------------------------------------

console.log("\n4. Screen reader copy announcement:");

{
  const copyScriptSrc = readFileSync(
    new URL("../rehype-perfect-code-blocks/src/copy-script.ts", import.meta.url),
    "utf8"
  );

  assert("  copy script saves original aria-label", /originalAriaLabel.*getAttribute.*aria-label/.test(copyScriptSrc));
  assert("  copy script updates aria-label on copy", /setAttribute.*aria-label.*done/.test(copyScriptSrc));
  assert("  copy script restores aria-label after duration", /setAttribute.*aria-label.*originalAriaLabel/.test(copyScriptSrc));
  assert("  copy script has aria-live region (from v1.3.0)", /aria-live/.test(copyScriptSrc));
  assert("  copy script announces copy via live region", /announce\(done\)/.test(copyScriptSrc));

  // Check the built copy-script.js too
  const copyScriptBuilt = readFileSync(
    new URL("../rehype-perfect-code-blocks/dist/copy-script.js", import.meta.url),
    "utf8"
  );
  assert("  built copy-script.js has aria-label update", /aria-label/.test(copyScriptBuilt));
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
