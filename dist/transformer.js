/**
 * hast tree walker that transforms every highlighted `<pre>` into a
 * styled `<figure class="pcb">` with optional header bar, gutter,
 * line states, copy button, captions, and more.
 *
 * Key design decisions (learned from rehype-pretty-code + VitePress + EC):
 *   1. Map Shiki's notation classes (diff add/remove, focused, highlighted,
 *      error, warning) onto our own pcb__line--* classes when wrapping.
 *   2. Strip Shiki's `class="shiki xxx"` and inline `style="background-color:..."`
 *      from <pre> when keepBackground === false (our default).
 *   3. Honor lineNumbersStart, caption, data-language, data-theme attrs.
 *   4. Auto-switch to terminal preset for sh/bash/zsh/etc.
 *   5. Extract filename from first-line comment when extractFileNameFromCode === true.
 *   6. Call visitor hooks (onVisitLine, onVisitHighlightedLine, etc.).
 *   7. Apply filterMetaString before parsing.
 *   8. Emit data-line-numbers-max-digits for CSS-driven gutter sizing.
 *   9. Configurable copy button (hover mode, custom icons, custom duration).
 *  10. Emit data-* attributes alongside pcb__ classes for rehype-pretty-code CSS interop.
 */
import { visit } from 'unist-util-visit';
import { parseMeta } from './meta.js';
import { wordDiff, hasChanges } from './word-diff.js';
/** Default inline SVG copy icon (16x16 GitHub octicon copy). */
const DEFAULT_COPY_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`;
const DEFAULT_SUCCESS_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`;
/** Inline SVG icon for the copy button — built as a proper hast tree. */
function copyIconElement(customSvg) {
    const svg = customSvg ?? DEFAULT_COPY_ICON;
    return parseInlineHtml(svg);
}
/** Three-dot decoration — built as a proper hast tree. */
function dotsElement() {
    return {
        type: 'element',
        tagName: 'span',
        properties: { className: ['pcb__dots'], ariaHidden: true },
        children: [
            { type: 'element', tagName: 'span', properties: {}, children: [] },
            { type: 'element', tagName: 'span', properties: {}, children: [] },
            { type: 'element', tagName: 'span', properties: {}, children: [] },
        ],
    };
}
/**
 * Naive inline-HTML parser for tiny SVG/HTML snippets used as ornaments.
 *
 * SECURITY: This function is intended ONLY for developer-supplied static SVG
 * strings (e.g. `copyButton.copyIcon`). It does NOT sanitize user input. If
 * the input contains `<script>` tags or `on*` event handler attributes, they
 * will be passed through to the DOM. Callers MUST ensure the input is trusted.
 *
 * We do a basic allowlist check here to reject obviously dangerous patterns
 * (defense in depth), but this is NOT a full sanitizer.
 */
const DANGEROUS_HTML_PATTERNS = [
    /<script\b/i,
    /\son\w+\s*=/i, // onerror=, onclick=, etc.
    /javascript:/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
];
/**
 * Defense-in-depth check: returns `true` if the supplied HTML string is free
 * of obviously dangerous patterns (`<script>`, `on*=` handlers, `javascript:`
 * URLs, `<iframe>`, `<object>`, `<embed>`).
 *
 * Used by `buildCopyButton()` to gate both `copyIcon` (which becomes a hast
 * subtree via `parseInlineHtml`) and `successIcon` (which is stored verbatim
 * as a `data-success-icon` attribute and later innerHTML'd by the client
 * copy-script). Without this check, `successIcon` would be a latent XSS sink.
 *
 * This is NOT a full HTML sanitizer. Callers MUST still ensure the input is
 * developer-trusted. The check exists to fail-closed when dangerous patterns
 * are detected, not to make untrusted input safe.
 */
