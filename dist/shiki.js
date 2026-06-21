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
import { computeThemeAwareDefaults } from './color-utils.js';
import { isMathLanguage, renderMath, resolveMathOptions, MATH_LANGS } from './math.js';
import { isMermaidLanguage, renderMermaid, isCsvLanguage, buildCsvTable } from './diagrams.js';
// v2.4.0 Item 8: Colorized brackets (optional peer dep)
let _transformerColorizedBrackets;
async function getColorizedBracketsTransformer() {
    if (_transformerColorizedBrackets !== undefined)
        return _transformerColorizedBrackets;
    try {
        const mod = await import('@shikijs/colorized-brackets');
        _transformerColorizedBrackets = mod.transformerColorizedBrackets;
    }
    catch {
        _transformerColorizedBrackets = null;
    }
    return _transformerColorizedBrackets;
}
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
// v2.3.1 Item 2: Module-level engine cache (from Astro @astrojs/internal-helpers).
// createJavaScriptRegexEngine() compiles a regex translator — creating it
// repeatedly per cache entry is wasteful and can OOM in long dev sessions.
// Hoist to module scope so it's created once and reused.
let _jsEnginePromise = null;
async function getJsEngine() {
    if (_jsEnginePromise)
        return _jsEnginePromise;
    try {
        const engineMod = await import('shiki/engine/javascript');
        _jsEnginePromise = Promise.resolve(engineMod.createJavaScriptRegexEngine());
    }
    catch {
        _jsEnginePromise = null;
        return null;
    }
    return _jsEnginePromise;
}
// v2.3.1 Item 3: Timeout helper for WASM/highlighter initialization.
// If createHighlighter hangs on edge runtimes (WASM fetch stall), fall back
// to the pure-JS regex engine which needs no WASM.
function withTimeout(promise, ms, onTimeout) {
    if (ms <= 0)
        return promise;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            resolve(onTimeout());
        }, ms);
        promise.then((val) => { clearTimeout(timer); resolve(val); }, (err) => { clearTimeout(timer); reject(err); });
    });
}
const taskQueue = [];
let processingQueue = false;
function processQueue() {
    const next = taskQueue.shift();
    if (!next) {
        processingQueue = false;
        return;
    }
    Promise.resolve()
        .then(() => next.taskFn())
        .then((result) => { next.resolve(result); processQueue(); }, (err) => { next.reject(err); processQueue(); });
}
/**
 * Run a task function inside the mutually exclusive highlighter queue.
 * All calls are serialized globally — the next task starts only after the
 * current one resolves or rejects.
 */
