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
import type { Root } from 'hast';
export interface DevWarningContext {
    logger: {
        warn: (msg: string) => void;
        error: (msg: string) => void;
    };
    hasRehypeRaw: boolean;
    wrap: boolean;
    collapseAfter: number | null;
}
/**
 * Check for common misconfigurations and emit dev warnings.
 * Call this once per document after the plugin has processed the tree.
 */
export declare function runDevWarnings(tree: Root, ctx: DevWarningContext): void;
/**
 * Warn about an unknown language that Shiki couldn't load.
 * Called from shiki.ts when a language fails to tokenize.
 */
export declare function warnUnknownLanguage(lang: string, ctx: DevWarningContext): void;
/**
 * Reset the warning dedup set (for testing).
 */
export declare function resetWarningDedup(): void;
//# sourceMappingURL=dev-warnings.d.ts.map