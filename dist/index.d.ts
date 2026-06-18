/**
 * rehype-perfect-code-blocks — rehype plugin entry.
 *
 * Usage (standalone):
 *
 *   import { rehypePerfectCodeBlocks } from 'rehype-perfect-code-blocks';
 *
 *   unified()
 *     .use(remarkParse)
 *     .use(remarkPreserveCodeMeta)
 *     .use(remarkRehype)
 *     .use(rehypePerfectCodeBlocks, { decorations: true, copyButton: true })
 *     .use(rehypeStringify)
 *     .process(markdown);
 *
 * For Astro, use `rehype-perfect-code-blocks/astro` instead — it wraps this
 * plugin with style/script injection and automatic Shiki integration.
 */
import type { Plugin } from 'unified';
import type { Root } from 'hast';
import { remarkPreserveCodeMeta } from './remark.js';
import type { PerfectCodeOptions } from './types.js';
export { remarkPreserveCodeMeta };
export declare const rehypePerfectCodeBlocks: Plugin<[PerfectCodeOptions?], Root>;
export default rehypePerfectCodeBlocks;
//# sourceMappingURL=index.d.ts.map