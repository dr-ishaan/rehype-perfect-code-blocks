/**
 * Meta parser for fenced code blocks.
 *
 * Supports the de-facto syntax used by Starlight/Docusaurus/Shiki/VitePress:
 *
 *   ```ts title="src/store.ts" {1,3-5} ln{5} /foo/ /bar/1-3 #id showLineNumbers wrap noLang
 *   ^^^         ^^^^^^^^^^^^^^^^^^^^ ^^^^^^^^^^ ^^^ ^^^^^^^^^^ ^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^
 *   lang        title="..."          ranges    ln start word-high  group-id  flags
 *
 * New syntaxes supported (matching rehype-pretty-code):
 *   - ln{N} or showLineNumbers{N}  — start line numbers at N
 *   - {1,3-5}#id                    — group highlighted lines by id for per-group styling
 *   - /word/                        — highlight all occurrences of "word"
 *   - /word/3-5                     — highlight only occurrences 3 through 5
 *   - /word/#id                     — assign id to this word-highlight group
 *   - "phrase"                      — highlight all occurrences of "phrase" (double-quoted)
 *   - caption="..."                 — render a caption below the block
 *
 * Also accepts:
 *   - Quoted titles with escaped quotes: title="src/\"x\".ts" or title='src/"x".ts'
 *   - Comma- and space-separated ranges: {1, 3-5, 7}
 *   - Boolean flags: wrap / noWrap, ln / noLn, bar / noBar,
 *                    decorations / noDecorations, lang / noLang,
 *                    copy / noCopy, collapse / noCollapse
 */

import type { ParsedMeta } from './types.js';

const FLAG_MAP: Record<string, [keyof ParsedMeta['flags'], boolean]> = {
  wrap: ['wrap', true],
  nowrap: ['wrap', false],
  ln: ['lineNumbers', true],
  noln: ['lineNumbers', false],
  linenos: ['lineNumbers', true],
  nolinenos: ['lineNumbers', false],
  showlinenumbers: ['lineNumbers', true],
  noshowlinenumbers: ['lineNumbers', false],
  bar: ['titleBar', true],
  nobar: ['titleBar', false],
  decorations: ['decorations', true],
  nodecorations: ['decorations', false],
  lang: ['showLanguage', true],
  nolang: ['showLanguage', false],
  copy: ['copyButton', true],
  nocopy: ['copyButton', false],
  collapse: ['collapse', true],
  nocollapse: ['collapse', false],
};

