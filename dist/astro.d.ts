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
import type { AstroIntegration } from 'astro';
import type { PerfectCodeOptions } from './types.js';
export default function perfectCode(options?: PerfectCodeOptions): AstroIntegration;
//# sourceMappingURL=astro.d.ts.map