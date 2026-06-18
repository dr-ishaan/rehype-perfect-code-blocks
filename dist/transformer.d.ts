/**
 * hast tree walker that transforms every highlighted `<pre>` into a
 * styled `<figure class="pcb">` with optional header bar, gutter,
 * line states, copy button, captions, and more.
 *
 * Key design decisions (learned from rehype-pretty-code + VitePress + EC):
 *   1. Map Shiki's notation classes (diff add/remove, focused, highlighted,
 *      error, warning) onto our own pcb__line--* classes when wrapping.
 *   2. Strip Shiki's `class="shiki xxx"` and inline `style="background-color:..."`
 *      from <pre> when keepBackground === false (our default).
 *   3. Honor lineNumbersStart, caption, data-language, data-theme attrs.
 *   4. Auto-switch to terminal preset for sh/bash/zsh/etc.
 *   5. Extract filename from first-line comment when extractFileNameFromCode === true.
 *   6. Call visitor hooks (onVisitLine, onVisitHighlightedLine, etc.).
 *   7. Apply filterMetaString before parsing.
 *   8. Emit data-line-numbers-max-digits for CSS-driven gutter sizing.
 *   9. Configurable copy button (hover mode, custom icons, custom duration).
 *  10. Emit data-* attributes alongside pcb__ classes for rehype-pretty-code CSS interop.
 */
import type { Root } from 'hast';
import type { PerfectCodeOptions } from './types.js';
export declare function rehypePerfectCodeBlocks(userOptions?: PerfectCodeOptions): (tree: Root) => Promise<void>;
//# sourceMappingURL=transformer.d.ts.map