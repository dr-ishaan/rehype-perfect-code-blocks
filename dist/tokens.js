/**
 * Design-token bridge — derives 20+ --pcb-* variables from 5 core values.
 *
 * v2.0.0 feature. Uses `color-mix(in oklch, ...)` for automatic color
 * derivation, which is supported in all modern browsers (Chrome 111+,
 * Safari 16.4+, Firefox 113+). For older browsers, the fallback values
 * from the Shiki theme (Pattern 2, v1.3.0) still apply on the <pre> element.
 */
/**
 * Generate a CSS style string containing all derived --pcb-* variables
 * from the 5 core token values. Returns an empty string if no tokens
 * are provided.
 *
 * The generated CSS is applied to `:where(.pcb)` so it has zero
 * specificity — user CSS always wins.
 */
export function generateTokenStyles(tokens, scope) {
    if (!tokens || Object.keys(tokens).length === 0)
        return '';
    const { bg, fg, border, radius, monoFont } = tokens;
    if (!bg && !fg && !border && !radius && !monoFont)
        return '';
    const scopePrefix = scope ? `${scope} ` : '';
    const lines = [];
    // Direct mappings (1:1)
    if (bg)
        lines.push(`  --pcb-bg: ${bg};`);
    if (fg)
        lines.push(`  --pcb-fg: ${fg};`);
    if (border)
        lines.push(`  --pcb-border: ${border};`);
    if (radius)
        lines.push(`  --pcb-radius: ${radius};`);
    if (monoFont)
        lines.push(`  --pcb-font-mono: ${monoFont};`);
    // Derived mappings (auto-computed from core values via color-mix)
    // Only derive if BOTH bg and fg are available (needed for color-mix)
    if (bg && fg) {
        // Line numbers: muted (50% mix of fg over bg)
        lines.push(`  --pcb-text-muted: color-mix(in oklch, ${fg}, ${bg} 50%);`);
        lines.push(`  --pcb-ln-fg: color-mix(in oklch, ${fg}, ${bg} 50%);`);
        // Header bar background: slightly different from body (5% fg over bg)
        lines.push(`  --pcb-bg-header: color-mix(in oklch, ${fg} 5%, ${bg});`);
        // Header text: muted (30% fg mixed toward bg)
        lines.push(`  --pcb-text-bar: color-mix(in oklch, ${fg}, ${bg} 30%);`);
        // Line highlight: subtle tint (12% fg over bg)
        lines.push(`  --pcb-line-highlight: color-mix(in oklch, ${fg} 12%, ${bg});`);
        // Diff add: green tint (18% green over bg)
        lines.push(`  --pcb-line-add: color-mix(in oklch, #2ea043 18%, ${bg});`);
        // Diff del: red tint (18% red over bg)
        lines.push(`  --pcb-line-del: color-mix(in oklch, #f85149 18%, ${bg});`);
        // Focus: blue tint (18% blue over bg)
        lines.push(`  --pcb-line-focus: color-mix(in oklch, #58a6ff 18%, ${bg});`);
        // Copy button hover background: subtle (8% fg over bg)
        lines.push(`  --pcb-copy-hover-bg: color-mix(in oklch, ${fg} 8%, ${bg});`);
        // Gutter background: same as bg by default
        lines.push(`  --pcb-bg-gutter: ${bg};`);
        // Caption background: slightly different (like header)
        lines.push(`  --pcb-caption-bg: color-mix(in oklch, ${fg} 5%, ${bg});`);
        // Caption color: muted (like header text)
        lines.push(`  --pcb-caption-color: color-mix(in oklch, ${fg}, ${bg} 30%);`);
        // Word highlight: gold tint (30% gold over bg)
        lines.push(`  --pcb-word-bg: color-mix(in oklch, #bb8009 30%, ${bg});`);
        // Word highlight (id): blue tint (30% blue over bg)
        lines.push(`  --pcb-word-bg-id: color-mix(in oklch, #58a6ff 30%, ${bg});`);
    }
    if (lines.length === 0)
        return '';
    return `:where(${scopePrefix}.pcb) {\n${lines.join('\n')}\n}`;
}
/**
 * Generate the dark-mode CSS selector based on the user's dark mode strategy.
 *
 * Returns the selector prefix that should be placed before `.pcb` in CSS rules.
 * For 'media' strategy, returns empty string (the rules are wrapped in @media).
 */