export function isSafeInlineHtml(html) {
    if (!html)
        return true;
    for (const pattern of DANGEROUS_HTML_PATTERNS) {
        if (pattern.test(html))
            return false;
    }
    return true;
}
function parseInlineHtml(html) {
    // Defense-in-depth: reject obviously dangerous patterns.
    for (const pattern of DANGEROUS_HTML_PATTERNS) {
        if (pattern.test(html)) {
            // Refuse to parse — return an empty span instead of risking XSS.
            return { type: 'element', tagName: 'span', properties: {}, children: [] };
        }
    }
    // For our use case (single <svg>...</svg> or single <span>...</span>), we
    // build the hast tree manually to avoid pulling in hast-util-from-html for
    // every icon. We support <svg>...</svg> with <path/> children.
    const m = html.match(/^<(\w+)([^>]*)>([\s\S]*)<\/\1>$/);
    if (!m) {
        return { type: 'element', tagName: 'span', properties: {}, children: [{ type: 'text', value: html }] };
    }
    const [, tag, attrsStr, inner] = m;
    const props = parseAttrs(attrsStr);
    const children = [];
    // Parse inner self-closing tags like <path d="..."/>
    const re = /<(\w+)([^>]*)\/>/g;
    let cm;
    while ((cm = re.exec(inner)) !== null) {
        children.push({
            type: 'element',
            tagName: cm[1],
            properties: parseAttrs(cm[2]),
            children: [],
        });
    }
    if (children.length === 0) {
        // No self-closing tags — treat inner as text content.
        const text = inner.replace(/<[^>]+>/g, '').trim();
        if (text)
            children.push({ type: 'text', value: text });
    }
    return { type: 'element', tagName: tag, properties: props, children };
}
function parseAttrs(s) {
    const props = {};
    // Match key="value" pairs first.
    const re = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(s)) !== null) {
        const key = m[1];
        const val = m[2];
        const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (key === 'class') {
            props.className = val.split(/\s+/);
        }
        else {
            props[camelKey] = val;
        }
    }
    // Now strip all quoted key="value" pairs from the string so the bare-attribute
    // regex doesn't accidentally match digits/words inside quoted values.
    const stripped = s.replace(/\w[\w-]*\s*=\s*"[^"]*"/g, '');
    // Bare boolean attributes (e.g. `aria-hidden` without ="")
    const bareRe = /(?:^|\s)(\w[\w-]*)(?=\s|$)/g;
    let bm;
    while ((bm = bareRe.exec(stripped)) !== null) {
        const key = bm[1];
        if (props[key] === undefined) {
            const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            props[camelKey] = true;
        }
    }
    return props;
}
/** Default magic comments (Docusaurus-style). */
const DEFAULT_MAGIC_COMMENTS = [
    {
        className: 'pcb__line--hl',
        line: 'highlight-next-line',
        block: { start: 'highlight-start', end: 'highlight-end' },
    },
];
const DEFAULT_TERMINAL_LANGS = ['sh', 'bash', 'zsh', 'shell', 'console', 'powershell', 'bat', 'cmd', 'fish', 'ansi'];
export function rehypePerfectCodeBlocks(userOptions = {}) {
    const { shiki: userShiki, ...rest } = userOptions;
    const options = {
        decorations: true,
        showLanguage: true,
        copyButton: true,
        copyButtonLabel: 'copy',
        copyButtonDoneLabel: 'copied!',
        lineNumbers: 'auto',
        titleBar: 'auto',
        lineNumbersStart: 1,
        highlight: true,
        diff: true,
        wordDiff: false,
        focus: true,
        errorLevels: true,
        wrap: false,
        collapseAfter: null,
        collapseRanges: null,
        collapseStyle: 'github',
        showWhitespace: false,
        indentGuides: false,
        caption: true,
        engine: 'auto',
        shiki: {
            theme: { light: 'github-light', dark: 'github-dark' },
            langs: [],
            transformers: [],
            transformerOrder: 'after',
            ...(userShiki ?? {}),
        },
        keepBackground: false,
        styleToClass: false,
        useHastApi: true,
        disableAutoTransformers: false,
        removeComments: false,
        removeLineBreaks: false,
        zeroIndexed: false,
        lineOptions: [],
        customNotations: {},
        magicComments: DEFAULT_MAGIC_COMMENTS,
        inlineCode: false,
        inlineDefaultLang: '',
        defaultInlineLang: '',
        tokensMap: {},
        terminalLangs: DEFAULT_TERMINAL_LANGS,
        extractFileNameFromCode: false,
        languageLabels: {},
        languageAliases: {},
        defaultBlockLang: '',
        tabWidth: 0,
        copyStripComments: true,
        accessibleScroll: true,
        announceCopy: true,
        hideCopyWithoutJs: true,
        terminalSrOnlyTitle: true,
        rehypePlugins: [],
        filterMetaString: (s) => s,
        onVisitLine: () => { },
        onVisitHighlightedLine: () => { },
        onVisitHighlightedChars: () => { },
        onVisitTitle: () => { },
        onVisitCaption: () => { },
        texts: {},
        logger: console,
        cspNonce: '',
        preset: 'default',
        injectStyles: true,
        theme: 'auto',
        cssInjection: 'inline',
        cssLayer: 'pcb',
        tokens: undefined,
        darkMode: undefined,
        scope: undefined,
        math: undefined,
        devWarnings: process.env.NODE_ENV !== 'production',
        // v2.2.0: Phase 3
        diffMode: 'unified',
        annotations: false,
        attribution: false,
        inline: false,
        ...rest,
    };
    return async (tree) => {
        const visits = [];
        const inlineCodes = [];
        visit(tree, 'element', (node) => {
            if (node.tagName !== 'pre')
                return;
            if (node.properties?.dataPcbDone)
                return;
            const codeChild = node.children.find((c) => c.type === 'element' && c.tagName === 'code');
            if (!codeChild)
                return;
            visits.push(node);
        });
        // Inline code highlighting: visit <code> elements whose parent is NOT <pre>.
        // These are inline code spans like `code{:lang}` or `code{:.token}`.
        if (options.inlineCode) {
            visit(tree, 'element', (node, index, parent) => {
                if (node.tagName !== 'code')
                    return;
                if (!parent || parent.type !== 'element' || parent.tagName === 'pre')
                    return;
                if (node.properties?.dataPcbDone)
                    return;
                inlineCodes.push(node);
            });
        }
        for (const pre of visits) {
            const replacement = await transformPre(pre, options);
            if (replacement) {
                Object.assign(pre, replacement);
            }
        }
        // Process inline code blocks (after the block-level transform).
        for (const code of inlineCodes) {
            transformInlineCode(code, options);
        }
    };
}
/**
 * Transform an inline `<code>` element (not inside a `<pre>`).
 *
 * Supports two modes (matching rehype-pretty-code's syntax):
 *   - `inlineCode: 'lang'` or `true` — parse `code{:lang}` suffix and tokenize via Shiki
 *   - `inlineCode: 'token'` — parse `code{:.token}` suffix and color by VS Code token
 *
 * The suffix is stripped from the displayed text. The resulting tokenized
 * spans are wrapped in a `<code class="pcb__inline">` element.
 *
 * NOTE: This function only modifies the inline `<code>` element's children
 * and adds a class. Shiki tokenization happens at render time via the
 * `engine: 'shiki'` path (runShikiOnRawBlocks handles `<pre><code>` only —
 * inline code is styled by the CSS based on the `pcb__inline` class).
 */