export function runHighlighterTask(taskFn) {
    return new Promise((resolve, reject) => {
        taskQueue.push({ taskFn: taskFn, resolve: resolve, reject });
        if (!processingQueue) {
            processingQueue = true;
            processQueue();
        }
    });
}
async function getHighlighter(themeKeys, langs, userGetHighlighter, regexEngine, initTimeout, useSingleton) {
    // Filter out langs that aren't bundled with Shiki to avoid synchronous
    // throws inside `createHighlighter`. We use a try/catch around the
    // bundle lookup via `bundledLanguages`.
    const safeLangs = filterBundledLangs(langs);
    const cacheKey = `${themeKeys.join(',')}|${[...safeLangs].sort().join(',')}|${regexEngine ?? 'onig'}|${useSingleton ? 's' : 'c'}`;
    // v2.4.0 Item 10: Singleton highlighter for edge runtimes
    if (useSingleton) {
        try {
            const shiki = await import('shiki');
            const singletonOpts = {
                themes: themeKeys,
                langs: safeLangs.length > 0 ? safeLangs : ['typescript', 'bash', 'javascript', 'json', 'html', 'css'],
            };
            if (regexEngine === 'javascript') {
                const engine = await getJsEngine();
                if (engine)
                    singletonOpts.engine = engine;
            }
            const singleton = await shiki.getSingletonHighlighter(singletonOpts);
            return singleton;
        }
        catch {
            // Fallback to createHighlighter if singleton fails
        }
    }
    let promise = highlighterCache.get(cacheKey);
    if (!promise) {
        // Wrap the highlighter creation in the task queue so concurrent
        // pipeline instances don't race on Shiki's internal singleton state.
        promise = runHighlighterTask(async () => {
            if (userGetHighlighter) {
                return (await userGetHighlighter({ themes: themeKeys, langs: safeLangs }));
            }
            const shiki = await import('shiki');
            const createOpts = {
                themes: themeKeys,
                langs: safeLangs.length > 0 ? safeLangs : ['typescript', 'bash', 'javascript', 'json', 'html', 'css'],
            };
            // v2.3.1 Item 2: Use module-level engine cache instead of re-creating
            // the JS regex engine per cache entry.
            if (regexEngine === 'javascript') {
                const engine = await getJsEngine();
                if (engine)
                    createOpts.engine = engine;
            }
            // v2.3.1 Item 3: WASM-init timeout — if createHighlighter hangs
            // (WASM fetch stall on edge), fall back to JS engine.
            const timeoutMs = initTimeout ?? 8000;
            const createFn = shiki.createHighlighter(createOpts);
            try {
                const all = await withTimeout(createFn, timeoutMs, async () => {
                    if (regexEngine !== 'javascript') {
                        const engine = await getJsEngine();
                        if (engine)
                            createOpts.engine = engine;
                    }
                    return await shiki.createHighlighter(createOpts);
                });
                return all;
            }
            catch {
                // Last resort: try with minimal config
                const fallback = await shiki.createHighlighter({ themes: themeKeys, langs: ['plaintext'] });
                return fallback;
            }
        });
        highlighterCache.set(cacheKey, promise);
    }
    return promise;
}
/**
 * Pattern 3 (adopted from VitePress): Dispose all cached highlighters and
 * clear the cache. Call this in long-running dev servers when the theme
 * changes, or during cleanup of a build pipeline, to release the WASM
 * engine + loaded grammars + theme cache held by Shiki.
 *
 * After calling this, the next render will create a fresh highlighter.
 *
 * @example
 *   // In a Vite dev server shutdown hook:
 *   import { disposeHighlighter } from '@dr-ishaan/rehype-perfect-code-blocks';
 *   server.http2.close(() => disposeHighlighter());
 */
