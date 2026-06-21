/**
 * Regression tests for v2.0.0 CSS Architecture features (P0 items).
 *
 * P0-1: @layer CSS injection support (cssInjection + cssLayer)
 * P0-2: Design-token bridge (tokens config → auto-derive 20+ --pcb-* vars)
 * P0-3: Dark mode strategy options (darkMode config)
 * P0-4: CSS containment scope (scope config → prefix all selectors)
 */

import { readFileSync } from "node:fs";
import {
  generateTokenStyles,
  applyScopeToCss,
  generateDarkModeSelector,
  generateLightModeSelector,
} from "../rehype-perfect-code-blocks/dist/index.js";

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; failures.push({ name, detail }); console.log(`  [FAIL] ${name}${detail ? " — " + detail : ""}`); }
}

console.log("Running v2.0.0 CSS Architecture regression tests...\n");

// ---------------------------------------------------------------------------
// P0-1: @layer CSS injection support
// ---------------------------------------------------------------------------

console.log("1. @layer CSS injection support:");

{
  const astroJs = readFileSync(
    new URL("../rehype-perfect-code-blocks/dist/astro.js", import.meta.url),
    "utf8"
  );

  assert(
    "  astro.ts checks cssInjection !== 'import'",
    /cssInjection.*import/.test(astroJs)
  );
  assert(
    "  astro.ts wraps CSS in @layer when cssInjection === 'layer'",
    /@layer/.test(astroJs)
  );
  assert(
    "  astro.ts uses cssLayer option for layer name",
    /cssLayer|layerName/.test(astroJs)
  );
  assert(
    "  default layer name is 'pcb'",
    /'pcb'|"pcb"/.test(astroJs)
  );
}

// ---------------------------------------------------------------------------
// P0-2: Design-token bridge
// ---------------------------------------------------------------------------

console.log("\n2. Design-token bridge:");

{
  // Full token set
  const css = generateTokenStyles({
    bg: "var(--bg-subtle)",
    fg: "var(--ink)",
    border: "var(--rule)",
    radius: "var(--radius-card)",
    monoFont: "var(--font-mono)",
  });

  assert("  generates non-empty CSS with full token set", css.length > 100);
  assert("  --pcb-bg = bg token", /--pcb-bg:\s*var\(--bg-subtle\)/.test(css));
  assert("  --pcb-fg = fg token", /--pcb-fg:\s*var\(--ink\)/.test(css));
  assert("  --pcb-border = border token", /--pcb-border:\s*var\(--rule\)/.test(css));
  assert("  --pcb-radius = radius token", /--pcb-radius:\s*var\(--radius-card\)/.test(css));
  assert("  --pcb-font-mono = monoFont token", /--pcb-font-mono:\s*var\(--font-mono\)/.test(css));

  // Derived variables use color-mix
  assert("  --pcb-ln-fg derived via color-mix", /--pcb-ln-fg:\s*color-mix/.test(css));
  assert("  --pcb-bg-header derived via color-mix", /--pcb-bg-header:\s*color-mix/.test(css));
  assert("  --pcb-line-highlight derived via color-mix", /--pcb-line-highlight:\s*color-mix/.test(css));
  assert("  --pcb-line-add derived via color-mix", /--pcb-line-add:\s*color-mix/.test(css));
  assert("  --pcb-line-del derived via color-mix", /--pcb-line-del:\s*color-mix/.test(css));
  assert("  --pcb-copy-hover-bg derived via color-mix", /--pcb-copy-hover-bg:\s*color-mix/.test(css));

  // Uses :where(.pcb) for zero specificity
  assert("  applied to :where(.pcb) for zero specificity", /:where\(\.pcb\)/.test(css));
}

