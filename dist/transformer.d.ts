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
/**
 * Defense-in-depth check: returns `true` if the supplied HTML string is free
 * of obviously dangerous patterns (`<script>`, `on*=` handlers, `javascript:`
 * URLs, `<iframe>`, `<object>`, `<embed>`).
 *
 * Used by `buildCopyButton()` to gate both `copyIcon` (which becomes a hast
 * subtree via `parseInlineHtml`) and `successIcon` (which is stored verbatim
 * as a `data-success-icon` attribute and later innerHTML'd by the client
 * copy-script). Without this check, `successIcon` would be a latent XSS sink.
 *
 * This is NOT a full HTML sanitizer. Callers MUST still ensure the input is
 * developer-trusted. The check exists to fail-closed when dangerous patterns
 * are detected, not to make untrusted input safe.
 */
export declare function isSafeInlineHtml(html: string | undefined | null): boolean;
export declare function rehypePerfectCodeBlocks(userOptions?: PerfectCodeOptions): (tree: Root) => Promise<void>;
//# sourceMappingURL=transformer.d.ts.map