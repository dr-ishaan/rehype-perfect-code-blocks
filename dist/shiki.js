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
import { transformerNotationDiff, transformerNotationFocus, transformerNotationHighlight, transformerNotationErrorLevel, transformerNotationWordHighlight, transformerMetaHighlight, transformerMetaWordHighlight, transformerRenderWhitespace, transformerRenderIndentGuides, transformerRemoveNotationEscape, } from '@shikijs/transformers';
// Lazily resolve a `require` function for synchronous Shiki bundle lookups.
// In Node.js ESM we use `createRequire(import.meta.url)`. In edge runtimes
// / browsers / Deno, `node:module` may not exist — in that case we fall back
// to `null` and `filterBundledLangs` returns a permissive filter (all langs
// pass through; the try/catch around `codeToHast` handles unknown langs).
let syncRequire = null;
try {
    // `node:module` is a Node.js built-in. The static import would fail at
    // module-load time in non-Node environments, so we use a dynamic import
    // wrapped in try/catch (top-level await is supported in ESM + Node 18+).
    const nodeModuleApi = (await import('node:module').catch(() => null));
    if (nodeModuleApi?.createRequire) {
        syncRequire = nodeModuleApi.createRequire(import.meta.url);
    }
}
catch {
    syncRequire = null;
}
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
    // Always keep plaintext variants (special — don't require a bundle).
    const alwaysKeep = new Set(['plaintext', 'text', 'txt', 'ansi']);
    let bundled;
    if (!syncRequire) {
        // Edge runtime / browser — can't read shiki's bundle list synchronously.
        // Pass through everything; the try/catch around codeToHast handles
        // unknown langs by falling back to plaintext.
        return langs;
    }
    try {
        const shiki = syncRequire('shiki');
        bundled = new Set([
            ...Object.keys(shiki.bundledLanguages ?? {}),
            ...Object.keys(shiki.bundledLanguagesAlias ?? {}),
        ]);
    }
    catch {
        bundled = new Set(alwaysKeep);
        return langs.filter((l) => bundled.has(l) || bundled.has(l.toLowerCase()));
    }
    // Always keep plaintext variants.
    for (const p of alwaysKeep)
        bundled.add(p);
    return langs.filter((l) => bundled.has(l) || bundled.has(l.toLowerCase()));
}
/** Build the list of transformers based on user options + meta. */
async function buildTransformers(opts, metaStr) {
    const transformers = [];
    void metaStr;
    // If user wants full manual control, only push their transformers.
    if (opts.disableAutoTransformers) {
        if (opts.shiki.transformers) {
            transformers.push(...opts.shiki.transformers);
        }
        return transformers;
    }
    // Always remove the escape marker `// [\!code xxx]` first so other
    // notation transformers can read what's left.
    transformers.push(transformerRemoveNotationEscape());
    // Meta-driven (read the ``` {1,3-5} ``` and ``` /word/ ``` syntax)
    if (opts.highlight) {
        transformers.push(transformerMetaHighlight({
            className: 'pcb__line--hl',
            // Issue #11 from competitor analysis: support zero-indexed line numbers.
            zeroIndexed: opts.zeroIndexed === true,
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
    // Custom notations: map custom // [!code xxx] markers to CSS classes.
    // (Previously this was `void customNotations` — now actually wired up.)
    if (opts.customNotations && Object.keys(opts.customNotations).length > 0) {
        try {
            const { transformerNotationMap } = await import('@shikijs/transformers');
            // Build the classMap in the format transformerNotationMap expects:
            // { markerName: [classList] }
            const classMap = {};
            for (const [marker, cls] of Object.entries(opts.customNotations)) {
                classMap[marker] = [cls];
            }
            transformers.push(transformerNotationMap({
                classMap,
                matchAlgorithm: 'v3',
            }));
        }
        catch {
            // transformerNotationMap not available in this @shikijs/transformers version.
        }
    }
    // Remove comments from rendered code (// ..., # ..., /* ... */, <!-- ... -->)
    if (opts.removeComments) {
        try {
            const { transformerRemoveComments } = await import('@shikijs/transformers');
            transformers.push(transformerRemoveComments());
        }
        catch {
            // Module not available — skip silently.
        }
    }
    // Remove line breaks (joins all lines into one)
    if (opts.removeLineBreaks) {
        try {
            const { transformerRemoveLineBreak } = await import('@shikijs/transformers');
            transformers.push(transformerRemoveLineBreak());
        }
        catch {
            // Module not available — skip silently.
        }
    }
    // Programmatic per-line class assignment (transformerCompactLineOptions)
    if (opts.lineOptions && opts.lineOptions.length > 0) {
        try {
            const { transformerCompactLineOptions } = await import('@shikijs/transformers');
            transformers.push(transformerCompactLineOptions(opts.lineOptions));
        }
        catch {
            // Module not available — skip silently.
        }
    }
    // ANSI escape sequence stripping for terminal output.
    // We use a custom transformer (not in @shikijs/transformers) that walks
    // all text nodes and removes `\x1b\[[0-9;]*[a-zA-Z]` sequences.
    // Applied only when the lang is 'ansi' (which is in the default terminalLangs).
    // (The actual per-block application happens in runShikiOnRawBlocks based on lang.)
    // User-provided transformers — 'before' or 'after' (default) our auto-registered ones.
    const userTransformers = opts.shiki.transformers ?? [];
    if (opts.shiki.transformerOrder === 'before') {
        transformers.unshift(...userTransformers);
    }
    else {
        transformers.push(...userTransformers);
    }
    return transformers;
}
/**
 * Custom transformer that strips ANSI escape sequences from text nodes.
 * Used for `lang: 'ansi'` blocks (terminal output with color codes).
 */
function createAnsiStripTransformer() {
    return {
        name: 'pcb:ansi-strip',
        code(hast) {
            // Walk all text nodes and strip \x1b\[[0-9;]*[a-zA-Z] sequences.
            const visit = (node) => {
                if (!node || typeof node !== 'object')
                    return;
                const n = node;
                if (n.type === 'text' && typeof n.value === 'string') {
                    n.value = n.value.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
                }
                if (Array.isArray(n.children)) {
                    for (const child of n.children)
                        visit(child);
                }
            };
            visit(hast);
            return hast;
        },
    };
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
    // Build theme keys — supports single (string), dual ({light,dark}), and
    // multi-theme (Record<string,string> with 3+ entries) for advanced use cases.
    const themeSpec = opts.shiki.theme;
    let themeKeys;
    let isMultiTheme = false;
    if (typeof themeSpec === 'string') {
        themeKeys = [themeSpec];
    }
    else if (themeSpec && typeof themeSpec === 'object') {
        if ('light' in themeSpec && 'dark' in themeSpec && Object.keys(themeSpec).length === 2) {
            themeKeys = [themeSpec.dark, themeSpec.light];
        }
        else {
            // Multi-theme: Record<string, string> with 3+ entries.
            themeKeys = Object.values(themeSpec);
            isMultiTheme = true;
        }
    }
    else {
        themeKeys = ['github-dark'];
    }
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
        const results = await Promise.allSettled(missing.map((l) => {
            try {
                return Promise.resolve(highlighter.loadLanguage(l));
            }
            catch {
                return Promise.resolve();
            }
        }));
        // Log failed language loads (competitor analysis: EC does this, improves DX).
        const failed = [];
        results.forEach((r, i) => {
            if (r.status === 'rejected')
                failed.push(missing[i]);
        });
        if (failed.length > 0) {
            const logger = opts.logger ?? console;
            logger.warn(`[rehype-perfect-code-blocks] Failed to load languages: ${failed.join(', ')}. ` +
                `Falling back to plaintext for these blocks. ` +
                `Check for typos or install the language grammar.`);
        }
    }
    // Apply language aliases (e.g., { ts: 'typescript' }).
    const langAlias = opts.languageAliases ?? {};
    // Resolve the logger once.
    const logger = opts.logger ?? console;
    // Track which langs we've already warned about (avoid duplicate warnings).
    const warnedLangs = new Set();
    for (const pre of targets) {
        const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
        if (!code)
            continue;
        // Normalize line endings: \r\n and \r → \n (prevents \r artifacts in output).
        let text = extractText(code).replace(/\r\n?/g, '\n');
        // tabWidth normalization: replace tabs with N spaces before tokenization.
        if (opts.tabWidth && opts.tabWidth > 0) {
            text = text.replace(/\t/g, ' '.repeat(opts.tabWidth));
        }
        const langClass = code.properties?.className?.[0] ?? '';
        const rawLang = (langClass.match(/^language-(.+)$/) ?? [])[1] ?? 'plaintext';
        const lang = langAlias[rawLang] ?? rawLang;
        const metaStr = code.properties?.dataMeta ??
            pre.properties?.dataMeta ??
            '';
        // Terminal <placeholder> workaround: Shiki mis-highlights shell snippets
        // containing `<user>@<host>`. Temporarily replace `<...>` with a sentinel,
        // then restore after tokenization.
        const isTerminalLang = opts.terminalLangs.includes(lang);
        let placeholderMap = null;
        if (isTerminalLang && /<([^>]*[^>\s])>/.test(text)) {
            placeholderMap = new Map();
            let i = 0;
            text = text.replace(/<([^>]*[^>\s])>/g, (match, inner) => {
                const sentinel = `\u0000PCB_PH_${i++}\u0000`;
                placeholderMap.set(sentinel, `<${inner}>`);
                return sentinel;
            });
        }
        const transformers = await buildTransformers(opts, metaStr);
        // For 'ansi' lang, add the ANSI escape-sequence stripper transformer.
        if (lang === 'ansi') {
            transformers.push(createAnsiStripTransformer());
        }
        // Build codeToHast/codeToHtml options. Use `themes` (plural) for dual-theme
        // and multi-theme output so Shiki emits `--shiki-light` / `--shiki-dark` /
        // `--shiki-<name>` CSS vars.
        const shikiOpts = {
            lang,
            meta: { __raw: metaStr },
            transformers,
        };
        if (typeof themeSpec === 'string') {
            shikiOpts.theme = themeSpec;
        }
        else if (isMultiTheme) {
            // Multi-theme (3+ themes): pass the full Record as `themes`.
            shikiOpts.themes = themeSpec;
            // Don't inline any single theme — emit all variants as CSS vars.
            shikiOpts.defaultColor = false;
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
                // Restore terminal <placeholder> sentinels back to original text.
                if (placeholderMap) {
                    restorePlaceholders(hastRoot, placeholderMap);
                }
                newPre = hastRoot.children.find((c) => c.type === 'element' && c.tagName === 'pre') ?? null;
            }
            else {
                const html = highlighter.codeToHtml(text, shikiOpts);
                let htmlOut = html;
                if (placeholderMap) {
                    for (const [sentinel, original] of placeholderMap) {
                        htmlOut = htmlOut.split(sentinel).join(original);
                    }
                }
                const fragment = fromHtml(htmlOut, { fragment: true });
                newPre = fragment.children.find((c) => c.type === 'element' && c.tagName === 'pre') ?? null;
            }
        }
        catch (err) {
            // Log unknown-language fallbacks (once per lang).
            const langKey = lang;
            if (!warnedLangs.has(langKey) && langKey !== 'plaintext') {
                warnedLangs.add(langKey);
                logger.warn(`[rehype-perfect-code-blocks] Failed to tokenize language "${langKey}" ` +
                    `(${err instanceof Error ? err.message : String(err)}). Falling back to plaintext.`);
            }
            // Fallback: plaintext
            try {
                const fallbackOpts = { ...shikiOpts, lang: 'plaintext' };
                if (useHast) {
                    const hastRoot = highlighter.codeToHast(text, fallbackOpts);
                    normalizeHast(hastRoot);
                    if (placeholderMap) {
                        restorePlaceholders(hastRoot, placeholderMap);
                    }
                    newPre = hastRoot.children.find((c) => c.type === 'element' && c.tagName === 'pre') ?? null;
                }
                else {
                    const html = highlighter.codeToHtml(text, fallbackOpts);
                    let htmlOut = html;
                    if (placeholderMap) {
                        for (const [sentinel, original] of placeholderMap) {
                            htmlOut = htmlOut.split(sentinel).join(original);
                        }
                    }
                    const fragment = fromHtml(htmlOut, { fragment: true });
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
/**
 * Restore terminal <placeholder> sentinels back to their original text.
 * Walks all text nodes in the HAST tree and replaces sentinel strings
 * with the original `<...>` content.
 *
 * Used after Shiki tokenization to undo the temporary sentinel substitution
 * we applied to prevent Shiki from mis-highlighting `<user>@<host>` patterns
 * in shell/terminal blocks.
 */
function restorePlaceholders(node, map) {
    if (!node || typeof node !== 'object')
        return;
    const n = node;
    if (n.type === 'text' && typeof n.value === 'string') {
        let value = n.value;
        for (const [sentinel, original] of map) {
            // Use split/join to avoid regex special-char issues with sentinels.
            value = value.split(sentinel).join(original);
        }
        n.value = value;
    }
    if (Array.isArray(n.children)) {
        for (const child of n.children)
            restorePlaceholders(child, map);
    }
}
//# sourceMappingURL=shiki.js.map