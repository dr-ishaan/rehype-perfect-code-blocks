/**
 * Regression tests for the Tailwind Preflight compatibility fix (v1.3.3).
 *
 * Bug: The plugin's CSS used :where() for ALL rules (zero specificity),
 * which meant Tailwind Preflight's bare-element resets (`pre { overflow-x: auto }`,
 * `code { font-family: ui-monospace }`, `button { background: transparent }`)
 * won over the plugin's rules. This caused:
 *   - Double scrollbars (one on <pre>, one on .pcb__body)
 *   - Wrong mono font (Tailwind's ui-monospace instead of --pcb-font-mono)
 *   - Stripped copy-button background/border
 *   - Long lines wrapping instead of scrolling
 *
 * Fix: Added a block of "framework-reset overrides" with REAL specificity
 * (.pcb pre = (0,1,1), .pcb__copy = (0,1,0)) that beat framework base
 * resets WITHOUT !important. These rules only set the properties that
 * frameworks clobber; everything else stays in :where().
 *
 * Run with: node test-tailwind-compat.mjs
 */

import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  [PASS] ${name}`);
  } else {
    fail++;
    failures.push({ name, detail });
    console.log(`  [FAIL] ${name}${detail ? " — " + detail : ""}`);
  }
}

console.log("Running Tailwind Preflight compatibility regression tests...\n");

// Read the built CSS
const css = readFileSync(
  new URL("../rehype-perfect-code-blocks/dist/styles.css", import.meta.url),
  "utf8"
);

// ---------------------------------------------------------------------------
// 1. The :where() rules still exist (we didn't remove them — just added overrides)
// ---------------------------------------------------------------------------

console.log("1. :where() rules preserved (zero-specificity defaults):");

assert(
  "  :where(.pcb pre) rule exists",
  /:where\(\.pcb pre\)/.test(css)
);
assert(
  "  :where(.pcb code) rule exists",
  /:where\(\.pcb code\)/.test(css)
);
assert(
  "  :where(.pcb__copy) rule exists",
  /:where\(\.pcb__copy\)/.test(css)
);
assert(
  "  :where(.pcb__body) rule exists",
  /:where\(\.pcb__body\)/.test(css)
);
assert(
  "  :where(.pcb__code) rule exists",
  /:where\(\.pcb__code\)/.test(css)
);

// ---------------------------------------------------------------------------
// 2. Framework-reset overrides exist with REAL specificity (no :where())
// ---------------------------------------------------------------------------

console.log("\n2. Framework-reset overrides (real specificity):");

// .pcb pre { overflow: visible } — beats Tailwind's `pre { overflow-x: auto }`
// Check that there's a .pcb pre rule NOT wrapped in :where() that sets overflow: visible
assert(
  "  .pcb pre { overflow: visible } exists (beats Tailwind pre overflow)",
  /\.pcb\s+pre\s*\{[^}]*overflow:\s*visible/.test(css)
);
{
  // Verify the non-:where version exists by checking that the match
  // is NOT immediately preceded by ":where("
  const match = css.match(/\.pcb\s+pre\s*\{[^}]*overflow:\s*visible/);
  const matchIdx = match ? match.index : -1;
  const precedingChars = matchIdx > 10 ? css.slice(matchIdx - 10, matchIdx) : "";
  assert(
    "  .pcb pre override is NOT inside :where()",
    matchIdx !== -1 && !precedingChars.includes(":where("),
    precedingChars ? `preceded by: ${JSON.stringify(precedingChars)}` : "no match"
  );
}

// .pcb pre, .pcb code { font-family: var(--pcb-font-mono) }
assert(
  "  .pcb pre, .pcb code { font-family: var(--pcb-font-mono) } exists",
  /\.pcb\s+pre,\s*\.pcb\s+code\s*\{[^}]*font-family:\s*var\(--pcb-font-mono\)/.test(css)
);

// .pcb__copy { appearance: none; background: transparent; ... }
assert(
  "  .pcb__copy override exists (beats Tailwind button reset)",
  /\.pcb__copy\s*\{[^}]*appearance:\s*none/.test(css) ||
  /\.pcb__copy\s*\{[^}]*background:\s*transparent/.test(css)
);

// .pcb__bar { border-bottom: 1px solid var(--pcb-border) }
assert(
  "  .pcb__bar { border-bottom } exists (beats Tailwind border-width: 0)",
  /\.pcb__bar\s*\{[^}]*border-bottom:\s*1px/.test(css)
);

// .pcb__code { white-space: pre }
assert(
  "  .pcb__code { white-space: pre } override exists (beats break-words)",
  /\.pcb__code\s*\{[^}]*white-space:\s*pre/.test(css)
);

// ---------------------------------------------------------------------------
// 3. Verify the overrides come AFTER the :where() rules (so they win on tie)
// ---------------------------------------------------------------------------

console.log("\n3. Override ordering (must come after :where() rules):");

{
  const wherePreIdx = css.indexOf(":where(.pcb pre)");
  const overridePreIdx = css.indexOf(".pcb pre {");
  // The .pcb pre { override should come after :where(.pcb pre)
  assert(
    "  .pcb pre override appears AFTER :where(.pcb pre)",
    wherePreIdx !== -1 && overridePreIdx !== -1 && overridePreIdx > wherePreIdx,
    `:where at ${wherePreIdx}, override at ${overridePreIdx}`
  );

  const whereCopyIdx = css.indexOf(":where(.pcb__copy)");
  const overrideCopyIdx = css.indexOf(".pcb__copy {");
  // Note: .pcb__copy { might match the :where rule too, so find the one
  // that's NOT inside :where
  const overrideCopyRealIdx = css.indexOf(".pcb__copy {\n  appearance");
  assert(
    "  .pcb__copy override appears AFTER :where(.pcb__copy)",
    whereCopyIdx !== -1 && overrideCopyRealIdx !== -1 && overrideCopyRealIdx > whereCopyIdx,
    `:where at ${whereCopyIdx}, override at ${overrideCopyRealIdx}`
  );
}

// ---------------------------------------------------------------------------
// 4. Verify no !important in the override declarations (we use specificity, not !important)
// ---------------------------------------------------------------------------

console.log("\n4. No !important in framework-reset overrides:");

{
  // Extract the override block (between the "Framework-reset overrides" comment
  // and the next section)
  const overrideStart = css.indexOf("Framework-reset overrides");
  const overrideEnd = css.indexOf("Row-based line grid");
  if (overrideStart !== -1 && overrideEnd !== -1) {
    const overrideBlock = css.slice(overrideStart, overrideEnd);
    // Strip CSS comments before checking for !important (the comment says
    // "WITHOUT !important" which would false-positive the test)
    const stripped = overrideBlock.replace(/\/\*[\s\S]*?\*\//g, "");
    const hasImportant = /!\s*important/i.test(stripped);
    assert(
      "  no !important in framework-reset override declarations (uses specificity instead)",
      !hasImportant,
      hasImportant ? "found !important in override block" : ""
    );
  } else {
    assert("  override block found in CSS", false, "could not locate block");
  }
}

// ---------------------------------------------------------------------------
// 5. Specificity comparison: verify .pcb pre beats bare pre
// ---------------------------------------------------------------------------

console.log("\n5. Specificity verification:");

{
  // .pcb pre has specificity (0,1,1) — one class + one type
  // Tailwind's `pre { ... }` has specificity (0,0,1) — one type
  // (0,1,1) > (0,0,1), so .pcb pre wins. ✓

  // .pcb__copy has specificity (0,1,0) — one class
  // Tailwind's `button { ... }` has specificity (0,0,1) — one type
  // (0,1,0) > (0,0,1), so .pcb__copy wins. ✓

  // .pcb__bar has specificity (0,1,0) — one class
  // Tailwind's `* { border-width: 0 }` has specificity (0,0,0)
  // (0,1,0) > (0,0,0), so .pcb__bar wins. ✓

  // .pcb__code has specificity (0,1,0) — one class
  // (0,1,0) > (0,0,1), so .pcb__code wins. ✓

  // Verify by finding non-:where selectors
  // .pcb pre { (not :where(.pcb pre))
  const pcbPreMatch = css.match(/(?:^|\n)\.pcb\s+pre\s*\{/);
  assert("  .pcb pre selector exists (non-:where)", !!pcbPreMatch);

  // .pcb__copy { (there may be multiple; at least one non-:where)
  const pcbCopyMatches = css.match(/(?:^|\n)\.pcb__copy\s*\{/g);
  assert("  .pcb__copy selector exists (non-:where)", pcbCopyMatches && pcbCopyMatches.length >= 1);

  // .pcb__bar {
  const pcbBarMatches = css.match(/(?:^|\n)\.pcb__bar\s*\{/g);
  assert("  .pcb__bar selector exists (non-:where)", pcbBarMatches && pcbBarMatches.length >= 1);

  // .pcb__code {
  const pcbCodeMatches = css.match(/(?:^|\n)\.pcb__code\s*\{/g);
  assert("  .pcb__code selector exists (non-:where)", pcbCodeMatches && pcbCodeMatches.length >= 1);
}

// ---------------------------------------------------------------------------
// 6. Verify the comment block documents the Tailwind conflict
// ---------------------------------------------------------------------------

console.log("\n6. Documentation in CSS:");

assert(
  "  CSS has 'Framework-reset overrides' comment",
  /Framework-reset overrides/.test(css)
);
assert(
  "  CSS mentions 'Tailwind Preflight'",
  /Tailwind\s+Preflight/i.test(css)
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("\n────────────────────────────────────────────────────────────────────────");
console.log(`\nResult: ${pass}/${pass + fail} passed, ${fail} failed`);

if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}${f.detail ? " — " + f.detail : ""}`);
  }
  process.exit(1);
}
