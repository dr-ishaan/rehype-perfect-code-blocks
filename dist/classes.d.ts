/**
 * Exported CSS class name constants (v2.3.0).
 *
 * Use these in your code for programmatic class targeting:
 *
 * ```ts
 * import { CLASSES } from '@dr-ishaan/rehype-perfect-code-blocks';
 *
 * document.querySelector(`.${CLASSES.COPY_BUTTON}`).addEventListener(...)
 * ```
 */
export declare const CLASSES: {
    readonly CONTAINER: "pcb";
    readonly HEADER_BAR: "pcb__bar";
    readonly TITLE: "pcb__title";
    readonly DOTS: "pcb__dots";
    readonly LANGUAGE_BADGE: "pcb__lang";
    readonly COPY_BUTTON: "pcb__copy";
    readonly COPY_LABEL: "pcb__copy-label";
    readonly COPY_DONE: "pcb__copy--done";
    readonly BODY: "pcb__body";
    readonly LINE: "pcb__line";
    readonly LINE_NUMBER: "pcb__ln";
    readonly CODE: "pcb__code";
    readonly LINE_HIGHLIGHT: "pcb__line--hl";
    readonly LINE_ADD: "pcb__line--add";
    readonly LINE_DEL: "pcb__line--del";
    readonly LINE_FOCUS: "pcb__line--focus";
    readonly LINE_ERROR: "pcb__line--error";
    readonly LINE_WARNING: "pcb__line--warning";
    readonly LINE_INFO: "pcb__line--info";
    readonly WORD: "pcb__word";
    readonly WORD_DIFF: "pcb__word-diff";
    readonly WORD_DIFF_ADD: "pcb__word-diff--add";
    readonly WORD_DIFF_DEL: "pcb__word-diff--del";
    readonly CAPTION: "pcb__caption";
    readonly ATTRIBUTION: "pcb__attribution";
    readonly ANNOTATION: "pcb__ann";
    readonly PRESET_TERMINAL: "pcb--terminal";
    readonly PRESET_MINIMAL: "pcb--minimal";
    readonly PRESET_RETRO: "pcb--retro";
    readonly WRAP: "pcb--wrap";
    readonly COLLAPSE: "pcb--collapse";
    readonly COPY_ON_HOVER: "pcb--copy-on-hover";
    readonly SPLIT_DIFF: "pcb--split-diff";
    readonly ANNOTATIONS: "pcb--annotations";
    readonly TABLE: "pcb__table";
    readonly TABLE_HEADER: "pcb__th";
    readonly TABLE_ROW: "pcb__tr";
    readonly TABLE_CELL: "pcb__td";
    readonly MATH: "pcb__math";
    readonly MATH_KATEX: "pcb__math--katex";
    readonly MATH_FALLBACK: "pcb__math--fallback";
    readonly SR_LIVE: "pcb__sr-live";
    readonly SR_ONLY: "pcb__sr-only";
};
export type ClassName = keyof typeof CLASSES;
//# sourceMappingURL=classes.d.ts.map