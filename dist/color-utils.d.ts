/**
 * Color manipulation utilities for theme-aware CSS variable defaults.
 *
 * Pattern 2 (adopted from expressive-code's `helpers/color-transforms.ts`):
 * CSS variable defaults are derived from the loaded Shiki theme and adjusted
 * to meet WCAG contrast ratios, so code blocks look good with ANY Shiki theme
 * out of the box — line numbers, diff backgrounds, and focus highlights are
 * automatically legible against the theme's background color.
 *
 * The functions here are intentionally minimal — we only implement what we
 * need to compute a few default `--pcb-*` values. For full color manipulation
 * (lighten/darken/mix), see expressive-code's implementation.
 */
/** A color in RGB format (0–255 per channel). */
export interface RGB {
    r: number;
    g: number;
    b: number;
    a?: number;
}
/** Contrast ratio per WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio (1–21). */
export declare function contrastRatio(fg: RGB, bg: RGB): number;
/**
 * Parse a hex color (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) or rgb()/rgba() string
 * into an RGB object. Returns null if the input can't be parsed.
 */
export declare function parseColor(input: string | undefined | null): RGB | null;
/** Convert an RGB color back to a hex string (#RRGGBB or #RRGGBBAA). */
export declare function toHex({ r, g, b, a }: RGB): string;
/** Mix two colors by a ratio (0 = pure a, 1 = pure b). */
export declare function mix(a: RGB, b: RGB, ratio: number): RGB;
/** Lighten a color toward white by a ratio (0–1). */
export declare function lighten(color: RGB, ratio: number): RGB;
/** Darken a color toward black by a ratio (0–1). */
export declare function darken(color: RGB, ratio: number): RGB;
/**
 * Adjust a foreground color to meet a target contrast ratio against a
 * background. If the contrast is already sufficient, returns the foreground
 * unchanged. Otherwise, lightens (if bg is dark) or darkens (if bg is light)
 * the foreground until the target ratio is met.
 *
 * @param fg Foreground color to adjust
 * @param bg Background color to adjust against
 * @param minRatio Minimum WCAG contrast ratio (default 4.5 = AA for normal text)
 * @param maxRatio Maximum ratio to aim for if adjusting (default 7.0 = AAA)
 * @returns The adjusted foreground color (or the original if already sufficient)
 */
export declare function ensureColorContrastOnBackground(fg: RGB, bg: RGB, minRatio?: number, maxRatio?: number): RGB;
/**
 * Extract the background and foreground colors from a Shiki theme object.
 * Shiki themes have a `bg` and `fg` property at the top level (hex strings).
 * Returns nulls if the theme shape doesn't match.
 */
export declare function extractThemeColors(theme: unknown): {
    bg: RGB | null;
    fg: RGB | null;
};
/**
 * Compute theme-aware `--pcb-*` defaults for a code block based on the
 * loaded Shiki theme. These are applied as inline styles on the `<figure>`
 * element, so the static `dist/styles.css` can ship its own defaults while
 * the runtime overrides them with theme-aware values.
 *
 * Currently computes:
 *   - --pcb-bg: theme background (or 'inherit' if unknown)
 *   - --pcb-fg: theme foreground (or 'inherit' if unknown)
 *   - --pcb-line-numbers-fg: theme fg, contrast-adjusted against theme bg
 *   - --pcb-line-highlight-bg: theme fg at ~12% alpha (subtle highlight)
 *   - --pcb-line-diff-add-bg: green at ~18% alpha
 *   - --pcb-line-diff-del-bg: red at ~18% alpha
 *   - --pcb-line-focus-bg: theme fg at ~6% alpha (subtle dim)
 *
 * @param theme The Shiki theme object (must have `bg` and `fg` hex strings)
 * @returns A CSS style string (e.g. `--pcb-bg:#fff;--pcb-fg:#000;...`) or empty string
 */
export declare function computeThemeAwareDefaults(theme: unknown): string;
//# sourceMappingURL=color-utils.d.ts.map