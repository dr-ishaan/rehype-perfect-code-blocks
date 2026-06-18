/**
 * Astro integration for rehype-perfect-code-blocks.
 *
 * Usage:
 *
 *   // astro.config.mjs
 *   import { defineConfig } from 'astro/config';
 *   import perfectCode from 'rehype-perfect-code-blocks/astro';
 *
 *   export default defineConfig({
 *     integrations: [
 *       perfectCode({
 *         decorations: true,
 *         copyButton: true,
 *         // ...all options from src/types.ts
 *       }),
 *     ],
 *   });
 */
import { rehypePerfectCodeBlocks } from './index.js';
import { remarkPreserveCodeMeta } from './remark.js';
import { COPY_SCRIPT } from './copy-script.js';
// Vite's ?raw query — type declared in src/vite-raw.d.ts
import css from './styles.css?raw';
export default function perfectCode(options = {}) {
    return {
        name: 'rehype-perfect-code-blocks',
        hooks: {
            'astro:config:setup': ({ updateConfig, injectScript }) => {
                // 1. Register the remark + rehype plugins with the Markdown pipeline.
                //    The remark plugin preserves fence meta (title="...", {1,3-5}, flags)
                //    onto the hast tree so the rehype plugin can read it.
                updateConfig({
                    markdown: {
                        syntaxHighlight: 'shiki',
                        shikiConfig: typeof options.shiki?.theme === 'string'
                            ? { theme: options.shiki.theme }
                            : options.shiki?.theme
                                ? { themes: options.shiki.theme }
                                : undefined,
                        remarkPlugins: [remarkPreserveCodeMeta],
                        rehypePlugins: [{ options, implementation: rehypePerfectCodeBlocks }],
                    },
                });
                // 2. Inject global styles (unless user opted out).
                if (options.injectStyles !== false) {
                    injectScript('page', `<style data-pcb>${css}</style>`);
                }
                // 3. Inject the copy-button script once per page.
                if (options.copyButton !== false) {
                    injectScript('page', `<script>${COPY_SCRIPT}</script>`);
                }
                // 4. Respect manual theme override (set on <html data-theme="...">).
                if (options.theme && options.theme !== 'auto') {
                    injectScript('page', `<script>document.documentElement.setAttribute('data-theme','${options.theme}');</script>`);
                }
            },
        },
    };
}
//# sourceMappingURL=astro.js.map