function transformInlineCode(code, opts) {
    // Extract the text content.
    const text = extractText(code);
    if (!text)
        return;
    // Parse the `{:lang}` or `{:.token}` suffix.
    // rehype-pretty-code uses `{:lang}` for language and `{:.token}` for token.
    const langMatch = text.match(/\{:([a-zA-Z][\w.-]*)\}$/);
    const tokenMatch = text.match(/\{:\.([\w-]+)\}$/);
    let displayText = text;
    let lang = null;
    let token = null;
    if (opts.inlineCode === 'token' && tokenMatch) {
        token = tokenMatch[1];
        displayText = text.slice(0, tokenMatch.index);
    }
    else if (opts.inlineCode === true || opts.inlineCode === 'lang') {
        if (langMatch) {
            lang = langMatch[1];
            displayText = text.slice(0, langMatch.index);
        }
        else if (opts.inlineDefaultLang || opts.defaultInlineLang) {
            lang = opts.inlineDefaultLang || opts.defaultInlineLang || null;
        }
    }
    // Replace the text content with the stripped display text.
    code.children = [{ type: 'text', value: displayText }];
    // Add the `pcb__inline` class plus optional lang/token classes for CSS.
    const cls = ['pcb__inline'];
    if (lang)
        cls.push(`pcb__inline--${lang}`);
    if (token)
        cls.push(`pcb__inline--token-${token}`);
    code.properties = code.properties ?? {};
    code.properties.className = cls;
    // Mark as done so we don't re-process it.
    code.properties.dataPcbDone = true;
}
async function transformPre(pre, opts) {
    const codeChild = pre.children.find((c) => c.type === 'element' && c.tagName === 'code');
    if (!codeChild)
        return null;
    // Apply filterMetaString hook before parsing.
    let metaStr = codeChild.properties?.dataMeta ??
        pre.properties?.dataMeta ??
        pre.properties?.meta ??
        '';
    metaStr = opts.filterMetaString(metaStr);
    const meta = parseMeta(metaStr);
    // Detect language from class + data attribute.
    const className = pre.properties?.className ??
        codeChild.properties?.className ?? '';
    const langFromClasses = extractLanguageFromClass(className);
    const langFromDataAttr = codeChild.properties?.dataLanguage ?? null;
    let language = meta.language ?? langFromClasses ?? langFromDataAttr;
    // Apply defaultBlockLang if no language is detected.
    if (!language && opts.defaultBlockLang) {
        language = opts.defaultBlockLang;
    }
    const effectiveLang = language && !['plaintext', 'text', 'txt', ''].includes(language) ? language : null;
    // Resolve the display label for the language badge (e.g. "ts" → "TypeScript").
    const languageLabel = effectiveLang
        ? (opts.languageLabels?.[effectiveLang] ?? effectiveLang)
        : null;
    // Optional: extract filename from first-line comment.
    let title = meta.title;
    let linesToRemoveFromTop = 0;
    if (opts.extractFileNameFromCode && !title) {
        const firstLine = getFirstLineText(codeChild);
        const m = firstLine?.match(/^\s*(?:\/\/|#|<!--|\/\*)\s*([\w./\\-]+\.\w+)\s*(?:-->|\*\/)?\s*$/);
        if (m) {
            title = m[1];
            linesToRemoveFromTop = 1;
        }
    }
    // Resolve per-block flags.
    // Coerce copyButton (which may be a config object) to a boolean for the
    // ResolvedBlock summary — the full config object is read separately by
    // buildCopyButton().
    const copyButtonEnabled = typeof opts.copyButton === 'object' ? true : !!opts.copyButton;
    const autoTitleBar = !!(title || effectiveLang || copyButtonEnabled);
    // Distinguish whole-block collapse (collapseAfter threshold or `collapse` flag)
    // from per-line collapse (collapseRanges from `collapse="N-M"` meta).
    // Per-line collapse uses <details> sections INSIDE the <pre>, not around it.
    const hasCollapseRanges = !!(meta.collapseRanges && meta.collapseRanges.length > 0);
    const wholeBlockCollapse = !hasCollapseRanges && (meta.flags.collapse ?? (opts.collapseAfter != null ? shouldCollapse(pre, opts.collapseAfter) : false));
    const resolved = {
        language: effectiveLang,
        title,
        caption: meta.caption,
        highlight: opts.highlight ? meta.highlight ?? [] : [],
        wrap: meta.flags.wrap ?? opts.wrap,
        lineNumbers: resolveFlag(meta.flags.lineNumbers, opts.lineNumbers, !!title),
        lineNumbersStart: meta.lineNumbersStart ?? opts.lineNumbersStart,
        titleBar: resolveFlag(meta.flags.titleBar, opts.titleBar, autoTitleBar),
        decorations: meta.flags.decorations ?? opts.decorations,
        showLanguage: meta.flags.showLanguage ?? opts.showLanguage,
        copyButton: meta.flags.copyButton ?? copyButtonEnabled,
        collapse: wholeBlockCollapse,
    };
    // Auto-detect terminal preset based on language.
    let presetClass = opts.preset;
    if (presetClass === 'default' && effectiveLang && opts.terminalLangs.includes(effectiveLang)) {
        presetClass = 'terminal';
    }
    // Apply magic comments → mark lines before splitting.
    applyMagicComments(codeChild, opts.magicComments, opts.customNotations);
    // Remove the first line if it was a filename comment we extracted.
    if (linesToRemoveFromTop > 0) {
        removeFirstLine(codeChild);
    }
    // Build line spans. Each line is a <span class="pcb__line"> containing
    // an optional <span class="pcb__ln"> (gutter number) and a
    // <span class="pcb__code"> (the code content). This row-based structure
    // lets line-state backgrounds (highlight, diff, etc.) span BOTH the
    // gutter and the code, and lets the accent bar sit on the gutter cell
    // (never overlapping code text).
    const lineSpans = toLineSpans(codeChild, resolved, opts);
    // Filter out trailing empty line (from trailing newline in source).
    const filteredLines = filterTrailingEmpty(lineSpans);
    // Pattern 5 (selective adoption from expressive-code): word-level diff.
    // When `wordDiff` is enabled and `diff` is also true, scan for adjacent
    // `pcb__line--del` / `pcb__line--add` pairs and wrap the changed words
    // in `<mark class="pcb__word-diff--del">` / `<mark class="pcb__word-diff--add">`
    // elements so readers can see exactly what changed within each diff line.
    const linesForCollapse = opts.wordDiff && opts.diff
        ? applyWordDiff(filteredLines)
        : filteredLines;
    // Apply per-line collapsible sections (meta `collapse="5-12,20-30"`).
    // Wraps matching line ranges in <details><summary>N collapsed lines</summary>...</details>.
    const collapsedLines = wrapCollapsedSections(linesForCollapse, meta, opts, resolved.lineNumbersStart);
    // Call onVisitLine / onVisitHighlightedLine hooks.
    filteredLines.forEach((line, i) => {
        const lineNumber = i + resolved.lineNumbersStart;
        const isHl = line.properties?.className?.includes('pcb__line--hl');
        opts.onVisitLine({ element: line, lineNumber });
        if (isHl) {
            opts.onVisitHighlightedLine({ element: line, lineNumber });
        }
    });
    // data-line-numbers-max-digits attribute on <code> for CSS-driven gutter sizing.
    // Uses filteredLines.length (not collapsedLines) because collapsed sections
    // contain the same total number of logical lines — we just want the max
    // gutter number's digit count.
    const maxDigits = String(filteredLines.length + resolved.lineNumbersStart - 1).length;
    const codeDataProps = {
        dataLineNumbersMaxDigits: String(maxDigits),
    };
    if (effectiveLang) {
        codeDataProps.dataLanguage = effectiveLang;
    }
    // Mark whether line numbers are present so CSS can switch grid on/off.
    if (resolved.lineNumbers) {
        codeDataProps.dataLineNumbers = '';
    }
    // Collect body-level `has-*` classes (e.g. `has-diff`, `has-focused`,
    // `has-highlighted`) from the line spans. These were previously stripped —
    // restoring them lets CSS target the whole <pre> when any line has a state.
    const preLevelClasses = new Set();
    for (const line of collapsedLines) {
        // Skip <details> wrapper elements — only inspect actual line spans.
        if (line.tagName !== 'span')
            continue;
        const lineClasses = line.properties?.className ?? [];
        if (lineClasses.includes('pcb__line--add') || lineClasses.includes('pcb__line--del')) {
            preLevelClasses.add('has-diff');
        }
        if (lineClasses.includes('pcb__line--focus')) {
            preLevelClasses.add('has-focused');
        }
        if (lineClasses.includes('pcb__line--hl')) {
            preLevelClasses.add('has-highlighted');
        }
        if (lineClasses.includes('pcb__line--error') || lineClasses.includes('pcb__line--warning') || lineClasses.includes('pcb__line--info')) {
            preLevelClasses.add('has-error-level');
        }
    }
    // Build code <pre><code> with line spans.
    // When keepBackground is true, preserve Shiki's inline `style` (which includes
    // background-color + color from the theme) on the new <pre>.
    // Pattern 2: Always preserve our theme-aware --pcb-* defaults (set by
    // shiki.ts:getThemeAwareDefaults) even when keepBackground is false —
    // these are NOT Shiki's background/color styles, they're our CSS variable
    // defaults that make the code block legible with any theme.
    const newCode = h('code', codeDataProps, collapsedLines);
    const newPreProps = {};
    if (preLevelClasses.size > 0) {
        newPreProps.className = [...preLevelClasses];
    }
    if (opts.keepBackground && pre.properties?.style) {
        newPreProps.style = pre.properties.style;
    }
    else if (pre.properties?.style) {
        // keepBackground is false — strip Shiki's bg/color inline styles but
        // preserve our --pcb-* defaults (Pattern 2).
        const originalStyle = pre.properties.style;
        const pcbVars = originalStyle
            .split(';')
            .filter((part) => part.trim().startsWith('--pcb-'))
            .join(';');
        if (pcbVars)
            newPreProps.style = pcbVars;
    }
    // Don't carry over Shiki's tabindex — it causes unwanted focus rings on the
    // inner <pre>. The figure itself is not focusable; only the copy button is.
    const newPre = h('pre', newPreProps, [newCode]);
    // Body: scrollable container around <pre>.
    const bodyClasses = ['pcb__body'];
    if (resolved.highlight.length > 0)
        bodyClasses.push('pcb__body--has-hl');
    // Accessibility: mark scrollable region so screen readers announce it (WCAG 4.1.2).
    // Also add tabindex=0 for keyboard scrolling (WCAG 2.1.1).
    const bodyProps = { className: bodyClasses };
    if (opts.accessibleScroll) {
        bodyProps.role = 'region';
        bodyProps.tabIndex = 0;
        // i18n: allow user to override the aria-label prefix.
        const ariaPrefix = opts.texts?.codeBlockAriaPrefix ?? 'Code block';
        // Escape the title/lang for use in an aria-label attribute (defense in depth:
        // prevents any <script> or other HTML from leaking into the attribute).
        const safeLabel = title
            ? `${ariaPrefix}: ${title.replace(/[<>"'&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c] ?? c))}`
            : effectiveLang
                ? `${ariaPrefix}: ${effectiveLang}`
                : ariaPrefix;
        bodyProps.ariaLabel = safeLabel;
    }
    const body = h('div', bodyProps, [newPre]);
    // i18n: screen-reader-only title for terminal preset (improves context).
    const terminalSrText = (presetClass === 'terminal' && !title && opts.terminalSrOnlyTitle !== false)
        ? (opts.texts?.terminalSrOnlyTitle ?? 'Terminal window')
        : null;
    // Header bar.
    // Use <figcaption> when there's no separate caption (more semantic).
    // When both title-bar and caption are present, use <div> for bar and
    // <figcaption> for the caption (matches rehype-pretty-code).
    let bar = null;
    if (resolved.titleBar) {
        const barChildren = [];
        if (resolved.decorations)
            barChildren.push(dotsElement());
        if (terminalSrText) {
            barChildren.push(h('span', { className: ['pcb__sr-only'] }, [hText(terminalSrText)]));
        }
        barChildren.push(h('div', { className: ['pcb__title'] }, title ? [hText(title)] : []));
        if (resolved.showLanguage && resolved.language) {
            barChildren.push(h('div', { className: ['pcb__lang'] }, [hText(languageLabel ?? resolved.language)]));
        }
        if (resolved.copyButton) {
            const btn = buildCopyButton(opts);
            // For terminal preset + copyStripComments, mark the button so the
            // client script knows to strip # comments from the copied text.
            if (presetClass === 'terminal' && opts.copyStripComments !== false) {
                btn.properties.dataStripComments = '';
            }
            barChildren.push(btn);
        }
        // Use figcaption for the bar when there's no separate caption below —
        // this gives the figure an accessible name from the title.
        const barTag = (!opts.caption || !meta.caption) && title ? 'figcaption' : 'div';
        bar = h(barTag, { className: ['pcb__bar'] }, barChildren);
        if (title)
            opts.onVisitTitle(bar);
    }
    // Figure class.
    const figClasses = ['pcb'];
    if (presetClass !== 'default')
        figClasses.push(`pcb--${presetClass}`);
    if (resolved.wrap)
        figClasses.push('pcb--wrap');
    if (resolved.collapse)
        figClasses.push('pcb--collapse');
    // Hover-mode copy button: add marker class to figure.
    if (typeof opts.copyButton === 'object' && opts.copyButton.visibility === 'hover') {
        figClasses.push('pcb--copy-on-hover');
    }
    const figureChildren = [];
    if (resolved.collapse) {
        const summaryChildren = [];
        if (resolved.decorations)
            summaryChildren.push(dotsElement());
        if (terminalSrText) {
            summaryChildren.push(h('span', { className: ['pcb__sr-only'] }, [hText(terminalSrText)]));
        }
        summaryChildren.push(h('span', { className: ['pcb__title'] }, [hText(title ?? 'code')]));
        if (resolved.showLanguage && resolved.language) {
            summaryChildren.push(h('div', { className: ['pcb__lang'] }, [hText(languageLabel ?? resolved.language)]));
        }
        const summary = h('summary', {}, summaryChildren);
        const details = h('details', { className: figClasses, open: false }, [summary, body]);
        return details;
    }
    if (bar)
        figureChildren.push(bar);
    figureChildren.push(body);
    // Caption (rehype-pretty-code style). Only render if globally enabled AND meta present.
    if (opts.caption && meta.caption) {
        const cap = h('figcaption', { className: ['pcb__caption'] }, [hText(meta.caption)]);
        opts.onVisitCaption(cap);
        figureChildren.push(cap);
    }
    // v2.2.0: Attribution footer — render author/year/source as a footer below the code block.
    if (opts.attribution && (meta.author || meta.year || meta.source)) {
        const parts = [];
        if (meta.author)
            parts.push(meta.author);
        if (meta.year)
            parts.push(`(${meta.year})`);
        if (meta.source)
            parts.push(`. ${meta.source}.`);
        else if (meta.author || meta.year)
            parts.push('.');
        const attrText = parts.join(' ').trim();
        if (attrText) {
            figureChildren.push(h('figcaption', { className: ['pcb__attribution'] }, [hText(attrText)]));
        }
    }
    // v2.2.0: Add pcb--split-diff class when diffMode is 'split'
    if (opts.diffMode === 'split') {
        figClasses.push('pcb--split-diff');
    }
    // v2.2.0: Add pcb--annotations class when annotations are enabled
    if (opts.annotations) {
        figClasses.push('pcb--annotations');
    }
    return h('figure', { className: figClasses }, figureChildren);
}
/** Build the copy button based on options (legacy boolean or new object form). */
function buildCopyButton(opts) {
    // i18n: allow user to override default UI strings via `texts` option.
    const texts = opts.texts ?? {};
    const defaultLabel = texts.copyLabel ?? 'copy';
    const defaultDoneLabel = texts.doneLabel ?? 'copied!';
    const defaultAriaLabel = texts.copyAriaLabel ?? 'Copy code';
    let label = defaultLabel;
    let doneLabel = defaultDoneLabel;
    let copyIcon;
    let successIcon;
    let feedbackDuration;
    if (typeof opts.copyButton === 'object') {
        // Use `in` check so `null` is honored (not collapsed to default by `??`).
        if ('label' in opts.copyButton) {
            label = opts.copyButton.label ?? null;
        }
        if ('doneLabel' in opts.copyButton) {
            doneLabel = opts.copyButton.doneLabel ?? defaultDoneLabel;
        }
        copyIcon = opts.copyButton.copyIcon;
        successIcon = opts.copyButton.successIcon;
        feedbackDuration = opts.copyButton.feedbackDuration;
    }
    else if (opts.copyButton === true) {
        // Legacy boolean `copyButton: true`.
        // If user explicitly set copyButtonLabel/copyButtonDoneLabel (deprecated),
        // honor them. Otherwise use the i18n defaults from `texts`.
        // We detect "explicitly set" by checking against the defaults: 'copy' and 'copied!'.
        // (This is a bit of a hack but maintains backward compat.)
        if (opts.copyButtonLabel !== 'copy') {
            label = opts.copyButtonLabel;
        }
        if (opts.copyButtonDoneLabel !== 'copied!') {
            doneLabel = opts.copyButtonDoneLabel;
        }
    }
    // Note: when copyButton=false, buildCopyButton is never called.
    const btnChildren = [copyIconElement(copyIcon)];
    if (label) {
        btnChildren.push(h('span', { className: ['pcb__copy-label'] }, [hText(label)]));
    }
    const btnProps = {
        className: ['pcb__copy'],
        type: 'button',
        ariaLabel: defaultAriaLabel,
        dataDoneLabel: doneLabel,
    };
    // SECURITY: successIcon is stored verbatim as a data-* attribute and later
    // innerHTML'd by the client copy-script, so it MUST pass the same
    // defense-in-depth check as copyIcon. Reject dangerous patterns (issue #2).
    if (successIcon && isSafeInlineHtml(successIcon)) {
        btnProps.dataSuccessIcon = successIcon;
    }
    // Always emit data-feedback-duration so the rendered HTML matches the
    // documented default of 1600ms (issue #8). Previously the attribute was
    // only emitted when explicitly set, causing the rendered HTML to differ
    // from the docs even though the runtime behavior was correct.
    btnProps.dataFeedbackDuration = String(feedbackDuration ?? 1600);
    return h('button', btnProps, btnChildren);
}
/** Apply Docusaurus-style magic comments by transforming them into Shiki notation comments. */
function applyMagicComments(code, magicComments, customNotations) {
    // Convert magic-comment markers to // [!code xxx] notation so the Shiki
    // transformers will pick them up. We do this by walking text nodes inside
    // the code element and replacing e.g. "// highlight-next-line" on line N
    // with "// [!code highlight]" on line N+1.
    const text = extractText(code);
    if (!text)
        return;
    const lines = text.split('\n');
    const markedLines = new Set();
    const markedClasses = new Map();
    // Scan for line/block magic comments.
    const blockStack = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        for (const mc of magicComments) {
            if (mc.line && line.includes(mc.line)) {
                markedLines.add(i + 1); // next line (0-indexed i → next is i+1, 1-indexed)
                markedClasses.set(i + 1, [...(markedClasses.get(i + 1) ?? []), mc.className]);
                // Also mark this line for removal of the comment itself? — leave for now.
            }
            if (mc.block && line.includes(mc.block.start)) {
                blockStack.push({ className: mc.className, startLine: i + 1 });
            }
            if (mc.block && line.includes(mc.block.end) && blockStack.length > 0) {
                const start = blockStack.pop().startLine;
                for (let n = start; n < i; n++) {
                    // Mark lines between start and end (exclusive of the markers themselves).
                    markedLines.add(n);
                    markedClasses.set(n, [...(markedClasses.get(n) ?? []), mc.className]);
                }
            }
        }
    }
    // If we found magic comments, inject [!code xxx] notations into the text
    // so the Shiki transformers (which run later in the pipeline) will see them.
    // BUT — we're running AFTER Shiki here (this is the rehype transformer).
    // So instead, we directly tag the resulting line spans after splitCodeIntoLines.
    // Store the markers on the code element via a private property for toLineSpans to read.
    code.__magicMarkedLines = markedClasses;
    void customNotations; // reserved for future use
}
/** Remove the first line of code (used for filename-comment extraction). */
function removeFirstLine(code) {
    // Find the first text node containing a newline, truncate up to and including it.
    for (let i = 0; i < code.children.length; i++) {
        const child = code.children[i];
        if (child.type === 'text') {
            const nl = child.value.indexOf('\n');
            if (nl !== -1) {
                child.value = child.value.slice(nl + 1);
                if (!child.value)
                    code.children.splice(i, 1);
                return;
            }
            else {
                // First text node has no newline — remove it and continue.
                code.children.splice(i, 1);
                i--;
            }
        }
        else if (child.type === 'element') {
            // It's a token span — peek inside.
            const innerText = extractText(child);
            const nl = innerText.indexOf('\n');
            if (nl !== -1) {
                // Truncate inner text.
                truncateTextAt(child, nl);
                return;
            }
            else {
                code.children.splice(i, 1);
                i--;
            }
        }
        else {
            code.children.splice(i, 1);
            i--;
        }
    }
}
function truncateTextAt(el, idx) {
    for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i];
        if (child.type === 'text') {
            child.value = child.value.slice(idx + 1);
            if (!child.value)
                el.children.splice(i, 1);
            return;
        }
        else if (child.type === 'element') {
            const innerLen = extractText(child).length;
            if (idx < innerLen) {
                truncateTextAt(child, idx);
                return;
            }
            else {
                idx -= innerLen;
            }
        }
    }
}
/* ---------- helpers ---------- */
function resolveFlag(metaVal, configVal, autoCondition) {
    if (metaVal !== null)
        return metaVal;
    if (configVal === 'always')
        return true;
    if (configVal === 'never')
        return false;
    return autoCondition;
}
function shouldCollapse(pre, threshold) {
    const text = textContent(pre);
    return text.split('\n').length > threshold;
}
function textContent(node) {
    let out = '';
    visit(node, 'text', (t) => { out += t.value; });
    return out;
}
function extractText(el) {
    let out = '';
    visit(el, 'text', (t) => { out += t.value; });
    return out;
}
function getFirstLineText(code) {
    const text = extractText(code);
    return text.split('\n')[0] ?? null;
}
function extractLanguageFromClass(className) {
    if (!className)
        return null;
    const arr = Array.isArray(className) ? className : className.split(/\s+/);
    for (const c of arr) {
        if (c === 'astro-code' || c === 'shiki' || c === 'hljs' || c === 'shiki-themes')
            continue;
        const m = c.match(/^(?:language-|lang-)(.+)/);
        if (m)
            return m[1];
        if (c.includes('-'))
            continue;
        return c;
    }
    return null;
}
/**
 * Split a Shiki-tokenized <code> into per-line spans, applying highlight,
 * diff, focus, error, warning, and word-highlight classes.
 *
 * Each emitted line has the structure:
 *   <span class="pcb__line [pcb__line--*]">
 *     <span class="pcb__ln">{lineNumber}</span>    ← only when lineNumbers enabled
 *     <span class="pcb__code">{line content}</span>
 *   </span>
 *
 * This row-based structure lets CSS apply highlight backgrounds to BOTH the
 * gutter cell and the code cell (so the band spans the full body width),
 * and lets the accent indicator sit on the gutter cell (never overlapping
 * code text).
 *
 * Shiki's transformers may have added classes like:
 *   - "diff add" / "diff remove"      (from transformerNotationDiff)
 *   - "focused"                        (from transformerNotationFocus)
 *   - "highlighted"                    (from transformerNotationHighlight)
 *   - "highlighted error" / "highlighted warning" (from transformerNotationErrorLevel)
 *   - "highlighted-word"               (from transformerMetaWordHighlight)
 *
 * We map these onto our own pcb__line--* / pcb__word classes for consistency.
 */