{
  // Partial token set (only bg + fg)
  const css = generateTokenStyles({ bg: "#1a1b26", fg: "#c0caf5" });
  assert("  partial tokens still generate derived vars", /--pcb-ln-fg:\s*color-mix/.test(css));
  assert("  partial tokens use provided bg", /--pcb-bg:\s*#1a1b26/.test(css));
}

{
  // Empty token set
  const css = generateTokenStyles({});
  assert("  empty tokens returns empty string", css === "");
}

{
  // No tokens at all
  const css = generateTokenStyles(undefined);
  assert("  undefined tokens returns empty string", css === "");
}

// ---------------------------------------------------------------------------
// P0-3: Dark mode strategy
// ---------------------------------------------------------------------------

console.log("\n3. Dark mode strategy:");

{
  // Media (default)
  const { selector, mediaQuery } = generateDarkModeSelector({ strategy: "media" });
  assert("  media strategy: empty selector (uses @media)", selector === "");
  assert("  media strategy: prefers-color-scheme: dark", mediaQuery === "prefers-color-scheme: dark");
}

{
  // Attribute
  const { selector, mediaQuery } = generateDarkModeSelector({
    strategy: "attribute",
    attribute: "data-theme",
    attributeValue: "dark",
  });
  assert("  attribute strategy: html[data-theme='dark']", selector === 'html[data-theme="dark"]');
  assert("  attribute strategy: no media query", mediaQuery === null);
}

{
  // Class
  const { selector, mediaQuery } = generateDarkModeSelector({
    strategy: "class",
    class: "dark",
  });
  assert("  class strategy: html.dark", selector === "html.dark");
  assert("  class strategy: no media query", mediaQuery === null);
}

{
  // Custom
  const { selector, mediaQuery } = generateDarkModeSelector({
    strategy: "custom",
    customSelector: ':root[data-mode="night"]',
  });
  assert("  custom strategy: :root[data-mode='night']", selector === ':root[data-mode="night"]');
  assert("  custom strategy: no media query", mediaQuery === null);
}

{
  // Undefined (defaults to media)
  const { selector, mediaQuery } = generateDarkModeSelector(undefined);
  assert("  undefined strategy: defaults to media", selector === "" && mediaQuery === "prefers-color-scheme: dark");
}

{
  // Light mode (inverse of dark)
  const attrLight = generateLightModeSelector({
    strategy: "attribute",
    attribute: "data-theme",
    attributeValue: "dark",
  });
  assert("  attribute light: html:not([data-theme='dark'])", attrLight.selector === 'html:not([data-theme="dark"])');
  assert("  attribute light: no media query", attrLight.mediaQuery === null);

  const classLight = generateLightModeSelector({ strategy: "class", class: "dark" });
  assert("  class light: html:not(.dark)", classLight.selector === "html:not(.dark)");
}

// ---------------------------------------------------------------------------
// P0-4: CSS containment scope
// ---------------------------------------------------------------------------

console.log("\n4. CSS containment scope:");

{
  const css = `:where(.pcb) { --pcb-bg: #000; }
.pcb pre { overflow: visible; }
.pcb__copy { cursor: pointer; }
.pcb__bar { border-bottom: 1px solid; }
.pcb__code { white-space: pre; }`;

  const scoped = applyScopeToCss(css, ".prose");

  assert("  :where(.pcb) → :where(.prose .pcb)", /:where\(\.prose\s+\.pcb\)/.test(scoped));
  assert("  .pcb pre → .prose .pcb pre", /\.prose\s+\.pcb\s+pre/.test(scoped));
  assert("  .pcb__copy → .prose .pcb__copy", /\.prose\s+\.pcb__copy/.test(scoped));
  assert("  .pcb__bar → .prose .pcb__bar", /\.prose\s+\.pcb__bar/.test(scoped));
  assert("  .pcb__code → .prose .pcb__code", /\.prose\s+\.pcb__code/.test(scoped));
}

{
  // No scope = no change
  const css = ".pcb__copy { cursor: pointer; }";
  const result = applyScopeToCss(css, "");
  assert("  empty scope = no change", result === css);
}

{
  // Scope with article selector
  const css = ".pcb__copy { cursor: pointer; }";
  const result = applyScopeToCss(css, "article");
  assert("  article scope: article .pcb__copy", /article\s+\.pcb__copy/.test(result));
}

// ---------------------------------------------------------------------------
// P0-1+2+4 combined: @layer + tokens + scope
// ---------------------------------------------------------------------------

console.log("\n5. Combined: @layer + tokens + scope:");

{
  const astroJs = readFileSync(
    new URL("../rehype-perfect-code-blocks/dist/astro.js", import.meta.url),
    "utf8"
  );

  // Verify all three features are wired together in astro.ts
  assert("  astro.ts applies scope before token generation", /applyScopeToCss.*generateTokenStyles/s.test(astroJs));
  assert("  astro.ts applies tokens before @layer wrapping", /generateTokenStyles.*@layer/s.test(astroJs));
  assert("  astro.ts has cssInjection !== 'import' guard", /cssInjection.*import/.test(astroJs));
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
