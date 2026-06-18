/**
 * Shiki caller. Used when `engine: 'shiki'` or when no highlighter has run yet
 * (`engine: 'auto'` fallback).
 *
 * Key design decisions (learned from rehype-pretty-code):
 *   1. Pass `meta: { __raw: metaString }` to Shiki so transformers can read it.
 *   2. Pass the user's `transformers` array through verbatim.
 *   3. Auto-register the official `@shikijs/transformers` for diff/focus/highlight/error
 *      notations when the corresponding options are enabled.
 *   4. Support dual themes via Shiki's `themes: { dark, light }` so users get
 *      `--shiki-dark` / `--shiki-light` CSS vars for free.
 *   5. Lazily `loadLanguage` any missing lang per-doc-pass.
 *   6. Cache by the FULL theme spec (light + dark + langs), not just the dark key.
 */

import type { Element, Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { visit } from 'unist-util-visit';
import { createRequire } from 'node:module';
import type { PerfectCodeOptions } from './types.js';
import {
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationErrorLevel,
  transformerNotationWordHighlight,
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerRenderWhitespace,
  transformerRenderIndentGuides,
  transformerRemoveNotationEscape,
} from '@shikijs/transformers';

const require = createRequire(import.meta.url);

// Use a permissive type for ShikiTransformer to avoid cross-package type
// identity issues when @shikijs/transformers and shiki bundle different copies
// of @shikijs/types. We just need to push transformers into an array and pass
// it to Shiki — runtime type-checking is done by Shiki itself.
type ShikiTransformer = unknown;

type ShikiHighlighter = {
  codeToHtml: (code: string, opts: Record<string, unknown>) => string;
  getLoadedLanguages: () => string[];
  loadLanguage: (lang: string | string[]) => Promise<void>;
  loadTheme: (theme: string | string[]) => Promise<void>;
};

const highlighterCache = new Map<string, Promise<ShikiHighlighter>>();

async function getHighlighter(
  themeKeys: string[],
  langs: string[],
  userGetHighlighter?: (opts: { themes: string[]; langs: string[] }) => Promise<unknown>
): Promise<ShikiHighlighter> {
  // Filter out langs that aren't bundled with Shiki to avoid synchronous
  // throws inside `createHighlighter`. We use a try/catch around the
  // bundle lookup via `bundledLanguages`.
  const safeLangs = filterBundledLangs(langs);
  const cacheKey = `${themeKeys.join(',')}|${[...safeLangs].sort().join(',')}`;
  let promise = highlighterCache.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      if (userGetHighlighter) {
        return (await userGetHighlighter({ themes: themeKeys, langs: safeLangs })) as ShikiHighlighter;
      }
      const shiki = await import('shiki');
      const all = await shiki.createHighlighter({
        themes: themeKeys,
        langs: safeLangs.length > 0 ? safeLangs : ['typescript', 'bash', 'javascript', 'json', 'html', 'css'],
      });
      return all as unknown as ShikiHighlighter;
    })();
    highlighterCache.set(cacheKey, promise);
  }
  return promise;
}

/** Filter out languages that aren't bundled with Shiki (avoids sync throws). */
function filterBundledLangs(langs: string[]): string[] {
  let bundled: Set<string>;
  try {
    const shiki = require('shiki') as {
      bundledLanguages?: Record<string, unknown>;
      bundledLanguagesAlias?: Record<string, unknown>;
    };
    bundled = new Set([
      ...Object.keys(shiki.bundledLanguages ?? {}),
      ...Object.keys(shiki.bundledLanguagesAlias ?? {}),
    ]);
  } catch {
    bundled = new Set();
  }
  // Always keep plaintext variants (special — don't require a bundle).
  bundled.add('plaintext');
  bundled.add('text');
  bundled.add('txt');
  bundled.add('ansi');
  return langs.filter((l) => bundled.has(l) || bundled.has(l.toLowerCase()));
}

