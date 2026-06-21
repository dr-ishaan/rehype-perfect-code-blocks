/**
 * Diagram & table rendering (v2.3.0).
 *
 * - Mermaid: render ```mermaid blocks as SVG diagrams
 * - CSV/TSV: render ```csv / ```tsv blocks as HTML tables
 *
 * Both are build-time (server-side) — no client JS needed.
 * `mermaid` is an optional peer dependency.
 */
/** Languages that trigger Mermaid rendering. */
export const MERMAID_LANGS = new Set(['mermaid', 'mmd']);
/** Languages that trigger CSV/TSV table rendering. */
export const CSV_LANGS = new Set(['csv']);
export const TSV_LANGS = new Set(['tsv']);
export function isMermaidLanguage(lang) {
    return MERMAID_LANGS.has(lang.toLowerCase());
}
export function isCsvLanguage(lang) {
    return CSV_LANGS.has(lang.toLowerCase()) || TSV_LANGS.has(lang.toLowerCase());
}
/**
 * Render a Mermaid diagram to SVG.
 * Falls back to a `<pre>` with the source if mermaid is not installed.
 */
export async function renderMermaid(source) {
    try {
        const mermaid = await import('mermaid');
        // mermaid v10+ uses mermaid.default.render()
        const m = mermaid.default ?? mermaid;
        if (typeof m.render === 'function') {
            const id = 'pcb-mermaid-' + Math.random().toString(36).slice(2, 10);
            const svg = await m.render(id, source.trim());
            return { svg, isError: false };
        }
    }
    catch {
        // mermaid not installed or rendering failed
    }
    return { svg: null, isError: true };
}
/**
 * Parse CSV/TSV text into rows of cells.
 */
export function parseCsv(text, delimiter = ',') {
    const rows = [];
    for (const line of text.split('\n')) {
        if (line.trim() === '')
            continue;
        rows.push(line.split(delimiter).map((cell) => cell.trim()));
    }
    return rows;
}
/**
 * Build a HAST element tree for a CSV/TSV table.
 * First row is the header (in `<thead>`), remaining rows in `<tbody>`.
 */
export function buildCsvTable(text, delimiter = ',') {
    const rows = parseCsv(text, delimiter);
    const children = [];
    if (rows.length > 0) {
        // Header
        const headerCells = rows[0].map((cell) => ({
            type: 'element',
            tagName: 'th',
            properties: { className: ['pcb__th'] },
            children: [{ type: 'text', value: cell }],
        }));
        children.push({
            type: 'element',
            tagName: 'thead',
            properties: {},
            children: [{
                    type: 'element',
                    tagName: 'tr',
                    properties: { className: ['pcb__tr'] },
                    children: headerCells,
                }],
        });
        // Body
        const bodyRows = rows.slice(1).map((row) => ({
            type: 'element',
            tagName: 'tr',
            properties: { className: ['pcb__tr'] },
            children: row.map((cell) => ({
                type: 'element',
                tagName: 'td',
                properties: { className: ['pcb__td'] },
                children: [{ type: 'text', value: cell }],
            })),
        }));
        children.push({
            type: 'element',
            tagName: 'tbody',
            properties: {},
            children: bodyRows,
        });
    }
    return {
        type: 'element',
        tagName: 'table',
        properties: { className: ['pcb__table'] },
        children,
    };
}
/** ASCII art language defaults — disable ligatures for alignment. */
export const DEFAULT_ASCII_ART_LANGS = ['text', 'plaintext', 'txt', 'ascii', 'plain'];
/**
 * Check if a language should be treated as ASCII art (ligatures disabled).
 */
export function isAsciiArtLang(lang, asciiArtLangs) {
    const set = new Set(asciiArtLangs.map((l) => l.toLowerCase()));
    return set.has(lang.toLowerCase());
}
//# sourceMappingURL=diagrams.js.map