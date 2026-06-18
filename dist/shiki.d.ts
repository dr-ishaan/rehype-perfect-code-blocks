/**
 * Shiki caller. Used when `engine: 'shiki'` or when no highlighter has run yet
 * (`engine: 'auto'` fallback).
 *
 * Key design decisions (learned from rehype-pretty-code):
 *   1. Pass `meta: { __raw: metaString }` to Shiki so transformers can read it.
 *   2. Pass the user's `transformers` array through verbatim.
 *   3. Auto-register the official `@shikijs/transformers` for diff/focus/highlight/error
 *      notations when the corresponding options are enabled.
 *   4. Support dual themes via Shiki's `themes: { dark, light }` so users get
 *      `--shiki-dark` / `--shiki-light` CSS vars for free.
 *   5. Lazily `loadLanguage` any missing lang per-doc-pass.
 *   6. Cache by the FULL theme spec (light + dark + langs), not just the dark key.
 */
import type { Root } from 'hast';
import type { PerfectCodeOptions } from './types.js';
/**
 * Walk the tree; for every <pre><code> that does NOT yet look Shiki-processed
 * (i.e. no `astro-code` / `shiki` class), tokenize it via Shiki and replace
 * the node. Also pass `transformers` + `meta` so all the official Shiki
 * transformers work.
 */
export declare function runShikiOnRawBlocks(tree: Root, opts: Required<PerfectCodeOptions>): Promise<void>;
//# sourceMappingURL=shiki.d.ts.map