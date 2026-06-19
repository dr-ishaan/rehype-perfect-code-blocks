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
/** Relative luminance per WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance */
function relativeLuminance({ r, g, b }) {
    const channel = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
/** Contrast ratio per WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio (1–21). */
export function contrastRatio(fg, bg) {
    const l1 = relativeLuminance(fg);
    const l2 = relativeLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}
/**
 * Parse a hex color (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) or rgb()/rgba() string
 * into an RGB object. Returns null if the input can't be parsed.
 */
export function parseColor(input) {
    if (!input)
        return null;
    const s = input.trim().toLowerCase();
    // Hex: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
    const hexMatch = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3 || hex.length === 4) {
            hex = hex
                .split('')
                .map((c) => c + c)
                .join('');
        }
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : undefined;
        return { r, g, b, a };
    }
    // rgb() / rgba()
    const rgbMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1], 10),
            g: parseInt(rgbMatch[2], 10),
            b: parseInt(rgbMatch[3], 10),
            a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : undefined,
        };
    }
    return null;
}
/** Convert an RGB color back to a hex string (#RRGGBB or #RRGGBBAA). */
export function toHex({ r, g, b, a }) {
    const toHex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    const base = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
    if (a !== undefined && a < 1)
        return base + toHex2(a * 255);
    return base;
}
/** Mix two colors by a ratio (0 = pure a, 1 = pure b). */
export function mix(a, b, ratio) {
    const t = Math.max(0, Math.min(1, ratio));
    return {
        r: a.r * (1 - t) + b.r * t,
        g: a.g * (1 - t) + b.g * t,
        b: a.b * (1 - t) + b.b * t,
        a: a.a !== undefined || b.a !== undefined ? (a.a ?? 1) * (1 - t) + (b.a ?? 1) * t : undefined,
    };
}
/** Lighten a color toward white by a ratio (0–1). */
export function lighten(color, ratio) {
    return mix(color, { r: 255, g: 255, b: 255 }, ratio);
}
/** Darken a color toward black by a ratio (0–1). */
export function darken(color, ratio) {
    return mix(color, { r: 0, g: 0, b: 0 }, ratio);
}
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
export function ensureColorContrastOnBackground(fg, bg, minRatio = 4.5, maxRatio = 7.0) {
    const current = contrastRatio(fg, bg);
    if (current >= minRatio)
        return fg;
    // Decide direction: if bg is dark (luminance < 0.5), lighten fg; else darken.
    const bgLum = relativeLuminance(bg);
    const direction = bgLum < 0.5 ? 'lighten' : 'darken';
    // Binary search between current and pure white/black for the target ratio.
    let lo = 0;
    let hi = 1;
    let best = fg;
    for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        const candidate = direction === 'lighten' ? lighten(fg, mid) : darken(fg, mid);
        const ratio = contrastRatio(candidate, bg);
        if (ratio >= minRatio && ratio <= maxRatio) {
            return candidate;
        }
        if (ratio < minRatio) {
            lo = mid;
        }
        else {
            best = candidate;
            hi = mid;
        }
    }
    return best;
}
/**
 * Extract the background and foreground colors from a Shiki theme object.
 * Shiki themes have a `bg` and `fg` property at the top level (hex strings).
 * Returns nulls if the theme shape doesn't match.
 */
export function extractThemeColors(theme) {
    const t = theme;
    return {
        bg: parseColor(t?.bg),
        fg: parseColor(t?.fg),
    };
}
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
export function computeThemeAwareDefaults(theme) {
    const { bg, fg } = extractThemeColors(theme);
    if (!bg || !fg)
        return '';
    const parts = [];
    parts.push(`--pcb-bg:${toHex(bg)}`);
    parts.push(`--pcb-fg:${toHex(fg)}`);
    // Line numbers: use fg, but adjust contrast to >= 3.0 (WCAG AA for large text)
    // against the background. Shiki themes often have low-contrast line-number
    // colors baked in; we override them with a guaranteed-legible value.
    const lineNumFg = ensureColorContrastOnBackground(fg, bg, 3.0, 4.5);
    parts.push(`--pcb-ln-fg:${toHex(lineNumFg)}`);
    // Line highlight background: subtle tint of the foreground at ~12% alpha.
    // Use mix() with the background to get a slightly-lighter/darker shade.
    const hlBg = mix(bg, fg, 0.12);
    parts.push(`--pcb-line-highlight-bg:${toHex(hlBg)}`);
    // Diff add: green (#22863a in github) at 18% alpha over bg.
    const diffAdd = mix(bg, { r: 34, g: 134, b: 58 }, 0.18);
    parts.push(`--pcb-line-add-bg:${toHex(diffAdd)}`);
    // Diff del: red (#cb2431 in github) at 18% alpha over bg.
    const diffDel = mix(bg, { r: 203, g: 36, b: 49 }, 0.18);
    parts.push(`--pcb-line-del-bg:${toHex(diffDel)}`);
    // Focus background: dim the non-focused lines by mixing bg with fg at low alpha.
    const focusBg = mix(bg, fg, 0.04);
    parts.push(`--pcb-line-focus-bg:${toHex(focusBg)}`);
    return parts.join(';');
}
//# sourceMappingURL=color-utils.js.map