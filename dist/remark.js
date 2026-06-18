/**
 * Remark plugin that preserves fenced-code meta on the resulting hast tree.
 *
 * By default, remark-rehype drops the `meta` string from fenced code blocks:
 *
 *   ```js title="x.js" {1,3-5} wrap
 *         ^^^^^^^^^^^^^^^^^^^^^^^
 *         this entire string is lost
 *
 * This plugin sets `node.data.hProperties.dataMeta = node.meta` on the mdast
 * `code` node, so remark-rehype carries it onto the resulting `<code>` element
 * as a `data-meta` attribute. The rehype plugin then reads it back.
 *
 * Usage:
 *   unified()
 *     .use(remarkParse)
 *     .use(remarkPreserveCodeMeta)    // ← before remarkRehype
 *     .use(remarkRehype)
 *     .use(rehypePerfectCodeBlocks)
 *     .use(rehypeStringify)
 */
import { visit } from 'unist-util-visit';
export function remarkPreserveCodeMeta() {
    return (tree) => {
        visit(tree, 'code', (node) => {
            if (!node.meta)
                return;
            node.data = node.data ?? {};
            node.data.hProperties = {
                ...(node.data.hProperties ?? {}),
                dataMeta: node.meta,
            };
        });
    };
}
export default remarkPreserveCodeMeta;
//# sourceMappingURL=remark.js.map