function toLineSpans(code, resolved, opts) {
    const rawLines = splitCodeIntoLines(code);
    const magicMarked = code.__magicMarkedLines;
    return rawLines.map((line, i) => {
        const lineNumber = i + resolved.lineNumbersStart;
        const classes = new Set(['pcb__line']);
        const originalClasses = line.properties?.className ?? [];
        // Map Shiki's transformer-added classes onto ours.
        for (const c of originalClasses) {
            if (c === 'line')
                continue;
            if (c === 'diff' || c === 'add')
                classes.add('pcb__line--add');
            else if (c === 'remove')
                classes.add('pcb__line--del');
            else if (c === 'focused')
                classes.add('pcb__line--focus');
            else if (c === 'highlighted')
                classes.add('pcb__line--hl');
            else if (c === 'error')
                classes.add('pcb__line--error');
            else if (c === 'warning')
                classes.add('pcb__line--warning');
            else if (c === 'info')
                classes.add('pcb__line--info');
            else if (c === 'has-diff' || c === 'has-focused' || c === 'has-highlighted') {
                // Skip body-level classes (these appear on <pre>/<code>, not <span class="line">).
            }
            else if (c === 'pcb__line--hl' || c === 'pcb__line--add' || c === 'pcb__line--del' ||
                c === 'pcb__line--focus' || c === 'pcb__line--error' || c === 'pcb__line--warning' ||
                c === 'pcb__line--info') {
                // Shiki transformers may add our own pcb__line--* classes directly
                // (we configure them to use these names). Pass them through.
                classes.add(c);
            }
            else if (c.startsWith('pcb__word') || c.startsWith('pcb__line--')) {
                // Skip other pcb__ prefixed classes we don't recognize (avoid duplicates).
            }
            else {
                // Preserve unknown classes for interop with user CSS.
                classes.add(c);
            }
        }
        // Apply meta {1,3-5} highlights (in case transformerMetaHighlight didn't run).
        if (opts.highlight && resolved.highlight.includes(lineNumber)) {
            classes.add('pcb__line--hl');
        }
        // Apply magic-comment marks.
        if (magicMarked?.has(lineNumber)) {
            for (const cls of magicMarked.get(lineNumber)) {
                classes.add(cls);
            }
        }
        // Legacy: detect +/- first-char diff (kept for passthrough mode).
        if (opts.diff && !classes.has('pcb__line--add') && !classes.has('pcb__line--del')) {
            const firstText = firstTextValue(line);
            if (firstText === '+')
                classes.add('pcb__line--add');
            else if (firstText === '-')
                classes.add('pcb__line--del');
        }
        // Map word-highlight spans inside this line.
        const mappedChildren = mapWordHighlights(line.children);
        // v2.2.0: Parse and strip // [!ann: "text"] annotation notation.
        let annotationText = null;
        if (opts.annotations) {
            const lineText = extractLineText(line);
            const annMatch = lineText.match(/\[!ann:\s*"([^"]*)"\s*\]/);
            if (annMatch) {
                annotationText = annMatch[1];
                // Strip the annotation from the line's text content
                // (replace in all text nodes within the line)
                stripAnnotationFromLine(line, annMatch[0]);
            }
        }
        // The line wrapper itself (the Shiki <span class="line ...">) becomes the
        // content of .pcb__code. Strip its classes — we've already mapped them
        // onto the outer .pcb__line wrapper, so they shouldn't also appear here.
        // We do this by creating a new wrapper span with empty classes but
        // preserving the children.
        const innerWrapper = {
            type: 'element',
            tagName: 'span',
            properties: { className: [] },
            children: mappedChildren,
        };
        // Build the row: [gutter-cell?, code-cell, annotation?]
        const lineChildren = [];
        if (resolved.lineNumbers) {
            lineChildren.push(h('span', { className: ['pcb__ln'], ariaHidden: true }, [hText(String(lineNumber))]));
        }
        lineChildren.push(h('span', { className: ['pcb__code'] }, [innerWrapper]));
        // v2.2.0: Add annotation cell if this line has an annotation
        if (annotationText !== null) {
            lineChildren.push(h('span', { className: ['pcb__ann'], 'dataAnn': annotationText }, [hText(annotationText)]));
        }
        const lineProps = { className: [...classes] };
        if (annotationText !== null) {
            lineProps['dataAnn'] = annotationText;
        }
        return h('span', lineProps, lineChildren);
    });
}
/**
 * Remove a trailing empty line (one with no text content) that usually
 * results from a trailing newline in the source code.
 */
