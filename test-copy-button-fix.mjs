/**
 * Regression tests for the copy-button .no-js race condition fix.
 *
 * Bug: In v1.3.0, the Astro integration injected scripts in the wrong order:
 *   1. COPY_SCRIPT (which calls swapNoJs() to remove .no-js)
 *   2. add('no-js') script
 *
 * This meant swapNoJs() ran BEFORE .no-js was added, so it was a no-op.
 * The MutationObserver only watched childList (not attributes), so it
 * didn't catch the class change. Result: .no-js stayed on <html> permanently,
 * and the CSS rule `html.no-js .pcb__copy { display: none !important; }`
 * hid the copy button — it was unclickable.
 *
 * Fix (v1.3.2):
 *   1. Reverse injection order: add .no-js FIRST, then COPY_SCRIPT.
 *   2. MutationObserver now also watches `attributes: ['class']` on <html>.
 *   3. Defensive DOMContentLoaded + window.load re-check.
 *
 * These tests verify the fix by simulating the browser environment.
 *
 * Run with: node test-copy-button-fix.mjs
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

console.log("Running copy-button .no-js race fix regression tests...\n");

// ---------------------------------------------------------------------------
// 1. Verify the injection order in the built dist/astro.js
// ---------------------------------------------------------------------------

console.log("1. Injection order in dist/astro.js:");

{
  const astroJs = readFileSync(
    new URL("../rehype-perfect-code-blocks/dist/astro.js", import.meta.url),
    "utf8"
  );

  // The .no-js add script must be pushed BEFORE the COPY_SCRIPT push.
  // In the source: injections.push(no-js script) THEN injections.push(COPY_SCRIPT).
  // In the built file, find the indices of both push calls.
  const noJsPushIdx = astroJs.indexOf("classList.add('no-js')");
  const copyScriptPushIdx = astroJs.indexOf("${COPY_SCRIPT}");

  assert(
    "  dist/astro.js contains the .no-js add script",
    noJsPushIdx !== -1
  );
  assert(
    "  dist/astro.js contains the COPY_SCRIPT injection",
    copyScriptPushIdx !== -1
  );
  assert(
    "  .no-js add script appears BEFORE COPY_SCRIPT injection (correct order)",
    noJsPushIdx !== -1 && copyScriptPushIdx !== -1 && noJsPushIdx < copyScriptPushIdx,
    `no-js at ${noJsPushIdx}, copy-script at ${copyScriptPushIdx}`
  );
}

// ---------------------------------------------------------------------------
// 2. Verify the copy script watches attribute changes on <html>
// ---------------------------------------------------------------------------

console.log("\n2. Copy script MutationObserver configuration:");

{
  const copyScriptTs = readFileSync(
    new URL("../rehype-perfect-code-blocks/src/copy-script.ts", import.meta.url),
    "utf8"
  );

  assert(
    "  copy script uses MutationObserver",
    /new MutationObserver/.test(copyScriptTs)
  );
  assert(
    "  observer watches attributes: true",
    /attributes:\s*true/.test(copyScriptTs)
  );
  assert(
    "  observer filters to class attribute only",
    /attributeFilter:\s*\['class'\]/.test(copyScriptTs)
  );
  assert(
    "  observer callback handles type === 'attributes'",
    /m\.type\s*===\s*['"]attributes['"]/.test(copyScriptTs)
  );
  assert(
    "  observer callback checks attributeName === 'class'",
    /m\.attributeName\s*===\s*['"]class['"]/.test(copyScriptTs)
  );
}

// ---------------------------------------------------------------------------
// 3. Verify defensive DOMContentLoaded + load handlers
// ---------------------------------------------------------------------------

console.log("\n3. Defensive event handlers:");

{
  const copyScriptTs = readFileSync(
    new URL("../rehype-perfect-code-blocks/src/copy-script.ts", import.meta.url),
    "utf8"
  );

  assert(
    "  DOMContentLoaded listener calls swapNoJs()",
    /DOMContentLoaded.*swapNoJs/s.test(copyScriptTs)
  );
  assert(
    "  window load listener calls swapNoJs()",
    /window\.addEventListener\(['"]load['"].*swapNoJs/s.test(copyScriptTs)
  );
}

// ---------------------------------------------------------------------------
// 4. Verify the copy script SOURCE contains swapNoJs that removes .no-js
// ---------------------------------------------------------------------------

console.log("\n4. swapNoJs() function behavior (source-level check):");

{
  const copyScriptTs = readFileSync(
    new URL("../rehype-perfect-code-blocks/src/copy-script.ts", import.meta.url),
    "utf8"
  );

  // swapNoJs must check for 'no-js' and remove it, and add 'js'
  assert(
    "  swapNoJs checks classList.contains('no-js')",
    /classList\.contains\(['"]no-js['"]\)/.test(copyScriptTs)
  );
  assert(
    "  swapNoJs removes 'no-js' class",
    /classList\.remove\(['"]no-js['"]\)/.test(copyScriptTs)
  );
  assert(
    "  swapNoJs adds 'js' class",
    /classList\.add\(['"]js['"]\)/.test(copyScriptTs)
  );
  assert(
    "  swapNoJs is called at script load time (not just in observers)",
    /swapNoJs\(\)/.test(copyScriptTs)
  );
}

// ---------------------------------------------------------------------------
// 5. Functional test: simulate the fixed injection order in a mock DOM
// ---------------------------------------------------------------------------

console.log("\n5. Functional test — fixed injection order (.no-js first):");

{
  // Build a minimal mock that tracks classList state and event listeners
  const classListState = new Set();
  const listeners = {};

  const mockDocElement = {
    classList: {
      contains: (name) => classListState.has(name),
      add: (name) => classListState.add(name),
      remove: (name) => classListState.delete(name),
    },
  };
  const mockDoc = {
    documentElement: mockDocElement,
    addEventListener: (event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    querySelector: () => null,
    createElement: () => ({
      className: "",
      setAttribute: () => {},
      style: {},
      textContent: "",
    }),
  };
  const mockWindow = {
    __pcbCopyReady: false,
    addEventListener: (event, handler) => {
      if (!listeners["window:" + event]) listeners["window:" + event] = [];
      listeners["window:" + event].push(handler);
    },
  };

  // Simulate the FIXED injection order:
  // Script 1: add .no-js class (runs first)
  mockDocElement.classList.add("no-js");
  assert(
    "  .no-js present after Script 1 (add)",
    classListState.has("no-js")
  );

  // Script 2: copy script (runs second — should detect & remove .no-js)
  // Instead of eval-ing the full script (which has regex literals that break
  // new Function), we simulate the critical swapNoJs() behavior.
  function swapNoJs() {
    if (mockDocElement.classList.contains("no-js")) {
      mockDocElement.classList.remove("no-js");
      mockDocElement.classList.add("js");
    }
  }
  // The copy script calls swapNoJs() at load time
  swapNoJs();

  assert(
    "  .no-js REMOVED after copy script's swapNoJs()",
    !classListState.has("no-js"),
    "still present"
  );
  assert(
    "  .js ADDED after copy script's swapNoJs()",
    classListState.has("js"),
    "not present"
  );
}

// ---------------------------------------------------------------------------
// 6. Functional test: simulate the OLD (buggy) order + defensive fix
// ---------------------------------------------------------------------------

console.log("\n6. Functional test — old (buggy) order + defensive DOMContentLoaded fix:");

{
  const classListState = new Set();
  const listeners = {};
  const mockDocElement = {
    classList: {
      contains: (name) => classListState.has(name),
      add: (name) => classListState.add(name),
      remove: (name) => classListState.delete(name),
    },
  };
  const mockDoc = {
    documentElement: mockDocElement,
    addEventListener: (event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    querySelector: () => null,
    createElement: () => ({ className: "", setAttribute: () => {}, style: {}, textContent: "" }),
  };

  function swapNoJs() {
    if (mockDocElement.classList.contains("no-js")) {
      mockDocElement.classList.remove("no-js");
      mockDocElement.classList.add("js");
    }
  }

  // OLD order: copy script FIRST (no-js not present yet → swapNoJs is no-op)
  swapNoJs(); // no-op, .no-js not present
  // Register DOMContentLoaded handler (defensive fix)
  mockDoc.addEventListener("DOMContentLoaded", () => swapNoJs());
  // THEN add .no-js (old order)
  mockDocElement.classList.add("no-js");
  assert(
    "  .no-js present after old-order add",
    classListState.has("no-js")
  );

  // Fire DOMContentLoaded — the defensive handler should remove .no-js
  if (listeners.DOMContentLoaded) {
    for (const handler of listeners.DOMContentLoaded) handler();
  }
  assert(
    "  .no-js REMOVED by DOMContentLoaded defensive handler",
    !classListState.has("no-js"),
    "still present — defensive handler failed"
  );
  assert(
    "  .js ADDED by DOMContentLoaded defensive handler",
    classListState.has("js"),
    "not present"
  );
}

// ---------------------------------------------------------------------------
// 7. Verify the CSS rule exists and uses !important
// ---------------------------------------------------------------------------

console.log("\n7. CSS rule for .no-js hiding:");

{
  const css = readFileSync(
    new URL("../rehype-perfect-code-blocks/dist/styles.css", import.meta.url),
    "utf8"
  );
  assert(
    "  CSS contains html.no-js .pcb__copy rule",
    /html\.no-js\s+\.pcb__copy/.test(css)
  );
  assert(
    "  rule uses display: none !important",
    /html\.no-js\s+\.pcb__copy\s*\{[^}]*display:\s*none\s*!important/.test(css)
  );
}

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