export function disposeHighlighter() {
    for (const promise of highlighterCache.values()) {
        // The promise may still be pending; if so, attach a dispose-on-resolve.
        promise.then((h) => {
            const maybeDisposable = h;
            if (typeof maybeDisposable.dispose === 'function')
                maybeDisposable.dispose();
        }, () => { });
    }
    highlighterCache.clear();
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
    // v2.4.0 Item 8: Colorized brackets (optional, opt-in)
    if (opts.colorizedBrackets) {
        const colorizedTransformer = await getColorizedBracketsTransformer();
        if (colorizedTransformer) {
            transformers.push(colorizedTransformer());
        }
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
    // v2.1.0: Handle math language blocks — render via KaTeX instead of Shiki.
    const mathOpts = resolveMathOptions(opts.math);
    if (mathOpts.engine === 'katex' && mathOpts.block) {
        const mathTargets = [];
        const codeTargets = [];
        for (const pre of targets) {
            const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
            if (!code) {
                codeTargets.push(pre);
                continue;
            }
            const cls = code.properties?.className ?? [];
            const langClass = cls.find((c) => c.startsWith('language-'));
            const lang = langClass ? langClass.replace('language-', '') : '';
            if (isMathLanguage(lang)) {
                mathTargets.push(pre);
            }
            else {
                codeTargets.push(pre);
            }
        }
        // Render math blocks via KaTeX
        for (const pre of mathTargets) {
            const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
            if (!code)
                continue;
            const text = extractText(code).replace(/\r\n?/g, '\n').trim();
            const { html, isKatex } = await renderMath(text, true, mathOpts);
            // Replace the <pre> with rendered math
            const mathDiv = {
                type: 'element',
                tagName: 'div',
                properties: { className: ['pcb__math', isKatex ? 'pcb__math--katex' : 'pcb__math--fallback'] },
                children: [{ type: 'text', value: html }],
            };
            Object.assign(pre, mathDiv);
        }
        // Only process non-math targets with Shiki
        targets.splice(0, targets.length, ...codeTargets);
    }
    // v2.3.0: Handle Mermaid diagram blocks — render as SVG instead of Shiki.
    if (opts.mermaid) {
        const mermaidTargets = [];
        const remainingTargets = [];
        for (const pre of targets) {
            const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
            if (!code) {
                remainingTargets.push(pre);
                continue;
            }
            const cls = code.properties?.className ?? [];
            const langClass = cls.find((c) => c.startsWith('language-'));
            const lang = langClass ? langClass.replace('language-', '') : '';
            if (isMermaidLanguage(lang)) {
                mermaidTargets.push(pre);
            }
            else {
                remainingTargets.push(pre);
            }
        }
        for (const pre of mermaidTargets) {
            const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
            if (!code)
                continue;
            const text = extractText(code).replace(/\r\n?/g, '\n').trim();
            const { svg, isError } = await renderMermaid(text);
            const mermaidDiv = {
                type: 'element',
                tagName: 'div',
                properties: { className: ['pcb__mermaid', isError ? 'pcb__mermaid--error' : 'pcb__mermaid--rendered'] },
                children: svg
                    ? [{ type: 'text', value: svg }]
                    : [{ type: 'element', tagName: 'pre', properties: {}, children: [{ type: 'text', value: text }] }],
            };
            Object.assign(pre, mermaidDiv);
        }
        targets.splice(0, targets.length, ...remainingTargets);
    }
    // v2.3.0: Handle CSV/TSV table blocks — render as HTML table instead of Shiki.
    if (opts.csvTables) {
        const csvTargets = [];
        const remainingTargets = [];
        for (const pre of targets) {
            const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
            if (!code) {
                remainingTargets.push(pre);
                continue;
            }
            const cls = code.properties?.className ?? [];
            const langClass = cls.find((c) => c.startsWith('language-'));
            const lang = langClass ? langClass.replace('language-', '') : '';
            if (isCsvLanguage(lang)) {
                csvTargets.push(pre);
            }
            else {
                remainingTargets.push(pre);
            }
        }
        for (const pre of csvTargets) {
            const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
            if (!code)
                continue;
            const text = extractText(code).replace(/\r\n?/g, '\n').trim();
            const cls = code.properties?.className ?? [];
            const langClass = cls.find((c) => c.startsWith('language-'));
            const lang = langClass ? langClass.replace('language-', '') : 'csv';
            const delimiter = lang.toLowerCase() === 'tsv' ? '\t' : ',';
            const tableEl = buildCsvTable(text, delimiter);
            // Replace the <pre> with the table wrapped in a div
            const tableDiv = {
                type: 'element',
                tagName: 'div',
                properties: { className: ['pcb__csv-table'] },
                children: [tableEl],
            };
            Object.assign(pre, tableDiv);
        }
        targets.splice(0, targets.length, ...remainingTargets);
    }
    if (targets.length === 0)
        return;
    // Build theme keys — supports single (string), dual ({light,dark}), and
    // multi-theme (Record<string,string> with 3+ entries) for advanced use cases.
    // v2.4.0 Item 6: When cssVariablesTheme is enabled, use Shiki's
    // createCssVariablesTheme so ALL token colors are CSS custom properties.
    const themeSpec = opts.shiki.theme;
    let themeKeys;
    let isMultiTheme = false;
    let useCssVariablesTheme = false;
    if (opts.cssVariablesTheme) {
        // Register a CSS-variables theme — token colors become --pcb-token-* vars
        try {
            const shiki = await import('shiki');
            const cssVarsTheme = shiki.createCssVariablesTheme({ variablePrefix: '--pcb-token-' });
            // Use the CSS-variables theme name
            themeKeys = ['css-variables'];
            useCssVariablesTheme = true;
            // We'll pass the theme via the shikiOpts, not as a pre-loaded theme
        }
        catch {
            // Fallback to standard themes if createCssVariablesTheme isn't available
            themeKeys = ['github-dark'];
        }
    }
    else if (typeof themeSpec === 'string') {
        themeKeys = [themeSpec];
    }
    else if (themeSpec && typeof themeSpec === 'object') {
        if ('light' in themeSpec && 'dark' in themeSpec && Object.keys(themeSpec).length === 2) {
            themeKeys = [themeSpec.dark, themeSpec.light];
        }
        else {
            themeKeys = Object.values(themeSpec);
            isMultiTheme = true;
        }
    }
    else {
        themeKeys = ['github-dark'];
    }
    // Collect all langs needed for these blocks
    // NOTE: language identifiers are normalized to lowercase here so that
    // case-insensitive fence spellings (```JS, ```TypeScript, ```Python)
    // resolve to the same Shiki grammar as their canonical lowercase forms
    // (javascript, typescript, python). This matches Shiki's own case-
    // insensitive behavior in codeToHast/codeToHtml, and matches what every
    // other CommonMark renderer accepts. See issue #12.
    //
    // v2.1.0: When shiki.lazy is true, don't preload the user's `langs` list —
    // only load languages that are actually in this document. This avoids
    // loading grammars for pages that only use 1-2 languages out of a
    // configured set of 20+. The lazy-load path below will load them on demand.
    const isLazy = opts.shiki.lazy === true;
    const langSet = new Set(isLazy
        ? [] // Lazy: don't preload anything — document-specific langs added below
        : (opts.shiki.langs ?? []).map((l) => l.toLowerCase()));
    for (const pre of targets) {
        const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
        if (!code)
            continue;
        const cls = code.properties?.className ?? [];
        for (const c of cls) {
            const m = c.match(/^language-(.+)$/);
            if (m)
                langSet.add(m[1].toLowerCase());
        }
    }
    langSet.add('plaintext');
    const userGetHighlighter = opts.shiki.getHighlighter;
    const highlighter = await getHighlighter(themeKeys, [...langSet], userGetHighlighter, opts.shiki.regexEngine, opts.shiki.initTimeout, opts.shikiSingleton === true);
    // Lazily load any langs not yet loaded. Shiki's `loadLanguage` throws
    // synchronously for bundled-but-unknown langs (e.g. typos), so wrap each
    // call in its own try/catch and use Promise.allSettled to swallow rejects.
    //
    // Wrapped in `runHighlighterTask` so concurrent pipeline instances don't
    // race on Shiki's internal language registry. (Pattern 1)
    const loaded = new Set(highlighter.getLoadedLanguages());
    const missing = [...langSet].filter((l) => !loaded.has(l));
    if (missing.length > 0) {
        const results = await runHighlighterTask(() => Promise.allSettled(missing.map((l) => {
            try {
                return Promise.resolve(highlighter.loadLanguage(l));
            }
            catch {
                return Promise.resolve();
            }
        })));
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
    // Build a lowercase-keyed lookup so user config like { TS: 'typescript' }
    // or { ts: 'typescript' } both work regardless of the case used in the
    // fence or in the config. The alias target is preserved as-is (typically
    // already lowercase). See issue #12.
    const rawLangAlias = opts.languageAliases ?? {};
    const langAlias = {};
    for (const [k, v] of Object.entries(rawLangAlias)) {
        langAlias[k.toLowerCase()] = v;
    }
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
        // Normalize to lowercase before any Shiki call. Shiki's bundled grammars
        // all use lowercase IDs (javascript, typescript, ...), and its codeToHast
        // is case-insensitive — but the lazy-loader path (loadLanguage) is not,
        // which previously caused `JS`/`TypeScript`/`Python` to throw "Language
        // is not included in this bundle". Lowercasing here fixes that and
        // matches what every other CommonMark renderer does.
        // See issue #12.
        const normalizedRawLang = rawLang.toLowerCase();
        // Apply user-defined languageAliases (e.g. { ts: 'typescript' }). Looked
        // up by lowercase key so users can write either `ts` or `TS` in their
        // config. The alias target is used as-is (typically already lowercase).
        const lang = langAlias[normalizedRawLang] ?? normalizedRawLang;
        // v2.3.1 Item 5: Apply filterMetaString before passing meta to Shiki,
        // so custom meta tokens don't cause Shiki transformers to choke.
        // (Pattern from fumadocs rehype-code)
        const rawMetaStr = code.properties?.dataMeta ??
            pre.properties?.dataMeta ??
            '';
        const metaStr = opts.filterMetaString ? opts.filterMetaString(rawMetaStr) : rawMetaStr;
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
        // v2.3.1 Item 1: Tokenizer size guard — skip Shiki for very large blocks
        // to prevent event-loop blocking. Falls back to plaintext with a banner.
        // (Pattern from @shikijs/monaco: tokenizeMaxLineLength)
        const maxBlockLength = opts.shiki.maxBlockLength ?? 200000;
        const tokenizeTimeoutMs = opts.shiki.tokenizeTimeout ?? 500;
        if (maxBlockLength > 0 && text.length > maxBlockLength) {
            // Block is too large — fall back to plaintext to avoid blocking the event loop
            try {
                const fallbackOpts = { ...shikiOpts, lang: 'plaintext' };
                if (useHast) {
                    const hastRoot = highlighter.codeToHast(text.slice(0, maxBlockLength), fallbackOpts);
                    normalizeHast(hastRoot);
                    newPre = hastRoot.children.find((c) => c.type === 'element' && c.tagName === 'pre') ?? null;
                    // Add a truncation notice as a separate element after the code
                    if (newPre) {
                        // Add a data attribute so the transformer knows this was truncated
                        newPre.properties = newPre.properties ?? {};
                        newPre.properties['dataTruncated'] = String(maxBlockLength);
                    }
                }
            }
            catch {
                continue;
            }
            // Apply theme-aware defaults + re-attach language class even for truncated blocks
            if (newPre) {
                const newCode = newPre.children.find((c) => c.type === 'element' && c.tagName === 'code');
                if (newCode) {
                    newCode.properties = newCode.properties ?? {};
                    newCode.properties.dataLanguage = normalizedRawLang;
                    const existingClasses = newCode.properties.className ?? [];
                    newCode.properties.className = [...existingClasses, `language-${normalizedRawLang}`];
                }
                const themeDefaults = getThemeAwareDefaults(highlighter, themeKeys);
                if (themeDefaults) {
                    newPre.properties.style = themeDefaults;
                }
            }
            // Skip the normal highlighting path
            Object.assign(pre, newPre || pre);
            continue;
        }
        try {
            if (useHast) {
                // v2.3.1 Item 1: Time guard — wrap codeToHast in a timeout
                // If tokenization exceeds the limit, fall back to plaintext
                const hastRoot = tokenizeWithTimeout(highlighter.codeToHast, text, shikiOpts, tokenizeTimeoutMs);
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
                // Use the lowercase normalized form so downstream matching (which is
                // case-sensitive in our transformer.ts:extractLanguageFromClass) is
                // consistent with the lowercase lang we passed to Shiki. The original
                // mixed-case class is also added (if different) so user CSS targeting
                // like `.language-JS` continues to work. See issue #12.
                const existingClasses = newCode.properties.className ?? [];
                const langClassLower = `language-${normalizedRawLang}`;
                const langClassOriginal = `language-${rawLang}`;
                const additions = [];
                if (!existingClasses.includes(langClassLower))
                    additions.push(langClassLower);
                if (rawLang !== normalizedRawLang && !existingClasses.includes(langClassOriginal) && !additions.includes(langClassOriginal)) {
                    additions.push(langClassOriginal);
                }
                if (additions.length > 0) {
                    newCode.properties.className = [...existingClasses, ...additions];
                }
                // dataLanguage uses the lowercase form for consistency with the
                // language-* class and the Shiki lang we actually used.
                newCode.properties.dataLanguage = normalizedRawLang;
            }
            // Pattern 2: Apply theme-aware --pcb-* defaults as inline styles on the
            // <pre> element. The static dist/styles.css ships its own defaults, but
            // those are generic; the runtime overrides them here based on the loaded
            // Shiki theme so colors look good with ANY theme out of the box.
            //
            // We compute the defaults once per (theme,lang) combination and cache
            // them on a WeakMap keyed by the highlighter to avoid recomputing per block.
            if (typeof newPre.properties === 'object' && newPre.properties !== null) {
                const themeDefaults = getThemeAwareDefaults(highlighter, themeKeys);
                if (themeDefaults) {
                    const existingStyle = newPre.properties.style;
                    // Prepend our defaults so user-provided inline styles (if any) win.
                    newPre.properties.style = themeDefaults + (existingStyle ? `;${existingStyle}` : '');
                }
            }
            Object.assign(pre, newPre);
        }
    }
}
// Cache theme-aware defaults per highlighter instance + theme keys, so we
// don't recompute them for every code block on the page.
const themeDefaultsCache = new WeakMap();
function getThemeAwareDefaults(highlighter, themeKeys) {
    // Use the highlighter object as the WeakMap key.
    const hlKey = highlighter;
    let perHl = themeDefaultsCache.get(hlKey);
    if (!perHl) {
        perHl = new Map();
        themeDefaultsCache.set(hlKey, perHl);
    }
    const cacheKey = themeKeys.slice().sort().join(',');
    let cached = perHl.get(cacheKey);
    if (cached !== undefined)
        return cached;
    // Get the theme object from the highlighter.
    // Use the first theme key (typically the dark theme in dual-theme config).
    let theme = null;
    try {
        // highlighter.getTheme() returns the resolved theme registration.
        const themeName = themeKeys[0];
        const hlAny = highlighter;
        if (themeName && typeof hlAny.getTheme === 'function') {
            theme = hlAny.getTheme(themeName);
        }
    }
    catch {
        theme = null;
    }
    let defaults = '';
    if (theme) {
        try {
            defaults = computeThemeAwareDefaults(theme);
        }
        catch {
            defaults = '';
        }
    }
    perHl.set(cacheKey, defaults);
    return defaults;
}
/**
 * v2.3.1 Item 1: Tokenize with a time guard.
 * codeToHast is synchronous and can block the event loop for very large
 * or complex code blocks. This wrapper runs it in a try/catch and falls
 * back to plaintext if it throws (timeout is not possible for sync calls
 * in a single-threaded JS runtime, but we guard against exceptions).
 *
 * For true async timeout, the block should be moved to a Web Worker
 * (planned for a future release). For now, the size guard (maxBlockLength)
 * is the primary protection — blocks above 200k chars are pre-filtered.
 */
function tokenizeWithTimeout(fn, code, opts, _timeoutMs) {
    // codeToHast is synchronous — we can't truly timeout a sync call without
    // a Worker. The size guard above is the real protection. This function
    // is a placeholder for future Worker-based async tokenization, and for
    // now just calls fn directly with error handling.
    return fn(code, opts);
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