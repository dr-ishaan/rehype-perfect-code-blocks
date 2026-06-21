/**
 * rehype-perfect-code-blocks — rehype plugin entry.
 *
 * Usage (standalone):
 *
 *   import { rehypePerfectCodeBlocks } from 'rehype-perfect-code-blocks';
 *
 *   unified()
 *     .use(remarkParse)
 *     .use(remarkPreserveCodeMeta)
 *     .use(remarkRehype)
 *     .use(rehypePerfectCodeBlocks, { decorations: true, copyButton: true })
 *     .use(rehypeStringify)
 *     .process(markdown);
 *
 * For Astro, use `rehype-perfect-code-blocks/astro` instead — it wraps this
 * plugin with style/script injection and automatic Shiki integration.
 */

import type { Plugin } from 'unified';
import type { Root } from 'hast';
import { rehypePerfectCodeBlocks as transformer } from './transformer.js';
import { runShikiOnRawBlocks, disposeHighlighter, runHighlighterTask } from './shiki.js';
import { remarkPreserveCodeMeta } from './remark.js';
import { wordDiff, hasChanges } from './word-diff.js';
import type { DiffToken } from './word-diff.js';
import { generateTokenStyles, applyScopeToCss, generateDarkModeSelector, generateLightModeSelector } from './tokens.js';
import type { DesignTokens } from './tokens.js';
import { resolveMathOptions, isMathLanguage, renderMath } from './math.js';
import type { MathOptions, ResolvedMathOptions } from './math.js';
import { runDevWarnings, warnUnknownLanguage } from './dev-warnings.js';
import { isMermaidLanguage, isCsvLanguage, buildCsvTable, parseCsv, renderMermaid } from './diagrams.js';
import { CLASSES } from './classes.js';
import type { PerfectCodeOptions } from './types.js';

export { remarkPreserveCodeMeta };
export { disposeHighlighter, runHighlighterTask };
export { wordDiff, hasChanges };
export { generateTokenStyles, applyScopeToCss, generateDarkModeSelector, generateLightModeSelector };
export { resolveMathOptions, isMathLanguage, renderMath };
export { runDevWarnings, warnUnknownLanguage };
export { isMermaidLanguage, isCsvLanguage, buildCsvTable, parseCsv, renderMermaid };
export { CLASSES };
export type { DiffToken, DesignTokens, MathOptions, ResolvedMathOptions };

export const rehypePerfectCodeBlocks: Plugin<[PerfectCodeOptions?], Root> =
  (options = {}) => {
    const engine = options.engine ?? 'auto';
    const opts = options;

    return async (tree) => {
      // 1. If engine is 'shiki' or 'auto' fallback, tokenize raw <pre><code> first.
      //    This also passes `transformers` and `meta: { __raw }` to Shiki so the
      //    official @shikijs/transformers (diff, focus, highlight, error, word)
      //    work out of the box.
      if (engine === 'shiki' || engine === 'auto') {
        await runShikiOnRawBlocks(tree, resolveDefaults(opts));
      }
      // 'passthrough' → do nothing, assume caller has tokenized.

      // 2. Wrap each <pre> in a styled <figure>.
      const transform = transformer(opts);
      await transform(tree);
    };
  };

export default rehypePerfectCodeBlocks;

/**
 * Resolve defaults WITHOUT using TS's `Required<...>` (which forces every
 * field to be non-undefined, including function hooks that should default
 * to no-op). This preserves the runtime-friendly defaults.
 */
