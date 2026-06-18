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
import { fromHtml } from 'hast-util-from-html';
import { visit } from 'unist-util-visit';
import { createRequire } from 'node:module';
import { transformerNotationDiff, transformerNotationFocus, transformerNotationHighlight, transformerNotationErrorLevel, transformerNotationWordHighlight, transformerMetaHighlight, transformerMetaWordHighlight, transformerRenderWhitespace, transformerRenderIndentGuides, transformerRemoveNotationEscape, } from '@shikijs/transformers';
const require = createRequire(import.meta.url);
const highlighterCache = new Map();
async function getHighlighter(themeKeys, langs, userGetHighlighter, regexEngine) {
    // Filter out langs that aren't bundled with Shiki to avoid synchronous
    // throws inside `createHighlighter`. We use a try/catch around the
    // bundle lookup via `bundledLanguages`.
    const safeLangs = filterBundledLangs(langs);
    const cacheKey = `${themeKeys.join(',')}|${[...safeLangs].sort().join(',')}|${regexEngine ?? 'onig'}`;
    let promise = highlighterCache.get(cacheKey);
    if (!promise) {
        promise = (async () => {
            if (userGetHighlighter) {
                return (await userGetHighlighter({ themes: themeKeys, langs: safeLangs }));
            }
            const shiki = await import('shiki');
            const createOpts = {
                themes: themeKeys,
                langs: safeLangs.length > 0 ? safeLangs : ['typescript', 'bash', 'javascript', 'json', 'html', 'css'],
            };
            // Pure-JS regex engine for edge runtimes (Cloudflare Workers, Vercel Edge, browser).
            // No WASM download required.
            if (regexEngine === 'javascript') {
                try {
                    const engineMod = await import('shiki/engine/javascript');
                    createOpts.engine = engineMod.createJavaScriptRegexEngine();
                }
                catch {
                    // Fallback to default (oniguruma) if the JS engine subpath isn't available.
                }
            }
            const all = await shiki.createHighlighter(createOpts);
            return all;
        })();
        highlighterCache.set(cacheKey, promise);
    }
    return promise;
}
/** Filter out languages that aren't bundled with Shiki (avoids sync throws). */
function filterBundledLangs(langs) {
    let bundled;
    try {
        const shiki = require('shiki');
        bundled = new Set([
            ...Object.keys(shiki.bundledLanguages ?? {}),
            ...Object.keys(shiki.bundledLanguagesAlias ?? {}),
        ]);
    }
    catch {
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
async function buildTransformers(opts, metaStr) {
    const transformers = [];
    void metaStr;
    // Always remove the escape marker `// [\!code xxx]` first so other
    // notation transformers can read what's left.
    transformers.push(transformerRemoveNotationEscape());
    // Meta-driven (read the ``` {1,3-5} ``` and ``` /word/ ``` syntax)
    if (opts.highlight) {
        transformers.push(transformerMetaHighlight({
            className: 'pcb__line--hl',
        }));
    }
    if (opts.diff) {
        transformers.push(transformerNotationDiff({
            classLineAdd: 'pcb__line--add',
            classLineRemove: 'pcb__line--del',
            matchAlgorithm: 'v3',
        }));
    }
    if (opts.focus) {
        transformers.push(transformerNotationFocus({
            classActiveLine: 'pcb__line--focus',
            matchAlgorithm: 'v3',
        }));
    }
    if (opts.highlight) {
        transformers.push(transformerNotationHighlight({
            classActiveLine: 'pcb__line--hl',
            matchAlgorithm: 'v3',
        }));
    }
    if (opts.errorLevels) {
        transformers.push(transformerNotationErrorLevel({
            classMap: {
                error: ['pcb__line--error'],
                warning: ['pcb__line--warning'],
                info: ['pcb__line--info'],
            },
            matchAlgorithm: 'v3',
        }));
    }
    // Word/char highlighting from meta /word/ and // [!code word:foo]
    transformers.push(transformerMetaWordHighlight({
        className: 'pcb__word',
    }));
    transformers.push(transformerNotationWordHighlight({
        classActivePre: 'has-word-highlight',
        matchAlgorithm: 'v3',
    }));
    // Visible whitespace
    if (opts.showWhitespace) {
        transformers.push(transformerRenderWhitespace({
            classTab: 'pcb__tab',
            classSpace: 'pcb__space',
            position: opts.showWhitespace === 'all' ? 'all' : opts.showWhitespace,
        }));
    }
    // Indent guides
    if (opts.indentGuides !== false) {
        const indent = typeof opts.indentGuides === 'number' ? opts.indentGuides : 0;
        if (indent > 0) {
            transformers.push(transformerRenderIndentGuides({
                indent,
            }));
        }
    }
    // Style-to-class: convert Shiki's inline `style="color:..."` on token spans
    // into deduplicated CSS classes (massive HTML payload reduction for dual-theme).
    if (opts.styleToClass) {
        try {
            const { transformerStyleToClass } = await import('@shikijs/transformers');
            transformers.push(transformerStyleToClass());
        }
        catch {
            // Module not available — skip silently.
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
export async function runShikiOnRawBlocks(tree, opts) {
    const targets = [];
    visit(tree, 'element', (node) => {
        if (node.tagName !== 'pre')
            return;
        const cls = node.properties?.className;
        if (hasShikiMarker(cls))
            return; // already tokenized, skip
        targets.push(node);
    });
    if (targets.length === 0)
        return;
    // Build theme keys (one or two)
    const themeSpec = opts.shiki.theme;
    const themeKeys = typeof themeSpec === 'string'
        ? [themeSpec]
        : themeSpec
            ? [themeSpec.dark, themeSpec.light]
            : ['github-dark'];
    // Collect all langs needed for these blocks
    const langSet = new Set(opts.shiki.langs ?? []);
    for (const pre of targets) {
        const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
        if (!code)
            continue;
        const cls = code.properties?.className ?? [];
        for (const c of cls) {
            const m = c.match(/^language-(.+)$/);
            if (m)
                langSet.add(m[1]);
        }
    }
    langSet.add('plaintext');
    const userGetHighlighter = opts.shiki.getHighlighter;
    const highlighter = await getHighlighter(themeKeys, [...langSet], userGetHighlighter, opts.shiki.regexEngine);
    // Lazily load any langs not yet loaded. Shiki's `loadLanguage` throws
    // synchronously for bundled-but-unknown langs (e.g. typos), so wrap each
    // call in its own try/catch and use Promise.allSettled to swallow rejects.
    const loaded = new Set(highlighter.getLoadedLanguages());
    const missing = [...langSet].filter((l) => !loaded.has(l));
    if (missing.length > 0) {
        await Promise.allSettled(missing.map((l) => {
            try {
                return Promise.resolve(highlighter.loadLanguage(l));
            }
            catch {
                return Promise.resolve();
            }
        }));
    }
    // Apply language aliases (e.g., { ts: 'typescript' }).
    const langAlias = opts.languageAliases ?? {};
    for (const pre of targets) {
        const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
        if (!code)
            continue;
        const text = extractText(code);
        const langClass = code.properties?.className?.[0] ?? '';
        const rawLang = (langClass.match(/^language-(.+)$/) ?? [])[1] ?? 'plaintext';
        const lang = langAlias[rawLang] ?? rawLang;
        const metaStr = code.properties?.dataMeta ??
            pre.properties?.dataMeta ??
            '';
        const transformers = await buildTransformers(opts, metaStr);
        // Build codeToHast/codeToHtml options. Use `themes` (plural) for dual-theme output
        // so Shiki emits `--shiki-light` / `--shiki-dark` CSS vars.
        const shikiOpts = {
            lang,
            meta: { __raw: metaStr },
            transformers,
        };
        if (typeof themeSpec === 'string') {
            shikiOpts.theme = themeSpec;
        }
        else {
            shikiOpts.themes = themeSpec;
            shikiOpts.defaultColor = 'dark'; // tells Shiki which color to inline by default
        }
        // Prefer codeToHast (direct HAST output, no HTML-parse round-trip).
        // Fall back to codeToHtml + fromHtml if codeToHast isn't available.
        let newPre = null;
        const useHast = opts.useHastApi !== false && typeof highlighter.codeToHast === 'function';
        try {
            if (useHast) {
                const hastRoot = highlighter.codeToHast(text, shikiOpts);
                // Shiki's codeToHast uses raw HTML attribute names (`class` instead of
                // `className`, `aria-hidden` instead of `ariaHidden`). Normalize them
                // so the rest of our pipeline (which expects hast property names) works.
                normalizeHast(hastRoot);
                newPre = hastRoot.children.find((c) => c.type === 'element' && c.tagName === 'pre') ?? null;
            }
            else {
                const html = highlighter.codeToHtml(text, shikiOpts);
                const fragment = fromHtml(html, { fragment: true });
                newPre = fragment.children.find((c) => c.type === 'element' && c.tagName === 'pre') ?? null;
            }
        }
        catch {
            // Fallback: plaintext
            try {
                const fallbackOpts = { ...shikiOpts, lang: 'plaintext' };
                if (useHast) {
                    const hastRoot = highlighter.codeToHast(text, fallbackOpts);
                    normalizeHast(hastRoot);
                    newPre = hastRoot.children.find((c) => c.type === 'element' && c.tagName === 'pre') ?? null;
                }
                else {
                    const html = highlighter.codeToHtml(text, fallbackOpts);
                    const fragment = fromHtml(html, { fragment: true });
                    newPre = fragment.children.find((c) => c.type === 'element' && c.tagName === 'pre') ?? null;
                }
            }
            catch {
                continue; // give up silently
            }
        }
        if (newPre) {
            // Preserve the data-meta attribute so the rehype transformer can read
            // fence meta after Shiki re-tokenizes the block.
            const newCode = newPre.children.find((c) => c.type === 'element' && c.tagName === 'code');
            if (newCode) {
                newCode.properties = newCode.properties ?? {};
                if (metaStr) {
                    newCode.properties.dataMeta = metaStr;
                }
                // Re-attach language-X class so the transformer can detect the language.
                const existingClasses = newCode.properties.className ?? [];
                const langClass2 = `language-${rawLang}`;
                if (!existingClasses.includes(langClass2)) {
                    newCode.properties.className = [...existingClasses, langClass2];
                }
                newCode.properties.dataLanguage = rawLang;
            }
            Object.assign(pre, newPre);
        }
    }
}
function hasShikiMarker(className) {
    if (!className)
        return false;
    const arr = Array.isArray(className) ? className : String(className).split(/\s+/);
    return arr.some((c) => c === 'astro-code' || c === 'shiki');
}
function extractText(el) {
    let out = '';
    visit(el, 'text', (t) => { out += t.value; });
    return out;
}
/**
 * Normalize a Shiki HAST tree so property names follow the hast convention
 * (camelCase: `className`, `ariaHidden`, etc.) instead of raw HTML attribute
 * names (`class`, `aria-hidden`).
 *
 * Shiki's `codeToHast` returns raw HTML attribute names, but our pipeline
 * (and `rehype-stringify`) expects camelCase. `hast-util-from-html` does this
 * normalization automatically when parsing an HTML string, so the `codeToHtml`
 * path doesn't need this — only the `codeToHast` path does.
 */
const HTML_ATTR_TO_HAST = {
    class: 'className',
    'aria-hidden': 'ariaHidden',
    'aria-label': 'ariaLabel',
    'aria-live': 'ariaLive',
    'aria-atomic': 'ariaAtomic',
    'aria-describedby': 'ariaDescribedby',
    'aria-labelledby': 'ariaLabelledby',
    'aria-controls': 'ariaControls',
    'aria-expanded': 'ariaExpanded',
    'aria-pressed': 'ariaPressed',
    'aria-selected': 'ariaSelected',
    'data-line': 'dataLine',
    'data-language': 'dataLanguage',
    'data-meta': 'dataMeta',
    'data-theme': 'dataTheme',
    'tabindex': 'tabIndex',
    'colspan': 'colSpan',
    'rowspan': 'rowSpan',
    'for': 'htmlFor',
    'autocomplete': 'autoComplete',
};
function normalizeHast(node) {
    if (!node || typeof node !== 'object')
        return;
    const n = node;
    if (n.type === 'element' && n.properties) {
        const newProps = {};
        for (const [key, value] of Object.entries(n.properties)) {
            const camelKey = HTML_ATTR_TO_HAST[key] ?? key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            // Special case: 'class' should become an array of class names.
            if (key === 'class') {
                newProps.className = Array.isArray(value) ? value : String(value).split(/\s+/);
            }
            else {
                newProps[camelKey] = value;
            }
        }
        n.properties = newProps;
    }
    if (Array.isArray(n.children)) {
        for (const child of n.children)
            normalizeHast(child);
    }
}
//# sourceMappingURL=shiki.js.map