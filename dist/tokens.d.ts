/**
 * Design-token bridge — derives 20+ --pcb-* variables from 5 core values.
 *
 * v2.0.0 feature. Uses `color-mix(in oklch, ...)` for automatic color
 * derivation, which is supported in all modern browsers (Chrome 111+,
 * Safari 16.4+, Firefox 113+). For older browsers, the fallback values
 * from the Shiki theme (Pattern 2, v1.3.0) still apply on the <pre> element.
 */
export interface DesignTokens {
    bg?: string;
    fg?: string;
    border?: string;
    radius?: string;
    monoFont?: string;
}
/**
 * Generate a CSS style string containing all derived --pcb-* variables
 * from the 5 core token values. Returns an empty string if no tokens
 * are provided.
 *
 * The generated CSS is applied to `:where(.pcb)` so it has zero
 * specificity — user CSS always wins.
 */
export declare function generateTokenStyles(tokens: DesignTokens, scope?: string): string;
/**
 * Generate the dark-mode CSS selector based on the user's dark mode strategy.
 *
 * Returns the selector prefix that should be placed before `.pcb` in CSS rules.
 * For 'media' strategy, returns empty string (the rules are wrapped in @media).
 */
export declare function generateDarkModeSelector(darkMode?: {
    strategy?: 'media' | 'attribute' | 'class' | 'custom';
    attribute?: string;
    attributeValue?: string;
    class?: string;
    customSelector?: string;
}, scope?: string): {
    selector: string;
    mediaQuery: string | null;
};
/**
 * Generate the light-mode CSS selector (the inverse of dark mode).
 * When dark mode is NOT active, light mode defaults apply.
 */
export declare function generateLightModeSelector(darkMode?: {
    strategy?: 'media' | 'attribute' | 'class' | 'custom';
    attribute?: string;
    attributeValue?: string;
    class?: string;
    customSelector?: string;
}, scope?: string): {
    selector: string;
    mediaQuery: string | null;
};
/**
 * Apply a scope prefix to all CSS selectors in a stylesheet.
 * This is a simple regex-based approach that handles the plugin's CSS
 * structure. It prefixes every selector that starts with `.pcb` or
 * `:where(.pcb` or `html` with the scope.
 */
export declare function applyScopeToCss(css: string, scope: string): string;
//# sourceMappingURL=tokens.d.ts.map