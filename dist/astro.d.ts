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
import type { PerfectCodeOptions } from './types.js';
export default function perfectCode(options?: PerfectCodeOptions): AstroIntegration;
//# sourceMappingURL=astro.d.ts.map