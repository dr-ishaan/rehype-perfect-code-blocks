/**
 * Meta parser for fenced code blocks.
 *
 * Supports the de-facto syntax used by Starlight/Docusaurus/Shiki/VitePress:
 *
 *   ```ts title="src/store.ts" {1,3-5} ln{5} /foo/ /bar/1-3 #id showLineNumbers wrap noLang
 *   ^^^         ^^^^^^^^^^^^^^^^^^^^ ^^^^^^^^^^ ^^^ ^^^^^^^^^^ ^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^
 *   lang        title="..."          ranges    ln start word-high  group-id  flags
 *
 * New syntaxes supported (matching rehype-pretty-code):
 *   - ln{N} or showLineNumbers{N}  — start line numbers at N
 *   - {1,3-5}#id                    — group highlighted lines by id for per-group styling
 *   - /word/                        — highlight all occurrences of "word"
 *   - /word/3-5                     — highlight only occurrences 3 through 5
 *   - /word/#id                     — assign id to this word-highlight group
 *   - "phrase"                      — highlight all occurrences of "phrase" (double-quoted)
 *   - caption="..."                 — render a caption below the block
 *
 * Also accepts:
 *   - Quoted titles with escaped quotes: title="src/\"x\".ts" or title='src/"x".ts'
 *   - Comma- and space-separated ranges: {1, 3-5, 7}
 *   - Boolean flags: wrap / noWrap, ln / noLn, bar / noBar,
 *                    decorations / noDecorations, lang / noLang,
 *                    copy / noCopy, collapse / noCollapse
 */
import type { ParsedMeta } from './types.js';
export declare function parseMeta(meta: string | undefined): ParsedMeta;
//# sourceMappingURL=meta.d.ts.map