function filterTrailingEmpty(lines) {
    if (lines.length === 0)
        return lines;
    const last = lines[lines.length - 1];
    // Find the .pcb__code child and check if it has any text.
    const codeChild = last.children.find((c) => c.type === 'element' &&
        c.tagName === 'span' &&
        (c.properties?.className ?? []).includes('pcb__code'));
    if (!codeChild)
        return lines;
    const hasText = extractText(codeChild).length > 0;
    return hasText ? lines : lines.slice(0, -1);
}
/**
 * Wrap per-line collapsible sections in <details><summary>…</summary>…</details>.
 *
 * Reads `meta.collapseRanges` (parsed from `collapse="5-12,20-30"` meta) and
 * wraps matching line ranges. Lines are 1-indexed (matching the lineNumbersStart
 * offset passed in).
 *
 * The summary element shows "N collapsed lines" (or the i18n variant).
 * The details element gets class `pcb__collapse` plus a style class based on
 * `opts.collapseStyle` (e.g. `pcb__collapse--github`).
 *
 * Lines outside any range are passed through unchanged.
 */
function wrapCollapsedSections(lines, meta, opts, lineNumbersStart) {
    if (!meta.collapseRanges || meta.collapseRanges.length === 0) {
        return lines;
    }
    // Build a map of lineNumber → index in `lines`.
    // Line numbers are 1-indexed starting at `lineNumbersStart`.
    // Index in `lines` is 0-indexed, so line N corresponds to lines[N - lineNumbersStart].
    const result = [];
    let i = 0;
    while (i < lines.length) {
        const lineNumber = i + lineNumbersStart;
        // Find a collapse range that starts at this line.
        const range = meta.collapseRanges.find((r) => r.from === lineNumber);
        if (range) {
            const rangeSize = range.to - range.from + 1;
            const sectionLines = lines.slice(i, i + rangeSize);
            // i18n: customize the summary label.
            const labelFn = opts.texts?.collapsedLinesLabel;
            const summaryText = labelFn
                ? labelFn(rangeSize)
                : `${rangeSize} collapsed line${rangeSize === 1 ? '' : 's'}`;
            const summary = h('summary', { className: ['pcb__collapse-summary'] }, [hText(summaryText)]);
            const detailsClasses = ['pcb__collapse'];
            if (opts.collapseStyle && opts.collapseStyle !== 'github') {
                detailsClasses.push(`pcb__collapse--${opts.collapseStyle}`);
            }
            else {
                detailsClasses.push('pcb__collapse--github');
            }
            const details = h('details', { className: detailsClasses }, [summary, ...sectionLines]);
            result.push(details);
            i += rangeSize;
        }
        else {
            result.push(lines[i]);
            i++;
        }
    }
    return result;
}
/** Walk line children and remap "highlighted-word" → "pcb__word" class. */
function mapWordHighlights(children) {
    return children.map((child) => {
        if (child.type !== 'element')
            return child;
        const cls = child.properties?.className ?? [];
        if (cls.includes('highlighted-word') || cls.includes('word')) {
            const newCls = [...cls.filter((c) => c !== 'highlighted-word' && c !== 'word'), 'pcb__word'];
            return {
                ...child,
                properties: { ...(child.properties ?? {}), className: newCls },
            };
        }
        // Recurse into nested spans.
        return { ...child, children: mapWordHighlights(child.children) };
    });
}
function splitCodeIntoLines(code) {
    // Case 1: Shiki already produced <span class="line">...</span> per line.
    const spans = code.children.filter((c) => c.type === 'element' && c.tagName === 'span' &&
        hasClass(c, 'line'));
    if (spans.length > 0) {
        return spans.map((s) => {
            // Preserve the original classes on the line element so toLineSpans can
            // inspect them and map Shiki's transformer classes onto ours.
            const originalClasses = s.properties?.className ?? [];
            return {
                type: 'element',
                tagName: 'span',
                // Keep the classes — toLineSpans will read them and then we drop the
                // inner wrapper entirely (its children become our .pcb__code's children).
                properties: { ...(s.properties ?? {}), className: originalClasses },
                children: s.children,
            };
        });
    }
    // Case 2: Plain tokenized code — split on newlines in Text nodes.
    //
    // We split on `\n` in Text nodes; empty lines between two non-empty lines
    // must be preserved (regression: previously dropped by a `sawAnyContent`
    // guard that was meant to skip a *trailing* empty line but also skipped
    // legitimate inter-content empty lines).
    // The trailing-empty-line case is handled separately by `filterTrailingEmpty()`
    // at the end of `transformPre()`, so we don't need to special-case it here.
    const lines = [];
    let current = [];
    const flush = () => {
        lines.push({
            type: 'element',
            tagName: 'span',
            properties: {},
            children: current,
        });
        current = [];
    };
    for (const child of code.children) {
        if (child.type === 'text') {
            const parts = child.value.split('\n');
            parts.forEach((part, i) => {
                if (i > 0)
                    flush();
                if (part) {
                    current.push({ type: 'text', value: part });
                }
            });
        }
        else {
            current.push(child);
        }
    }
    // Always flush the final pending line — `filterTrailingEmpty()` will drop
    // it if it ends up empty (i.e. the source had a trailing `\n`).
    flush();
    return lines;
}
function hasClass(el, name) {
    const cls = el.properties?.className;
    if (!cls)
        return false;
    const arr = Array.isArray(cls) ? cls : String(cls).split(/\s+/);
    return arr.includes(name);
}
function firstTextValue(line) {
    if (line.children.length === 0)
        return null;
    const first = line.children[0];
    if (first.type === 'text')
        return first.value.trim().charAt(0);
    if (first.type === 'element')
        return firstTextValue(first);
    return null;
}
/* ---------- hast constructors ---------- */
function h(tag, props = {}, children = []) {
    return {
        type: 'element',
        tagName: tag,
        properties: props,
        children,
    };
}
function hText(value) {
    return { type: 'text', value };
}
/** v2.2.0: Strip an annotation notation from all text nodes in a line element. */
function stripAnnotationFromLine(line, annotation) {
    const walk = (node) => {
        if (node.type === 'text') {
            node.value = node.value.replace(annotation, '');
        }
        else if (node.type === 'element') {
            for (const child of node.children)
                walk(child);
        }
    };
    for (const child of line.children)
        walk(child);
}
/* ---------- Pattern 5: word-level diff (selective adoption from expressive-code) ---------- */
/**
 * Extract the plain text content of a line span (for diff comparison).
 * Walks the line's children and concatenates all text values.
 */
