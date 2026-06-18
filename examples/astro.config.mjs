// Example astro.config.mjs — rehype-perfect-code-blocks
// Shows every option in one place. Copy what you need; delete what you don't.
import { defineConfig } from 'astro/config';
import perfectCode from 'rehype-perfect-code-blocks/astro';

export default defineConfig({
  integrations: [
    perfectCode({
      /* ---------- Ornaments ---------- */
      decorations: true,        // traffic-light dots in header
      showLanguage: true,       // uppercase language pill
      copyButton: {
        visibility: 'always',   // 'always' | 'hover'
        feedbackDuration: 1600, // ms to show "copied!" state
        label: 'copy',          // null = icon-only
        doneLabel: 'copied!',
        // copyIcon: '<svg>...</svg>',    // override default
        // successIcon: '<svg>...</svg>',
      },

      /* ---------- Structure ---------- */
      lineNumbers: 'auto',      // 'always' | 'never' | 'auto'
      titleBar: 'auto',
      lineNumbersStart: 1,      // global default; per-block: ln{5}

      /* ---------- Modes ---------- */
      highlight: true,          // {1,3-5} + // [!code highlight]
      diff: true,               // +/- + // [!code ++] / [!code --]
      focus: true,              // // [!code focus]
      errorLevels: true,        // // [!code error] / [!code warning]
      wrap: false,
      collapseAfter: null,      // e.g. 40 to auto-collapse long blocks
      showWhitespace: false,    // 'all' | 'boundary' | 'trailing' | 'leading'
      indentGuides: false,      // false | true | number (indent width)
      caption: true,            // caption="..." meta → <figcaption>

      /* ---------- Engine ---------- */
      engine: 'auto',           // 'auto' | 'shiki' | 'passthrough'
      keepBackground: false,    // strip Shiki's inline bg (we own --pcb-bg)
      shiki: {
        theme: { light: 'github-light', dark: 'github-dark' },
        // langs: ['typescript', 'bash'],  // pre-loaded; others lazy-load
        // transformers: [/* your custom Shiki transformers */],
        // getHighlighter: async (opts) => { /* custom factory */ },
      },

      /* ---------- Customization ---------- */
      // customNotations: { 'my-marker': 'pcb__line--custom' },
      magicComments: [
        {
          className: 'pcb__line--hl',
          line: 'highlight-next-line',
          block: { start: 'highlight-start', end: 'highlight-end' },
        },
        // {
        //   className: 'pcb__line--error',
        //   line: 'error-next-line',
        //   block: { start: 'error-start', end: 'error-end' },
        // },
      ],
      // inlineCode: 'lang',     // tokenize `code{:lang}` inline
      // inlineDefaultLang: 'ts',
      // tokensMap: { fn: 'entity.name.function' },
      terminalLangs: ['sh', 'bash', 'zsh', 'shell', 'console', 'powershell', 'bat', 'cmd'],
      extractFileNameFromCode: false,

      /* ---------- Hooks ---------- */
      // filterMetaString: (meta) => meta,
      // onVisitLine: ({ element, lineNumber }) => {},
      // onVisitHighlightedLine: ({ element, lineNumber, id }) => {},
      // onVisitHighlightedChars: ({ element, text, id }) => {},
      // onVisitTitle: (element) => {},
      // onVisitCaption: (element) => {},

      /* ---------- Styling ---------- */
      preset: 'default',        // 'default' | 'terminal' | 'minimal'
      injectStyles: true,       // false = ship your own CSS
      theme: 'auto',            // 'auto' | 'dark' | 'light'
    }),
  ],

  // MDX support gets the same plugin automatically because the integration
  // hooks the markdown config, and Astro applies markdown rehype plugins
  // to MDX by default.
});
