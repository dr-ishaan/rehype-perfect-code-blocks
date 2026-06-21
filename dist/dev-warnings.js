/**
 * Development warnings (v2.1.0).
 *
 * Emits warnings to the logger during build/dev for common misconfigurations:
 *   - Unknown language not loaded in Shiki
 *   - Invalid meta syntax (e.g., `{1,a-5}` instead of `{1,3-5}`)
 *   - Conflicting options (e.g., `wrap` + `collapseAfter` both enabled)
 *   - Code block inside raw HTML detected but rehype-raw not installed
 *
 * Warnings are emitted once per unique message (deduped) to avoid spam.
 */
import { visit } from 'unist-util-visit';
const warnedMessages = new Set();
function warnOnce(ctx, msg) {
    if (warnedMessages.has(msg))
        return;
    warnedMessages.add(msg);
    ctx.logger.warn(msg);
}
/**
 * Check for common misconfigurations and emit dev warnings.
 * Call this once per document after the plugin has processed the tree.
 */
export function runDevWarnings(tree, ctx) {
    // 1. Check for conflicting options
    if (ctx.wrap && ctx.collapseAfter !== null) {
        warnOnce(ctx, '[rehype-perfect-code-blocks] Both `wrap` and `collapseAfter` are enabled. ' +
            'Collapsed blocks may not wrap correctly. Consider disabling one.');
    }
    // 2. Check for code blocks inside raw HTML without rehype-raw
    if (!ctx.hasRehypeRaw) {
        let foundRawHtmlAroundCode = false;
        visit(tree, 'element', (node) => {
            if (foundRawHtmlAroundCode)
                return;
            // Look for <pre> elements that are children of raw HTML elements
            // like <details>, <div> with class containing "card", etc.
            // This is a heuristic — we can't perfectly detect raw HTML vs markdown HTML.
            if (node.tagName === 'details' ||
                (node.tagName === 'div' && node.properties?.className &&
                    Array.isArray(node.properties.className) &&
                    node.properties.className.some((c) => typeof c === 'string' && (c.includes('card') || c.includes('container'))))) {
                const hasPre = node.children?.some((c) => c.type === 'element' && c.tagName === 'pre');
                if (hasPre)
                    foundRawHtmlAroundCode = true;
            }
        });
        if (foundRawHtmlAroundCode) {
            warnOnce(ctx, '[rehype-perfect-code-blocks] Code block inside raw HTML detected but rehype-raw ' +
                'does not appear to be installed. Code blocks inside <details>, <div class="card">, ' +
                'etc. may not render correctly. Add rehype-raw to your pipeline: ' +
                'npm install rehype-raw');
        }
    }
    // 3. Check for unknown/invalid meta syntax
    visit(tree, 'element', (node) => {
        if (node.tagName !== 'pre')
            return;
        const codeEl = node.children?.find((c) => c.type === 'element' && c.tagName === 'code');
        if (!codeEl)
            return;
        const meta = codeEl.properties?.dataMeta ??
            node.properties?.dataMeta ?? '';
        if (!meta)
            return;
        // Check for invalid range syntax like {1,a-5} or {1-}
        const rangeMatch = meta.match(/\{([^}]*)\}/g);
        if (rangeMatch) {
            for (const range of rangeMatch) {
                const inside = range.slice(1, -1);
                // Valid: digits, commas, hyphens, spaces, #id, /word/
                // Invalid: letters (except in /word/ or "phrase"), other punctuation
                if (!/^[\d\s,/-]+$/.test(inside) && !inside.includes('"') && !inside.includes('/')) {
                    warnOnce(ctx, `[rehype-perfect-code-blocks] Invalid meta syntax: "${range}" in "${meta}". ` +
                        'Expected format like {1,3-5} for line highlighting.');
                }
            }
        }
    });
}
/**
 * Warn about an unknown language that Shiki couldn't load.
 * Called from shiki.ts when a language fails to tokenize.
 */
export function warnUnknownLanguage(lang, ctx) {
    warnOnce(ctx, `[rehype-perfect-code-blocks] Unknown language "${lang}" — not loaded in Shiki. ` +
        'Falling back to plaintext. Add it to `shiki.langs` or install the grammar.');
}
/**
 * Reset the warning dedup set (for testing).
 */
export function resetWarningDedup() {
    warnedMessages.clear();
}
//# sourceMappingURL=dev-warnings.js.map