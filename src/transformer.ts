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

import type { Element, ElementContent, Properties, Root, Text } from 'hast';
import { visit } from 'unist-util-visit';
import { parseMeta } from './meta.js';
import type { PerfectCodeOptions, ResolvedBlock, MagicComment } from './types.js';

/** Default inline SVG copy icon (16x16 GitHub octicon copy). */
const DEFAULT_COPY_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`;

const DEFAULT_SUCCESS_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`;

/** Inline SVG icon for the copy button — built as a proper hast tree. */
function copyIconElement(customSvg?: string): Element {
  const svg = customSvg ?? DEFAULT_COPY_ICON;
  return parseInlineHtml(svg);
}

/** Three-dot decoration — built as a proper hast tree. */
function dotsElement(): Element {
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

/** Naive inline-HTML parser for tiny SVG/HTML snippets used as ornaments. */
function parseInlineHtml(html: string): Element {
  // For our use case (single <svg>...</svg> or single <span>...</span>), we
  // build the hast tree manually to avoid pulling in hast-util-from-html for
  // every icon. We support <svg>...</svg> with <path/> children.
  const m = html.match(/^<(\w+)([^>]*)>([\s\S]*)<\/\1>$/);
  if (!m) {
    return { type: 'element', tagName: 'span', properties: {}, children: [{ type: 'text', value: html }] };
  }
  const [, tag, attrsStr, inner] = m;
  const props = parseAttrs(attrsStr);
  const children: ElementContent[] = [];
  // Parse inner self-closing tags like <path d="..."/>
  const re = /<(\w+)([^>]*)\/>/g;
  let cm: RegExpExecArray | null;
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
    if (text) children.push({ type: 'text', value: text });
  }
  return { type: 'element', tagName: tag, properties: props, children };
}

function parseAttrs(s: string): Properties {
  const props: Record<string, string | boolean | string[]> = {};

  // Match key="value" pairs first.
  const re = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const key = m[1];
    const val = m[2];
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key === 'class') {
      props.className = val.split(/\s+/);
    } else {
      props[camelKey] = val;
    }
  }

  // Now strip all quoted key="value" pairs from the string so the bare-attribute
  // regex doesn't accidentally match digits/words inside quoted values.
  const stripped = s.replace(/\w[\w-]*\s*=\s*"[^"]*"/g, '');

  // Bare boolean attributes (e.g. `aria-hidden` without ="")
  const bareRe = /(?:^|\s)(\w[\w-]*)(?=\s|$)/g;
  let bm: RegExpExecArray | null;
  while ((bm = bareRe.exec(stripped)) !== null) {
    const key = bm[1];
    if (props[key] === undefined) {
      const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      props[camelKey] = true;
    }
  }
  return props as Properties;
}

/** Default magic comments (Docusaurus-style). */
const DEFAULT_MAGIC_COMMENTS: MagicComment[] = [
  {
    className: 'pcb__line--hl',
    line: 'highlight-next-line',
    block: { start: 'highlight-start', end: 'highlight-end' },
  },
];

const DEFAULT_TERMINAL_LANGS = ['sh', 'bash', 'zsh', 'shell', 'console', 'powershell', 'bat', 'cmd'];

export function rehypePerfectCodeBlocks(userOptions: PerfectCodeOptions = {}) {
  const { shiki: userShiki, ...rest } = userOptions;
  const options: Required<PerfectCodeOptions> = {
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
    focus: true,
    errorLevels: true,
    wrap: false,
    collapseAfter: null,
    showWhitespace: false,
    indentGuides: false,
    caption: true,
    engine: 'auto',
    shiki: {
      theme: { light: 'github-light', dark: 'github-dark' },
      langs: [],
      transformers: [],
      ...(userShiki ?? {}),
    },
    keepBackground: false,
    customNotations: {},
    magicComments: DEFAULT_MAGIC_COMMENTS,
    inlineCode: false,
    inlineDefaultLang: '',
    tokensMap: {},
    terminalLangs: DEFAULT_TERMINAL_LANGS,
    extractFileNameFromCode: false,
    filterMetaString: (s) => s,
    onVisitLine: () => {},
    onVisitHighlightedLine: () => {},
    onVisitHighlightedChars: () => {},
    onVisitTitle: () => {},
    onVisitCaption: () => {},
    preset: 'default',
    injectStyles: true,
    theme: 'auto',
    inline: false,
    ...rest,
  };

  return async (tree: Root) => {
    const visits: Element[] = [];

    visit(tree, 'element', (node) => {
      if (node.tagName !== 'pre') return;
      if (node.properties?.dataPcbDone) return;
      const codeChild = node.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code'
      );
      if (!codeChild) return;
      visits.push(node);
    });

    for (const pre of visits) {
      const replacement = await transformPre(pre, options);
      if (replacement) {
        Object.assign(pre, replacement);
      }
    }
  };
}