function extractLineText(line) {
    const out = [];
    const walk = (node) => {
        if (node.type === 'text') {
            out.push(node.value);
        }
        else if (node.type === 'element') {
            for (const child of node.children)
                walk(child);
        }
    };
    for (const child of line.children)
        walk(child);
    return out.join('');
}
/**
 * Find the `.pcb__code` child of a line span and replace its children
 * with the given replacement nodes (preserving the `.pcb__code` wrapper).
 */
function replaceCodeChildren(line, newChildren) {
    const codeChild = line.children.find((c) => c.type === 'element' &&
        c.tagName === 'span' &&
        (c.properties?.className ?? []).includes('pcb__code'));
    if (codeChild) {
        codeChild.children = newChildren;
    }
}
/**
 * Apply word-level diff highlighting to adjacent `pcb__line--del` / `pcb__line--add`
 * pairs. For each pair, compute the per-word diff between the del line's text and
 * the add line's text, then wrap changed words in `<mark>` elements.
 *
 * Only adjacent del→add pairs are processed (the common case for unified diffs).
 * Standalone del or add lines (no adjacent counterpart) are left unchanged.
 *
 * This is a post-processing step that runs after `toLineSpans` and before
 * `wrapCollapsedSections`. It mutates the line spans in place.
 */
function applyWordDiff(lines) {
    for (let i = 0; i < lines.length - 1; i++) {
        const cur = lines[i];
        const next = lines[i + 1];
        const curClasses = cur.properties?.className ?? [];
        const nextClasses = next.properties?.className ?? [];
        const curIsDel = curClasses.includes('pcb__line--del');
        const nextIsAdd = nextClasses.includes('pcb__line--add');
        if (!curIsDel || !nextIsAdd)
            continue;
        const oldText = extractLineText(cur);
        const newText = extractLineText(next);
        const tokens = wordDiff(oldText, newText);
        if (!hasChanges(tokens))
            continue;
        // Build replacement children for the del line: wrap 'del' tokens in <mark>,
        // pass 'equal' and 'add' tokens through as plain text (add tokens don't
        // belong in the del line).
        const delChildren = [];
        const addChildren = [];
        for (const token of tokens) {
            if (token.type === 'equal') {
                delChildren.push(hText(token.text));
                addChildren.push(hText(token.text));
            }
            else if (token.type === 'del') {
                delChildren.push(h('mark', { className: ['pcb__word-diff', 'pcb__word-diff--del'] }, [hText(token.text)]));
                // del tokens don't appear in the add line
            }
            else if (token.type === 'add') {
                addChildren.push(h('mark', { className: ['pcb__word-diff', 'pcb__word-diff--add'] }, [hText(token.text)]));
                // add tokens don't appear in the del line
            }
        }
        replaceCodeChildren(cur, delChildren);
        replaceCodeChildren(next, addChildren);
    }
    return lines;
}
//# sourceMappingURL=transformer.js.map