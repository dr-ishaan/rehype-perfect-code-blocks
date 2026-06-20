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

import type { AstroIntegration } from 'astro';
import { rehypePerfectCodeBlocks } from './index.js';
import { remarkPreserveCodeMeta } from './remark.js';
import { COPY_SCRIPT } from './copy-script.js';
import type { PerfectCodeOptions } from './types.js';
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
function loadCss(): string {
  try {
    return readFileSync(join(__dirname, 'styles.css'), 'utf8');
  } catch {
    try {
      return readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    } catch {
      return '';
    }
  }
}

/** Escape a string for use as an HTML attribute value (defense in depth). */
function escapeAttr(s: string): string {
  return s.replace(/[<>"'&]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;',
  }[c] ?? c));
}

/** Recursively walk a directory and return all .html file paths. */
function findHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findHtmlFiles(fullPath));
      } else if (entry.name.endsWith('.html')) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return results;
}

export default function perfectCode(
  options: PerfectCodeOptions = {}
): AstroIntegration {
  return {
    name: 'rehype-perfect-code-blocks',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        // 1. Register the remark + rehype plugins with the Markdown pipeline.
        const userRehypePlugins = (options.rehypePlugins ?? []) as unknown[];
        updateConfig({
          markdown: {
            syntaxHighlight: 'shiki',
            shikiConfig:
              typeof options.shiki?.theme === 'string'
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
            ] as never,
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
        const injections: string[] = [];
        // CSP nonce: if set, add `nonce="..."` to all <script> and <style> tags
        // so they pass a strict Content-Security-Policy.
        const nonceAttr = options.cspNonce ? ` nonce="${escapeAttr(options.cspNonce)}"` : '';

        // CSS
        if (options.injectStyles !== false) {
          const css = loadCss();
          if (css) {
            injections.push(`<style data-pcb${nonceAttr}>${css}</style>`);
          }
        }

        // Copy-button script
        if (options.copyButton !== false) {
          // Graceful degradation: .no-js class MUST be added BEFORE the copy
          // script runs, so the copy script's swapNoJs() can detect and remove
          // it. If we add .no-js AFTER the copy script, swapNoJs() is a no-op
          // (the class isn't there yet), and the MutationObserver (which only
          // watches childList by default) won't catch the attribute change —
          // leaving .no-js on <html> permanently and hiding the copy button
          // via the `html.no-js .pcb__copy { display: none !important; }` rule.
          // See issue: copy button not working in Astro build output.
          if (options.hideCopyWithoutJs !== false) {
            injections.push(
              `<script${nonceAttr}>document.documentElement.classList.add('no-js');</script>`
            );
          }
          injections.push(`<script${nonceAttr}>${COPY_SCRIPT}</script>`);
        }

        // Manual theme override
        if (options.theme && options.theme !== 'auto') {
          const safeTheme = ['dark', 'light'].includes(options.theme)
            ? options.theme
            : 'auto';
          if (safeTheme !== 'auto') {
            injections.push(
              `<script${nonceAttr}>document.documentElement.setAttribute('data-theme','${safeTheme}');</script>`
            );
          }
        }

        if (injections.length === 0) return;

        const injectionHtml = injections.join('\n');
        const outputDir = fileURLToPath(dir);
        const htmlFiles = findHtmlFiles(outputDir);

        for (const htmlFile of htmlFiles) {
          try {
            const html = readFile(htmlFile, 'utf8');
            // Inject before </head>. If no </head> (rare), inject after <html...>.
            let updated: string;
            if (html.includes('</head>')) {
              updated = html.replace('</head>', `${injectionHtml}</head>`);
            } else if (html.includes('<body')) {
              updated = html.replace('<body', `${injectionHtml}<body`);
            } else {
              updated = injectionHtml + html;
            }
            writeFileSync(htmlFile, updated);
          } catch {
            // Skip files that can't be read/written
          }
        }
      },
    },
  };
}