async function transformPre(
  pre: Element,
  opts: Required<PerfectCodeOptions>
): Promise<Element | null> {
  const codeChild = pre.children.find(
    (c): c is Element => c.type === 'element' && c.tagName === 'code'
  );
  if (!codeChild) return null;

  // Apply filterMetaString hook before parsing.
  let metaStr =
    (codeChild.properties?.dataMeta as string | undefined) ??
    (pre.properties?.dataMeta as string | undefined) ??
    (pre.properties?.meta as string | undefined) ??
    '';
  metaStr = opts.filterMetaString(metaStr);
  const meta = parseMeta(metaStr);

  // Detect language from class + data attribute.
  const className = (pre.properties?.className as string | string[] | undefined) ??
                    (codeChild.properties?.className as string | string[] | undefined) ?? '';
  const langFromClasses = extractLanguageFromClass(className);
  const langFromDataAttr =
    (codeChild.properties?.dataLanguage as string | undefined) ?? null;
  const language = meta.language ?? langFromClasses ?? langFromDataAttr;
  const effectiveLang =
    language && !['plaintext', 'text', 'txt', ''].includes(language) ? language : null;

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
  const resolved: ResolvedBlock = {
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
    collapse: meta.flags.collapse ?? (opts.collapseAfter != null ? shouldCollapse(pre, opts.collapseAfter) : false),
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

  // Call onVisitLine / onVisitHighlightedLine hooks.
  filteredLines.forEach((line, i) => {
    const lineNumber = i + resolved.lineNumbersStart;
    const isHl = (line.properties?.className as string[] | undefined)?.includes('pcb__line--hl');
    opts.onVisitLine({ element: line, lineNumber });
    if (isHl) {
      opts.onVisitHighlightedLine({ element: line, lineNumber });
    }
  });

  // data-line-numbers-max-digits attribute on <code> for CSS-driven gutter sizing.
  const maxDigits = String(filteredLines.length + resolved.lineNumbersStart - 1).length;
  const codeDataProps: Record<string, unknown> = {
    dataLineNumbersMaxDigits: String(maxDigits),
  };
  if (effectiveLang) {
    codeDataProps.dataLanguage = effectiveLang;
  }
  // Mark whether line numbers are present so CSS can switch grid on/off.
  if (resolved.lineNumbers) {
    codeDataProps.dataLineNumbers = '';
  }

  // Build code <pre><code> with line spans.
  // When keepBackground is true, preserve Shiki's inline `style` (which includes
  // background-color + color from the theme) on the new <pre>.
  const newCode = h('code', codeDataProps, filteredLines);
  const newPreProps: Record<string, unknown> = {};
  if (opts.keepBackground && pre.properties?.style) {
    newPreProps.style = pre.properties.style;
  }
  // Don't carry over Shiki's tabindex — it causes unwanted focus rings on the
  // inner <pre>. The figure itself is not focusable; only the copy button is.
  const newPre = h('pre', newPreProps, [newCode]);

  // Body: scrollable container around <pre>.
  const bodyClasses = ['pcb__body'];
  if (resolved.highlight.length > 0) bodyClasses.push('pcb__body--has-hl');
  const body = h('div', { className: bodyClasses }, [newPre]);

  // Header bar.
  let bar: Element | null = null;
  if (resolved.titleBar) {
    const barChildren: ElementContent[] = [];
    if (resolved.decorations) barChildren.push(dotsElement());
    barChildren.push(
      h('div', { className: ['pcb__title'] }, title ? [hText(title)] : [])
    );
    if (resolved.showLanguage && resolved.language) {
      barChildren.push(h('div', { className: ['pcb__lang'] }, [hText(resolved.language)]));
    }
    if (resolved.copyButton) {
      barChildren.push(buildCopyButton(opts));
    }
    bar = h('div', { className: ['pcb__bar'] }, barChildren);
    if (title) opts.onVisitTitle(bar);
  }

  // Figure class.
  const figClasses = ['pcb'];
  if (presetClass !== 'default') figClasses.push(`pcb--${presetClass}`);
  if (resolved.wrap) figClasses.push('pcb--wrap');
  if (resolved.collapse) figClasses.push('pcb--collapse');
  // Hover-mode copy button: add marker class to figure.
  if (typeof opts.copyButton === 'object' && opts.copyButton.visibility === 'hover') {
    figClasses.push('pcb--copy-on-hover');
  }

  const figureChildren: ElementContent[] = [];
  if (resolved.collapse) {
    const summaryChildren: ElementContent[] = [];
    if (resolved.decorations) summaryChildren.push(dotsElement());
    summaryChildren.push(
      h('span', { className: ['pcb__title'] }, [hText(title ?? 'code')])
    );
    if (resolved.showLanguage && resolved.language) {
      summaryChildren.push(h('div', { className: ['pcb__lang'] }, [hText(resolved.language)]));
    }
    const summary = h('summary', {}, summaryChildren);
    const details = h('details', { className: figClasses, open: false }, [summary, body]);
    return details;
  }

  if (bar) figureChildren.push(bar);
  figureChildren.push(body);

  // Caption (rehype-pretty-code style). Only render if globally enabled AND meta present.
  if (opts.caption && meta.caption) {
    const cap = h('figcaption', { className: ['pcb__caption'] }, [hText(meta.caption)]);
    opts.onVisitCaption(cap);
    figureChildren.push(cap);
  }

  return h('figure', { className: figClasses }, figureChildren);
}

/** Build the copy button based on options (legacy boolean or new object form). */
function buildCopyButton(opts: Required<PerfectCodeOptions>): Element {
  let label: string | null = 'copy';
  let doneLabel: string = 'copied!';
  let copyIcon: string | undefined;
  let successIcon: string | undefined;
  let feedbackDuration: number | undefined;

  if (typeof opts.copyButton === 'object') {
    // Use `in` check so `null` is honored (not collapsed to default by `??`).
    if ('label' in opts.copyButton) {
      label = opts.copyButton.label ?? null;
    }
    if ('doneLabel' in opts.copyButton) {
      doneLabel = opts.copyButton.doneLabel ?? 'copied!';
    }
    copyIcon = opts.copyButton.copyIcon;
    successIcon = opts.copyButton.successIcon;
    feedbackDuration = opts.copyButton.feedbackDuration;
  } else {
    // Legacy: use copyButtonLabel / copyButtonDoneLabel.
    label = opts.copyButtonLabel;
    doneLabel = opts.copyButtonDoneLabel;
  }

  const btnChildren: ElementContent[] = [copyIconElement(copyIcon)];
  if (label) {
    btnChildren.push(h('span', { className: ['pcb__copy-label'] }, [hText(label)]));
  }

  const btnProps: Record<string, unknown> = {
    className: ['pcb__copy'],
    type: 'button',
    ariaLabel: 'Copy code',
    dataDoneLabel: doneLabel,
  };
  if (successIcon) btnProps.dataSuccessIcon = successIcon;
  if (feedbackDuration != null) btnProps.dataFeedbackDuration = String(feedbackDuration);

  return h('button', btnProps, btnChildren);
}

/** Apply Docusaurus-style magic comments by transforming them into Shiki notation comments. */
function applyMagicComments(
  code: Element,
  magicComments: MagicComment[],
  customNotations: Record<string, string>
): void {
  // Convert magic-comment markers to // [!code xxx] notation so the Shiki
  // transformers will pick them up. We do this by walking text nodes inside
  // the code element and replacing e.g. "// highlight-next-line" on line N
  // with "// [!code highlight]" on line N+1.
  const text = extractText(code);
  if (!text) return;

  const lines = text.split('\n');
  const markedLines = new Set<number>();
  const markedClasses: Map<number, string[]> = new Map();

  // Scan for line/block magic comments.
  const blockStack: { className: string; startLine: number }[] = [];
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
        const start = blockStack.pop()!.startLine;
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
  (code as unknown as { __magicMarkedLines?: Map<number, string[]> }).__magicMarkedLines = markedClasses;
  void customNotations; // reserved for future use
}

/** Remove the first line of code (used for filename-comment extraction). */
function removeFirstLine(code: Element): void {
  // Find the first text node containing a newline, truncate up to and including it.
  for (let i = 0; i < code.children.length; i++) {
    const child = code.children[i];
    if (child.type === 'text') {
      const nl = child.value.indexOf('\n');
      if (nl !== -1) {
        child.value = child.value.slice(nl + 1);
        if (!child.value) code.children.splice(i, 1);
        return;
      } else {
        // First text node has no newline — remove it and continue.
        code.children.splice(i, 1);
        i--;
      }
    } else if (child.type === 'element') {
      // It's a token span — peek inside.
      const innerText = extractText(child);
      const nl = innerText.indexOf('\n');
      if (nl !== -1) {
        // Truncate inner text.
        truncateTextAt(child, nl);
        return;
      } else {
        code.children.splice(i, 1);
        i--;
      }
    } else {
      code.children.splice(i, 1);
      i--;
    }
  }
}

function truncateTextAt(el: Element, idx: number): void {
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    if (child.type === 'text') {
      child.value = child.value.slice(idx + 1);
      if (!child.value) el.children.splice(i, 1);
      return;
    } else if (child.type === 'element') {
      const innerLen = extractText(child).length;
      if (idx < innerLen) {
        truncateTextAt(child, idx);
        return;
      } else {
        idx -= innerLen;
      }
    }
  }
}