export function generateDarkModeSelector(darkMode, scope) {
    const scopePrefix = scope ? `${scope} ` : '';
    if (!darkMode || darkMode.strategy === 'media' || !darkMode.strategy) {
        // Default: prefers-color-scheme media query
        return { selector: '', mediaQuery: 'prefers-color-scheme: dark' };
    }
    if (darkMode.strategy === 'attribute') {
        const attr = darkMode.attribute ?? 'data-theme';
        const val = darkMode.attributeValue ?? 'dark';
        return {
            selector: `html[${attr}="${val}"] ${scopePrefix}`.trim(),
            mediaQuery: null,
        };
    }
    if (darkMode.strategy === 'class') {
        const cls = darkMode.class ?? 'dark';
        return {
            selector: `html.${cls} ${scopePrefix}`.trim(),
            mediaQuery: null,
        };
    }
    if (darkMode.strategy === 'custom') {
        const sel = darkMode.customSelector ?? ':root';
        return {
            selector: `${sel} ${scopePrefix}`.trim(),
            mediaQuery: null,
        };
    }
    return { selector: '', mediaQuery: 'prefers-color-scheme: dark' };
}
/**
 * Generate the light-mode CSS selector (the inverse of dark mode).
 * When dark mode is NOT active, light mode defaults apply.
 */
export function generateLightModeSelector(darkMode, scope) {
    const scopePrefix = scope ? `${scope} ` : '';
    if (!darkMode || darkMode.strategy === 'media' || !darkMode.strategy) {
        return { selector: '', mediaQuery: 'prefers-color-scheme: light' };
    }
    if (darkMode.strategy === 'attribute') {
        const attr = darkMode.attribute ?? 'data-theme';
        const val = darkMode.attributeValue ?? 'dark';
        // Light = when the attribute is NOT the dark value
        return {
            selector: `html:not([${attr}="${val}"]) ${scopePrefix}`.trim(),
            mediaQuery: null,
        };
    }
    if (darkMode.strategy === 'class') {
        const cls = darkMode.class ?? 'dark';
        return {
            selector: `html:not(.${cls}) ${scopePrefix}`.trim(),
            mediaQuery: null,
        };
    }
    if (darkMode.strategy === 'custom') {
        // For custom, light = when the custom selector does NOT match
        // This is tricky — we can't easily negate an arbitrary selector.
        // Fall back to media query for the light case.
        return { selector: '', mediaQuery: 'prefers-color-scheme: light' };
    }
    return { selector: '', mediaQuery: 'prefers-color-scheme: light' };
}
/**
 * Apply a scope prefix to all CSS selectors in a stylesheet.
 * This is a simple regex-based approach that handles the plugin's CSS
 * structure. It prefixes every selector that starts with `.pcb` or
 * `:where(.pcb` or `html` with the scope.
 */
export function applyScopeToCss(css, scope) {
    if (!scope)
        return css;
    // Don't double-prefix if the scope is already present
    if (css.includes(`${scope} .pcb`) || css.includes(`${scope}.pcb`))
        return css;
    // Prefix selectors that target .pcb or html.no-js
    let result = css;
    // :where(.pcb) → :where(scope .pcb)
    result = result.replace(/:where\(\.pcb\)/g, `:where(${scope} .pcb)`);
    // :where(html:not(...)) :where(.pcb:not(...)) → :where(scope html:not(...)) :where(scope .pcb:not(...))
    // This is complex — for nested :where() with html, just prefix the whole compound
    result = result.replace(/:where\(html/g, `:where(${scope} html`);
    // .pcb pre → scope .pcb pre (the framework-reset overrides)
    result = result.replace(/^(\.pcb\s)/gm, `${scope} $1`);
    // .pcb__copy → scope .pcb__copy (note: .pcb__ starts with a dot, don't add another)
    result = result.replace(/^(\.pcb__)/gm, `${scope} $1`);
    // html.no-js .pcb__copy → scope html.no-js scope .pcb__copy
    // (This is an edge case — the no-js rule needs both html and .pcb scoped)
    result = result.replace(/html\.no-js\s+\.pcb/g, `${scope} html.no-js ${scope} .pcb`);
    return result;
}
//# sourceMappingURL=tokens.js.map