/** Build the list of transformers based on user options + meta. */
function buildTransformers(
  opts: Required<PerfectCodeOptions>,
  metaStr: string
): unknown[] {
  const transformers: unknown[] = [];
  void metaStr;

  // Always remove the escape marker `// [\!code xxx]` first so other
  // notation transformers can read what's left.
  transformers.push(transformerRemoveNotationEscape());

  // Meta-driven (read the ``` {1,3-5} ``` and ``` /word/ ``` syntax)
  if (opts.highlight) {
    transformers.push(
      transformerMetaHighlight({
        className: 'pcb__line--hl',
      })
    );
  }
  if (opts.diff) {
    transformers.push(
      transformerNotationDiff({
        classLineAdd: 'pcb__line--add',
        classLineRemove: 'pcb__line--del',
        matchAlgorithm: 'v3',
      })
    );
  }
  if (opts.focus) {
    transformers.push(
      transformerNotationFocus({
        classActiveLine: 'pcb__line--focus',
        matchAlgorithm: 'v3',
      })
    );
  }
  if (opts.highlight) {
    transformers.push(
      transformerNotationHighlight({
        classActiveLine: 'pcb__line--hl',
        matchAlgorithm: 'v3',
      })
    );
  }
  if (opts.errorLevels) {
    transformers.push(
      transformerNotationErrorLevel({
        classMap: {
          error: ['pcb__line--error'],
          warning: ['pcb__line--warning'],
        },
        matchAlgorithm: 'v3',
      })
    );
  }

  // Word/char highlighting from meta /word/ and // [!code word:foo]
  transformers.push(
    transformerMetaWordHighlight({
      className: 'pcb__word',
    })
  );
  transformers.push(
    transformerNotationWordHighlight({
      classActivePre: 'has-word-highlight',
      matchAlgorithm: 'v3',
    })
  );

  // Visible whitespace
  if (opts.showWhitespace) {
    transformers.push(
      transformerRenderWhitespace({
        classTab: 'pcb__tab',
        classSpace: 'pcb__space',
        position: opts.showWhitespace === 'all' ? 'all' : opts.showWhitespace as 'boundary' | 'trailing' | 'leading',
      })
    );
  }

  // Indent guides
  if (opts.indentGuides !== false) {
    const indent = typeof opts.indentGuides === 'number' ? opts.indentGuides : 0;
    if (indent > 0) {
      transformers.push(
        transformerRenderIndentGuides({
          indent,
        })
      );
    }
  }

  // User-provided transformers
  if (opts.shiki.transformers) {
    transformers.push(...opts.shiki.transformers);
  }

  return transformers;
}

/**
 * Walk the tree; for every <pre><code> that does NOT yet look Shiki-processed
 * (i.e. no `astro-code` / `shiki` class), tokenize it via Shiki and replace
 * the node. Also pass `transformers` + `meta` so all the official Shiki
 * transformers work.
 */