function resolveDefaults(opts: PerfectCodeOptions): Required<PerfectCodeOptions> {
  const userShiki = opts.shiki ?? {};
  const userCopyButton = opts.copyButton;
  let copyButtonLabel = 'copy';
  let copyButtonDoneLabel = 'copied!';
  let resolvedCopyButton: PerfectCodeOptions['copyButton'] = true;

  if (typeof userCopyButton === 'object' && userCopyButton !== null) {
    resolvedCopyButton = {
      visibility: 'always',
      feedbackDuration: 1600,
      copyIcon: undefined,
      successIcon: undefined,
      label: 'copy',
      doneLabel: 'copied!',
      ...userCopyButton,
    };
    copyButtonLabel = resolvedCopyButton.label ?? 'copy';
    copyButtonDoneLabel = resolvedCopyButton.doneLabel ?? 'copied!';
  } else {
    resolvedCopyButton = userCopyButton ?? true;
    copyButtonLabel = opts.copyButtonLabel ?? 'copy';
    copyButtonDoneLabel = opts.copyButtonDoneLabel ?? 'copied!';
  }

  return {
    decorations: opts.decorations ?? true,
    showLanguage: opts.showLanguage ?? true,
    copyButton: resolvedCopyButton,
    copyButtonLabel,
    copyButtonDoneLabel,
    lineNumbers: opts.lineNumbers ?? 'auto',
    titleBar: opts.titleBar ?? 'auto',
    lineNumbersStart: opts.lineNumbersStart ?? 1,
    highlight: opts.highlight ?? true,
    diff: opts.diff ?? true,
    wordDiff: opts.wordDiff ?? false,
    focus: opts.focus ?? true,
    errorLevels: opts.errorLevels ?? true,
    wrap: opts.wrap ?? false,
    collapseAfter: opts.collapseAfter ?? null,
    collapseRanges: opts.collapseRanges ?? null,
    collapseStyle: opts.collapseStyle ?? 'github',
    showWhitespace: opts.showWhitespace ?? false,
    indentGuides: opts.indentGuides ?? false,
    caption: opts.caption ?? true,
    engine: opts.engine ?? 'auto',
    shiki: {
      theme: { light: 'github-light', dark: 'github-dark' },
      langs: [],
      transformers: [],
      transformerOrder: 'after',
      ...userShiki,
    },
    keepBackground: opts.keepBackground ?? false,
    styleToClass: opts.styleToClass ?? false,
    useHastApi: opts.useHastApi ?? true,
    disableAutoTransformers: opts.disableAutoTransformers ?? false,
    removeComments: opts.removeComments ?? false,
    removeLineBreaks: opts.removeLineBreaks ?? false,
    zeroIndexed: opts.zeroIndexed ?? false,
    lineOptions: opts.lineOptions ?? [],
    customNotations: opts.customNotations ?? {},
    magicComments: opts.magicComments ?? [
      {
        className: 'pcb__line--hl',
        line: 'highlight-next-line',
        block: { start: 'highlight-start', end: 'highlight-end' },
      },
    ],
    inlineCode: opts.inlineCode ?? false,
    inlineDefaultLang: opts.inlineDefaultLang ?? opts.defaultInlineLang ?? '',
    defaultInlineLang: opts.defaultInlineLang ?? opts.inlineDefaultLang ?? '',
    tokensMap: opts.tokensMap ?? {},
    terminalLangs: opts.terminalLangs ?? ['sh', 'bash', 'zsh', 'shell', 'console', 'powershell', 'bat', 'cmd', 'fish', 'ansi'],
    extractFileNameFromCode: opts.extractFileNameFromCode ?? false,
    languageLabels: opts.languageLabels ?? {},
    languageAliases: opts.languageAliases ?? {},
    defaultBlockLang: opts.defaultBlockLang ?? '',
    tabWidth: opts.tabWidth ?? 0,
    copyStripComments: opts.copyStripComments ?? true,
    accessibleScroll: opts.accessibleScroll ?? true,
    announceCopy: opts.announceCopy ?? true,
    hideCopyWithoutJs: opts.hideCopyWithoutJs ?? true,
    terminalSrOnlyTitle: opts.terminalSrOnlyTitle ?? true,
    rehypePlugins: opts.rehypePlugins ?? [],
    filterMetaString: opts.filterMetaString ?? ((s) => s),
    onVisitLine: opts.onVisitLine ?? (() => {}),
    onVisitHighlightedLine: opts.onVisitHighlightedLine ?? (() => {}),
    onVisitHighlightedChars: opts.onVisitHighlightedChars ?? (() => {}),
    onVisitTitle: opts.onVisitTitle ?? (() => {}),
    onVisitCaption: opts.onVisitCaption ?? (() => {}),
    texts: opts.texts ?? {},
    logger: opts.logger ?? console,
    cspNonce: opts.cspNonce ?? '',
    preset: opts.preset ?? 'default',
    injectStyles: opts.injectStyles ?? true,
    theme: opts.theme ?? 'auto',
    // v2.0.0: CSS Architecture options
    cssInjection: opts.cssInjection ?? 'inline',
    cssLayer: opts.cssLayer ?? 'pcb',
    tokens: opts.tokens ?? (undefined as unknown as NonNullable<typeof opts.tokens>),
    darkMode: opts.darkMode ?? (undefined as unknown as NonNullable<typeof opts.darkMode>),
    scope: opts.scope ?? (undefined as unknown as string),
    // v2.1.0: P1 features
    math: opts.math ?? (undefined as unknown as NonNullable<typeof opts.math>),
    devWarnings: opts.devWarnings ?? (process.env.NODE_ENV !== 'production'),
    // v2.2.0: Phase 3
    diffMode: opts.diffMode ?? 'unified',
    annotations: opts.annotations ?? false,
    attribution: opts.attribution ?? false,
    // v2.3.0: P2
    mermaid: opts.mermaid ?? false,
    csvTables: opts.csvTables ?? false,
    asciiArtLangs: opts.asciiArtLangs ?? ['text', 'plaintext', 'txt', 'ascii', 'plain'],
    // v2.4.0: Community patterns
    cssVariablesTheme: opts.cssVariablesTheme ?? false,
    watchModeCache: opts.watchModeCache ?? true,
    colorizedBrackets: opts.colorizedBrackets ?? false,
    classActiveCode: opts.classActiveCode ?? true,
    shikiSingleton: opts.shikiSingleton ?? false,
    languageIcons: opts.languageIcons ?? false,
    inline: opts.inline ?? false,
  };
}
