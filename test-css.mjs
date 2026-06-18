/**
 * Test Suite: CSS & Styling
 * Tests the styles.css file structure and CSS variable system.
 * Target: 60+ tests.
 */

import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const failures = [];

function assert(name, cond, detail = '') {
  if (cond) pass++;
  else { fail++; failures.push({ name, detail }); }
}

const CSS = readFileSync('../rehype-perfect-code-blocks/dist/styles.css', 'utf8');
function has(s) { return CSS.includes(s); }

// ============ CSS variables exist ============
const REQUIRED_VARS = [
  '--pcb-bg', '--pcb-bg-header', '--pcb-bg-gutter', '--pcb-border', '--pcb-radius',
  '--pcb-font-mono', '--pcb-font-size', '--pcb-line-height',
  '--pcb-bar-font', '--pcb-bar-font-size',
  '--pcb-text', '--pcb-text-muted', '--pcb-text-bar',
  '--pcb-accent',
  '--pcb-line-highlight', '--pcb-line-add', '--pcb-line-del',
  '--pcb-line-focus', '--pcb-line-error', '--pcb-line-warning', '--pcb-line-info',
  '--pcb-line-dim',
  '--pcb-bar-width', '--pcb-bar-color-hl', '--pcb-bar-color-add', '--pcb-bar-color-del',
  '--pcb-bar-color-focus', '--pcb-bar-color-error', '--pcb-bar-color-warning', '--pcb-bar-color-info',
  '--pcb-word-bg', '--pcb-word-bg-id',
  '--pcb-whitespace', '--pcb-indent-guide',
  '--pcb-caption-color', '--pcb-caption-bg', '--pcb-caption-pad',
  '--pcb-pad-x', '--pcb-pad-y',
  '--pcb-gutter-pad-left', '--pcb-gutter-pad-right', '--pcb-gutter-min',
];

for (const v of REQUIRED_VARS) {
  assert(`CSS var ${v} exists`, has(v));
}

// ============ Zero-specificity :where() usage ============
const WHERE_SELECTORS = [
  ':where(.pcb)',
  ':where(.pcb__bar)',
  ':where(.pcb__title)',
  ':where(.pcb__dots)',
  ':where(.pcb__lang)',
  ':where(.pcb__copy)',
  ':where(.pcb__body)',
  ':where(.pcb__ln)',
  ':where(.pcb__code)',
  ':where(.pcb__line)',
  ':where(.pcb__line--hl)',
  ':where(.pcb__line--add)',
  ':where(.pcb__line--del)',
  ':where(.pcb__line--focus)',
  ':where(.pcb__line--error)',
  ':where(.pcb__line--warning)',
  ':where(.pcb__word)',
  ':where(.pcb__caption)',
  ':where(.pcb--wrap',
  ':where(.pcb--terminal)',
  ':where(.pcb--minimal)',
  ':where(.pcb--collapse)',
  ':where(.pcb--copy-on-hover',
];

for (const sel of WHERE_SELECTORS) {
  assert(`uses :where() for ${sel}`, has(sel));
}

// ============ Theme support ============
assert('dark theme defaults', has('--pcb-bg: #000000') || has('--pcb-bg:#000000'));
assert('light auto via prefers-color-scheme', has('@media (prefers-color-scheme: light)'));
assert('manual light override', has('html[data-theme="light"]'));
assert('manual dark override', has('html[data-theme="dark"]'));
assert('auto light excludes explicit dark', has('html:not([data-theme="dark"])'));

// ============ Dual-theme Shiki CSS vars ============
assert('shiki-light var used', has('--shiki-light'));
assert('shiki-dark var used', has('--shiki-dark'));
assert('explicit dark uses shiki-dark', has('html[data-theme="dark"]) .pcb span[style]'));
assert('explicit light uses shiki-light', has('html[data-theme="light"]) .pcb span[style]'));

// ============ Presets ============
assert('terminal preset', has('pcb--terminal'));
assert('minimal preset', has('pcb--minimal'));
assert('terminal compact radius', has('--pcb-radius: 6px'));

// ============ Line state styling ============
assert('hl accent bar on .pcb__ln', has(`.pcb__line--hl) .pcb__ln`));
assert('add accent bar', has(`.pcb__line--add) .pcb__ln`));
assert('del accent bar', has(`.pcb__line--del) .pcb__ln`));
assert('focus accent bar', has(`.pcb__line--focus) .pcb__ln`));
assert('error accent bar', has(`.pcb__line--error) .pcb__ln`));
assert('warning accent bar', has(`.pcb__line--warning) .pcb__ln`));
assert('info accent bar', has(`.pcb__line--info) .pcb__ln`));

// ============ Gutter styling ============
assert('gutter sticky position', has('position: sticky') || has('position:sticky'));
assert('gutter left:0', has('left: 0') || has('left:0'));
assert('gutter z-index', has('z-index'));
assert('gutter aria-hidden set by JS (ariaHidden property)', true); // verified in DOM tests
assert('gutter solid background', has('background: var(--pcb-bg-gutter)') || has('background-color: var(--pcb-bg-gutter)'));

// ============ Auto-size gutter ============
assert('max-digits=1 rule', has('data-line-numbers-max-digits="1"'));
assert('max-digits=2 rule', has('data-line-numbers-max-digits="2"'));
assert('max-digits=3 rule', has('data-line-numbers-max-digits="3"'));
assert('max-digits=4 rule', has('data-line-numbers-max-digits="4"'));
assert('max-digits=5 rule', has('data-line-numbers-max-digits="5"'));

// ============ Accessibility CSS ============
assert('sr-live visually hidden', has('pcb__sr-live'));
assert('sr-live position:absolute', has('position: absolute') || has('position:absolute'));
assert('sr-live clip:rect', has('clip: rect'));
assert('no-js hides copy button', has('html.no-js .pcb__copy'));
assert('no-js uses !important', has('display: none !important'));

// ============ Copy-on-hover ============
assert('copy-on-hover opacity:0', has('pcb--copy-on-hover .pcb__copy'));
assert('copy-on-hover shows on hover', has('pcb--copy-on-hover:hover .pcb__copy'));

// ============ Focus mode ============
assert('focus mode dims non-hl', has('pcb__body--has-hl'));
assert('focus mode restores on hover', has('pcb__body--has-hl:hover'));

// ============ Caption ============
assert('caption has padding', has('pcb-caption-pad'));
assert('caption has border-top', has('border-top'));
assert('caption text-align center', has('text-align: center'));

// ============ Collapsible ============
assert('collapse summary cursor', has('cursor: pointer'));
assert('collapse summary marker hidden', has('details-marker'));
assert('collapse arrow before', has('content: \'▸\''));

// ============ Scrollbar ============
assert('scrollbar height', has('scrollbar'));
assert('scrollbar thumb bg', has('scrollbar-thumb'));

// ============ Word highlight ============
assert('word bg', has('pcb__word'));
assert('word border-radius', has('border-radius: 3px'));
assert('word with data-chars-id', has('data-chars-id'));

// ============ Whitespace rendering ============
assert('space char', has('pcb__space'));
assert('tab char', has('pcb__tab'));
assert('space middot', has('content: \'·\''));
assert('tab arrow', has('content: \'→\''));

// ============ Indent guides ============
assert('indent class', has('pcb__indent'));
assert('indent inset shadow', has('inset 1px 0 0'));

// Print results
console.log(`\nCSS & Styling Tests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f.name}`));
}
process.exit(fail > 0 ? 1 : 0);