/* ---------- helpers ---------- */

function resolveFlag(metaVal: boolean | null, configVal: 'always' | 'never' | 'auto', autoCondition: boolean): boolean {
  if (metaVal !== null) return metaVal;
  if (configVal === 'always') return true;
  if (configVal === 'never') return false;
  return autoCondition;
}

function shouldCollapse(pre: Element, threshold: number): boolean {
  const text = textContent(pre);
  return text.split('\n').length > threshold;
}

function textContent(node: Element): string {
  let out = '';
  visit(node, 'text', (t: Text) => { out += t.value; });
  return out;
}

function extractText(el: Element): string {
  let out = '';
  visit(el, 'text', (t) => { out += t.value; });
  return out;
}

function getFirstLineText(code: Element): string | null {
  const text = extractText(code);
  return text.split('\n')[0] ?? null;
}

function extractLanguageFromClass(className: string | string[] | undefined): string | null {
  if (!className) return null;
  const arr = Array.isArray(className) ? className : className.split(/\s+/);
  for (const c of arr) {
    if (c === 'astro-code' || c === 'shiki' || c === 'hljs' || c === 'shiki-themes') continue;
    const m = c.match(/^(?:language-|lang-)(.+)/);
    if (m) return m[1];
    if (c.includes('-')) continue;
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
function toLineSpans(
  code: Element,
  resolved: ResolvedBlock,
  opts: Required<PerfectCodeOptions>
): Element[] {
  const rawLines = splitCodeIntoLines(code);
  const magicMarked = (code as unknown as { __magicMarkedLines?: Map<number, string[]> }).__magicMarkedLines;

  return rawLines.map((line, i) => {
    const lineNumber = i + resolved.lineNumbersStart;
    const classes = new Set<string>(['pcb__line']);
    const originalClasses = (line.properties?.className as string[] | undefined) ?? [];

    // Map Shiki's transformer-added classes onto ours.
    for (const c of originalClasses) {
      if (c === 'line') continue;
      if (c === 'diff' || c === 'add') classes.add('pcb__line--add');
      else if (c === 'remove') classes.add('pcb__line--del');
      else if (c === 'focused') classes.add('pcb__line--focus');
      else if (c === 'highlighted') classes.add('pcb__line--hl');
      else if (c === 'error') classes.add('pcb__line--error');
      else if (c === 'warning') classes.add('pcb__line--warning');
      else if (c === 'has-diff' || c === 'has-focused' || c === 'has-highlighted') {
        // Skip body-level classes (these appear on <pre>/<code>, not <span class="line">).
      } else {
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
      for (const cls of magicMarked.get(lineNumber)!) {
        classes.add(cls);
      }
    }

    // Legacy: detect +/- first-char diff (kept for passthrough mode).
    if (opts.diff && !classes.has('pcb__line--add') && !classes.has('pcb__line--del')) {
      const firstText = firstTextValue(line);
      if (firstText === '+') classes.add('pcb__line--add');
      else if (firstText === '-') classes.add('pcb__line--del');
    }

    // Map word-highlight spans inside this line.
    const mappedChildren = mapWordHighlights(line.children);

    // Build the row: [gutter-cell?, code-cell]
    const lineChildren: ElementContent[] = [];
    if (resolved.lineNumbers) {
      lineChildren.push(
        h('span', { className: ['pcb__ln'], ariaHidden: true }, [hText(String(lineNumber))])
      );
    }
    lineChildren.push(
      h('span', { className: ['pcb__code'] }, mappedChildren)
    );

    return h('span', { className: [...classes] }, lineChildren);
  });
}

/**
 * Remove a trailing empty line (one with no text content) that usually
 * results from a trailing newline in the source code.
 */
function filterTrailingEmpty(lines: Element[]): Element[] {
  if (lines.length === 0) return lines;
  const last = lines[lines.length - 1];
  // Find the .pcb__code child and check if it has any text.
  const codeChild = last.children.find(
    (c): c is Element =>
      c.type === 'element' &&
      c.tagName === 'span' &&
      ((c.properties?.className as string[] | undefined) ?? []).includes('pcb__code')
  );
  if (!codeChild) return lines;
  const hasText = extractText(codeChild).length > 0;
  return hasText ? lines : lines.slice(0, -1);
}

/** Walk line children and remap "highlighted-word" → "pcb__word" class. */
function mapWordHighlights(children: ElementContent[]): ElementContent[] {
  return children.map((child) => {
    if (child.type !== 'element') return child;
    const cls = (child.properties?.className as string[] | undefined) ?? [];
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

function splitCodeIntoLines(code: Element): Element[] {
  // Case 1: Shiki already produced <span class="line">...</span> per line.
  const spans = code.children.filter(
    (c): c is Element => c.type === 'element' && c.tagName === 'span' &&
      hasClass(c, 'line')
  );
  if (spans.length > 0) {
    return spans.map((s) => ({
      type: 'element',
      tagName: 'span',
      properties: { ...(s.properties ?? {}) },
      children: s.children,
    } as Element));
  }

  // Case 2: Plain tokenized code — split on newlines in Text nodes.
  const lines: Element[] = [];
  let current: ElementContent[] = [];
  let sawAnyContent = false;

  const flush = () => {
    if (current.length === 0 && sawAnyContent && lines.length > 0) return;
    lines.push({
      type: 'element',
      tagName: 'span',
      properties: {},
      children: current,
    } as Element);
    current = [];
  };

  for (const child of code.children) {
    if (child.type === 'text') {
      const parts = child.value.split('\n');
      parts.forEach((part, i) => {
        if (i > 0) flush();
        if (part) {
          current.push({ type: 'text', value: part } as Text);
          sawAnyContent = true;
        }
      });
    } else {
      current.push(child);
      sawAnyContent = true;
    }
  }
  if (current.length > 0) flush();
  return lines;
}

function hasClass(el: Element, name: string): boolean {
  const cls = el.properties?.className;
  if (!cls) return false;
  const arr = Array.isArray(cls) ? cls : String(cls).split(/\s+/);
  return arr.includes(name);
}

function firstTextValue(line: Element): string | null {
  if (line.children.length === 0) return null;
  const first = line.children[0];
  if (first.type === 'text') return first.value.trim().charAt(0);
  if (first.type === 'element') return firstTextValue(first);
  return null;
}

/* ---------- hast constructors ---------- */

function h(tag: string, props: Record<string, unknown> = {}, children: ElementContent[] = []): Element {
  return {
    type: 'element',
    tagName: tag,
    properties: props as Properties,
    children,
  };
}

function hText(value: string): Text {
  return { type: 'text', value };
}
