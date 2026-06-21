/**
 * Diagram & table rendering (v2.3.0).
 *
 * - Mermaid: render ```mermaid blocks as SVG diagrams
 * - CSV/TSV: render ```csv / ```tsv blocks as HTML tables
 *
 * Both are build-time (server-side) — no client JS needed.
 * `mermaid` is an optional peer dependency.
 */
import type { Element } from 'hast';
/** Languages that trigger Mermaid rendering. */
export declare const MERMAID_LANGS: Set<string>;
/** Languages that trigger CSV/TSV table rendering. */
export declare const CSV_LANGS: Set<string>;
export declare const TSV_LANGS: Set<string>;
export declare function isMermaidLanguage(lang: string): boolean;
export declare function isCsvLanguage(lang: string): boolean;
/**
 * Render a Mermaid diagram to SVG.
 * Falls back to a `<pre>` with the source if mermaid is not installed.
 */
export declare function renderMermaid(source: string): Promise<{
    svg: string | null;
    isError: boolean;
}>;
/**
 * Parse CSV/TSV text into rows of cells.
 */
export declare function parseCsv(text: string, delimiter?: ',' | '\t'): string[][];
/**
 * Build a HAST element tree for a CSV/TSV table.
 * First row is the header (in `<thead>`), remaining rows in `<tbody>`.
 */
export declare function buildCsvTable(text: string, delimiter?: ',' | '\t'): Element;
/** ASCII art language defaults — disable ligatures for alignment. */
export declare const DEFAULT_ASCII_ART_LANGS: string[];
/**
 * Check if a language should be treated as ASCII art (ligatures disabled).
 */
export declare function isAsciiArtLang(lang: string, asciiArtLangs: string[]): boolean;
//# sourceMappingURL=diagrams.d.ts.map