export async function runShikiOnRawBlocks(
  tree: Root,
  opts: Required<PerfectCodeOptions>
): Promise<void> {
  const targets: Element[] = [];

  visit(tree, 'element', (node) => {
    if (node.tagName !== 'pre') return;
    const cls = node.properties?.className;
    if (hasShikiMarker(cls)) return; // already tokenized, skip
    targets.push(node);
  });

  if (targets.length === 0) return;

  // Build theme keys (one or two)
  const themeSpec = opts.shiki.theme;
  const themeKeys: string[] =
    typeof themeSpec === 'string'
      ? [themeSpec]
      : themeSpec
        ? [themeSpec.dark, themeSpec.light]
        : ['github-dark'];

  // Collect all langs needed for these blocks
  const langSet = new Set<string>(opts.shiki.langs ?? []);
  for (const pre of targets) {
    const code = pre.children.find(
      (c): c is Element => c.type === 'element' && c.tagName === 'code'
    );
    if (!code) continue;
    const cls = (code.properties?.className as string[] | undefined) ?? [];
    for (const c of cls) {
      const m = c.match(/^language-(.+)$/);
      if (m) langSet.add(m[1]);
    }
  }
  langSet.add('plaintext');

  const userGetHighlighter = opts.shiki.getHighlighter as
    | ((opts: { themes: string[]; langs: string[] }) => Promise<unknown>)
    | undefined;

  const highlighter = await getHighlighter(
    themeKeys,
    [...langSet],
    userGetHighlighter
  );

  // Lazily load any langs not yet loaded. Shiki's `loadLanguage` throws
  // synchronously for bundled-but-unknown langs (e.g. typos), so wrap each
  // call in its own try/catch and use Promise.allSettled to swallow rejects.
  const loaded = new Set(highlighter.getLoadedLanguages());
  const missing = [...langSet].filter((l) => !loaded.has(l));
  if (missing.length > 0) {
    await Promise.allSettled(
      missing.map((l) => {
        try {
          return Promise.resolve(highlighter.loadLanguage(l));
        } catch {
          return Promise.resolve();
        }
      })
    );
  }

  for (const pre of targets) {
    const code = pre.children.find(
      (c): c is Element => c.type === 'element' && c.tagName === 'code'
    );
    if (!code) continue;

    const text = extractText(code);
    const langClass = (code.properties?.className as string[] | undefined)?.[0] ?? '';
    const lang = (langClass.match(/^language-(.+)$/) ?? [])[1] ?? 'plaintext';
    const metaStr =
      (code.properties?.dataMeta as string | undefined) ??
      (pre.properties?.dataMeta as string | undefined) ??
      '';

    const transformers = buildTransformers(opts, metaStr);

    // Build codeToHtml options. Use `themes` (plural) for dual-theme output
    // so Shiki emits `--shiki-light` / `--shiki-dark` CSS vars.
    const codeToHtmlOpts: Record<string, unknown> = {
      lang,
      meta: { __raw: metaStr },
      transformers,
    };
    if (typeof themeSpec === 'string') {
      codeToHtmlOpts.theme = themeSpec;
    } else {
      codeToHtmlOpts.themes = themeSpec;
      codeToHtmlOpts.defaultColor = 'dark'; // tells Shiki which color to inline by default
    }

    let html: string;
    try {
      html = highlighter.codeToHtml(text, codeToHtmlOpts);
    } catch {
      // Fallback: plaintext
      const fallbackOpts = { ...codeToHtmlOpts, lang: 'plaintext' };
      try {
        html = highlighter.codeToHtml(text, fallbackOpts);
      } catch {
        continue; // give up silently
      }
    }

    const fragment = fromHtml(html, { fragment: true });
    const newPre = fragment.children.find(
      (c): c is Element => c.type === 'element' && c.tagName === 'pre'
    );
    if (newPre) {
      // Preserve the data-meta attribute so the rehype transformer can read
      // fence meta after Shiki re-tokenizes the block.
      const newCode = newPre.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code'
      );
      if (newCode) {
        newCode.properties = newCode.properties ?? {};
        if (metaStr) {
          (newCode.properties as Record<string, unknown>).dataMeta = metaStr;
        }
        // Re-attach language-X class so the transformer can detect the language.
        const existingClasses = (newCode.properties.className as string[] | undefined) ?? [];
        const langClass2 = `language-${lang}`;
        if (!existingClasses.includes(langClass2)) {
          (newCode.properties as Record<string, unknown>).className = [...existingClasses, langClass2];
        }
        (newCode.properties as Record<string, unknown>).dataLanguage = lang;
      }
      Object.assign(pre, newPre);
    }
  }
}

function hasShikiMarker(className: unknown): boolean {
  if (!className) return false;
  const arr = Array.isArray(className) ? className : String(className).split(/\s+/);
  return arr.some((c) => c === 'astro-code' || c === 'shiki');
}

function extractText(el: Element): string {
  let out = '';
  visit(el, 'text', (t) => { out += t.value; });
  return out;
}