export function parseMeta(meta: string | undefined): ParsedMeta {
  const result: ParsedMeta = {
    language: null,
    title: null,
    caption: null,
    highlight: [],
    highlightGroups: [],
    wordHighlights: [],
    lineNumbersStart: null,
    collapseRanges: [],
    flags: {
      wrap: null,
      lineNumbers: null,
      titleBar: null,
      decorations: null,
      showLanguage: null,
      copyButton: null,
      collapse: null,
    },
  };

  if (!meta || !meta.trim()) return result;

  const tokens = tokenize(meta);

  for (const tok of tokens) {
    // title="..." or title='...'
    if (tok.startsWith('title=')) {
      result.title = unquote(tok.slice('title='.length));
      continue;
    }

    // caption="..." or caption='...'
    if (tok.startsWith('caption=')) {
      result.caption = unquote(tok.slice('caption='.length));
      continue;
    }

    // collapse="5-12,20-30" — per-line collapsible sections
    if (tok.startsWith('collapse=')) {
      const val = unquote(tok.slice('collapse='.length));
      result.collapseRanges = parseCollapseRanges(val);
      if (result.collapseRanges.length > 0) {
        result.flags.collapse = true;
      }
      continue;
    }

    // {1,3-5} or {1,3-5}#id  — line highlight (optionally grouped)
    if (tok.startsWith('{') && tok.includes('}')) {
      const closeIdx = tok.indexOf('}');
      const rangePart = tok.slice(1, closeIdx);
      const after = tok.slice(closeIdx + 1);
      const idMatch = after.match(/^#([\w-]+)/);
      const lines = parseRanges(rangePart);
      if (lines.length > 0) {
        result.highlight.push(...lines);
        result.highlightGroups.push({ lines, id: idMatch?.[1] });
      }
      continue;
    }

    // /word/ or /word/3-5 or /word/#id  — word highlight
    if (tok.startsWith('/') && tok.length > 1) {
      const closeIdx = findMatchingSlash(tok, 1);
      if (closeIdx !== -1) {
        const text = unescapeRegex(tok.slice(1, closeIdx));
        const after = tok.slice(closeIdx + 1);
        const rangeMatch = after.match(/^(\d+)(?:-(\d+))?/);
        const idMatch = after.match(/#([\w-]+)/);
        result.wordHighlights.push({
          text,
          range: rangeMatch
            ? [parseInt(rangeMatch[1], 10), rangeMatch[2] ? parseInt(rangeMatch[2], 10) : parseInt(rangeMatch[1], 10)]
            : undefined,
          id: idMatch?.[1],
        });
        continue;
      }
    }

    // "phrase" or "phrase"3-5 or "phrase"#id — quoted word highlight
    if (tok.startsWith('"') && tok.length > 1) {
      const closeIdx = findMatchingQuote(tok, 1);
      if (closeIdx !== -1) {
        const text = tok.slice(1, closeIdx);
        const after = tok.slice(closeIdx + 1);
        const rangeMatch = after.match(/^(\d+)(?:-(\d+))?/);
        const idMatch = after.match(/#([\w-]+)/);
        result.wordHighlights.push({
          text,
          range: rangeMatch
            ? [parseInt(rangeMatch[1], 10), rangeMatch[2] ? parseInt(rangeMatch[2], 10) : parseInt(rangeMatch[1], 10)]
            : undefined,
          id: idMatch?.[1],
        });
        continue;
      }
    }

    // ln{N} or showLineNumbers{N} or lineNumbers{N} — start line numbers at N
    // (issue #5: also accept `linenumbers` as a third alternative, case-insensitive)
    const startMatch = tok.match(/^(?:ln|showlinenumbers|linenumbers)\{(\d+)\}$/i);
    if (startMatch) {
      result.lineNumbersStart = parseInt(startMatch[1], 10);
      result.flags.lineNumbers = true;
      continue;
    }

    // Boolean flag (case-insensitive)
    const lower = tok.toLowerCase();
    if (FLAG_MAP[lower]) {
      const [key, val] = FLAG_MAP[lower];
      result.flags[key] = val;
    }
    // Unknown tokens are ignored — leave room for future syntax.
  }

  return result;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    // Skip whitespace
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    // Quoted key="value" or key='value' (title=, caption=, collapse=)
    if (/^(?:title|caption|collapse)=$/.test(input.slice(i).match(/^[a-z]+=/i)?.[0] ?? '')) {
      const eq = input.indexOf('=', i);
      let j = eq + 1;
      const quote = input[j];
      if (quote === '"' || quote === "'") {
        j++;
        while (j < input.length) {
          if (input[j] === '\\') { j += 2; continue; }
          if (input[j] === quote) { j++; break; }
          j++;
        }
        tokens.push(input.slice(i, j));
      } else {
        while (j < input.length && !/\s/.test(input[j])) j++;
        tokens.push(input.slice(i, j));
      }
      i = j;
      continue;
    }

    // {range,range}#id
    if (input[i] === '{') {
      const end = input.indexOf('}', i);
      const stop = end === -1 ? input.length : end + 1;
      let j = stop;
      // Consume trailing #id (the # itself, then word chars/dashes).
      if (input[j] === '#') {
        j++; // skip the #
        while (j < input.length && /[\w-]/.test(input[j])) j++;
      }
      tokens.push(input.slice(i, j));
      i = j;
      continue;
    }

    // /word/N-M#id — regex-like word highlight
    if (input[i] === '/') {
      const closeIdx = findMatchingSlash(input, i + 1);
      if (closeIdx !== -1) {
        let j = closeIdx + 1;
        // consume range + id
        while (j < input.length && /[0-9\-,#\w]/.test(input[j])) j++;
        tokens.push(input.slice(i, j));
        i = j;
        continue;
      }
    }

    // "phrase"N-M#id — quoted word highlight
    if (input[i] === '"') {
      const closeIdx = findMatchingQuote(input, i + 1);
      if (closeIdx !== -1) {
        let j = closeIdx + 1;
        while (j < input.length && /[0-9\-,#\w]/.test(input[j])) j++;
        tokens.push(input.slice(i, j));
        i = j;
        continue;
      }
    }

    // ln{N} or showLineNumbers{N} or lineNumbers{N}
    // (issue #5: also accept `linenumbers` as a prefix)
    if (/^(?:ln|showlinenumbers|linenumbers)\{/i.test(input.slice(i))) {
      const closeIdx = input.indexOf('}', i);
      const stop = closeIdx === -1 ? input.length : closeIdx + 1;
      tokens.push(input.slice(i, stop));
      i = stop;
      continue;
    }

    // Bareword flag
    let j = i;
    while (j < input.length && !/\s/.test(input[j])) j++;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

function findMatchingSlash(s: string, start: number): number {
  let i = start;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === '/') return i;
    i++;
  }
  return -1;
}

function findMatchingQuote(s: string, start: number): number {
  let i = start;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === '"') return i;
    i++;
  }
  return -1;
}

function parseRanges(spec: string): number[] {
  const out = new Set<number>();
  // Issue #4: previously `3 - 5` was split into ['3', '-', '5'] by the
  // `[\s,]+` separator and the regex `/^(\d+)(?:-(\d+))?$/` rejected the
  // bare '-'. Result: `{3 - 5}` parsed as [3, 5] instead of [3, 4, 5].
  //
  // Fix: pre-normalize whitespace around `-` inside the spec so that
  // `3 - 5` becomes `3-5` before splitting. The split still happens on
  // `,` and remaining whitespace (between range tokens), so `{1, 3 - 5, 7}`
  // → `1, 3-5, 7` → splits to ['1', '3-5', '7'] → [1, 3, 4, 5, 7]. ✓
  const normalized = spec.replace(/\s*-\s*/g, '-');
  for (const part of normalized.split(/[\s,]+/)) {
    if (!part) continue;
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    for (let n = lo; n <= hi; n++) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

function unquote(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  }
  return s;
}

/**
 * Parse a collapse-range spec like "5-12,20-30" into structured ranges.
 * Each part is either `N` (single line) or `N-M` (range, inclusive).
 * Whitespace around commas and `-` is allowed.
 *
 * Example: "5-12, 20-30" → [{from:5,to:12}, {from:20,to:30}]
 */
function parseCollapseRanges(spec: string): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  // Normalize whitespace around `-` so `5 - 12` parses correctly (mirrors parseRanges).
  const normalized = spec.replace(/\s*-\s*/g, '-');
  for (const part of normalized.split(/[\s,]+/)) {
    if (!part) continue;
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    out.push({ from: Math.min(start, end), to: Math.max(start, end) });
  }
  return out.sort((a, b) => a.from - b.from);
}

function unescapeRegex(s: string): string {
  return s.replace(/\\\//g, '/').replace(/\\\\/g, '\\');
}
