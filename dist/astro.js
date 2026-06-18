/**
 * Astro integration for rehype-perfect-code-blocks.
 *
 * Usage:
 *
 *   // astro.config.mjs
 *   import { defineConfig } from 'astro/config';
 *   import rehypeRaw from 'rehype-raw';
 *   import perfectCode from '@dr-ishaan/rehype-perfect-code-blocks/astro';
 *
 *   export default defineConfig({
 *     integrations: [
 *       perfectCode({
 *         rehypePlugins: [rehypeRaw],  // for code blocks inside raw HTML
 *       }),
 *     ],
 *   });
 */
import { rehypePerfectCodeBlocks } from './index.js';
import { remarkPreserveCodeMeta } from './remark.js';
import { COPY_SCRIPT } from './copy-script.js';
import { readFileSync } from 'node:fs';
import { readdirSync, writeFileSync, readFileSync as readFile } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * Load the bundled CSS at runtime via readFileSync rather than via Vite's
 * `?raw` query. The `?raw` approach only works when Vite is bundling the
 * module (i.e. inside an Astro/Vite project that resolves the package
 * through Vite's pipeline). When the package is consumed by a plain Node
 * script, a non-Vite bundler, or — importantly — when it is *symlinked*
 * into a project (so Vite treats it as a linked dep), the `?raw` query
 * fails with `Unknown file extension ".css"`.
 *
 * Using readFileSync at runtime is more portable.
 */
function loadCss() {
    try {
        return readFileSync(join(__dirname, 'styles.css'), 'utf8');
    }
    catch {
        try {
            return readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
        }
        catch {
            return '';
        }
    }
}
/** Recursively walk a directory and return all .html file paths. */
function findHtmlFiles(dir) {
    const results = [];
    try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...findHtmlFiles(fullPath));
            }
            else if (entry.name.endsWith('.html')) {
                results.push(fullPath);
            }
        }
    }
    catch {
        // Directory doesn't exist or can't be read
    }
    return results;
}
export default function perfectCode(options = {}) {
    return {
        name: 'rehype-perfect-code-blocks',
        hooks: {
            'astro:config:setup': ({ updateConfig }) => {
                // 1. Register the remark + rehype plugins with the Markdown pipeline.
                const userRehypePlugins = (options.rehypePlugins ?? []);
                updateConfig({
                    markdown: {
                        syntaxHighlight: 'shiki',
                        shikiConfig: typeof options.shiki?.theme === 'string'
                            ? { theme: options.shiki.theme }
                            : options.shiki?.theme
                                ? { themes: options.shiki.theme }
                                : undefined,
                        remarkPlugins: [remarkPreserveCodeMeta],
                        rehypePlugins: [
                            ...userRehypePlugins,
                            [rehypePerfectCodeBlocks, options],
                            // Cast: Astro's rehypePlugins type is a complex union; our
                            // array shape ([plugin, options]) is one of the supported forms.
                        ],
                    },
                });
            },
            'astro:build:done': ({ dir }) => {
                // 2. After Astro finishes building all pages, inject CSS + scripts
                //    into every generated .html file. This is the most reliable
                //    method — it works with Astro v4, v5, v6, static and SSR modes,
                //    and doesn't require the user to import anything in their layout.
                //
                //    (The previous `injectScript('page', '<style>...')` approach
                //    breaks on Astro 6 where injectScript expects JS, not HTML.)
                const injections = [];
                // CSS
                if (options.injectStyles !== false) {
                    const css = loadCss();
                    if (css) {
                        injections.push(`<style data-pcb>${css}</style>`);
                    }
                }
                // Copy-button script
                if (options.copyButton !== false) {
                    injections.push(`<script>${COPY_SCRIPT}</script>`);
                    // Graceful degradation: .no-js class
                    if (options.hideCopyWithoutJs !== false) {
                        injections.push(`<script>document.documentElement.classList.add('no-js');</script>`);
                    }
                }
                // Manual theme override
                if (options.theme && options.theme !== 'auto') {
                    const safeTheme = ['dark', 'light'].includes(options.theme)
                        ? options.theme
                        : 'auto';
                    if (safeTheme !== 'auto') {
                        injections.push(`<script>document.documentElement.setAttribute('data-theme','${safeTheme}');</script>`);
                    }
                }
                if (injections.length === 0)
                    return;
                const injectionHtml = injections.join('\n');
                const outputDir = fileURLToPath(dir);
                const htmlFiles = findHtmlFiles(outputDir);
                for (const htmlFile of htmlFiles) {
                    try {
                        const html = readFile(htmlFile, 'utf8');
                        // Inject before </head>. If no </head> (rare), inject after <html...>.
                        let updated;
                        if (html.includes('</head>')) {
                            updated = html.replace('</head>', `${injectionHtml}</head>`);
                        }
                        else if (html.includes('<body')) {
                            updated = html.replace('<body', `${injectionHtml}<body`);
                        }
                        else {
                            updated = injectionHtml + html;
                        }
                        writeFileSync(htmlFile, updated);
                    }
                    catch {
                        // Skip files that can't be read/written
                    }
                }
            },
        },
    };
}
//# sourceMappingURL=astro.js.map