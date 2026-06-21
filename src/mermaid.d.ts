/** Minimal type declaration for mermaid (optional peer dependency). */
declare module 'mermaid' {
  export interface MermaidConfig { [key: string]: unknown; }
  export function render(id: string, text: string): Promise<string>;
  export function initialize(config?: MermaidConfig): void;
  const _default: {
    render: typeof render;
    initialize: typeof initialize;
  };
  export default _default;
}
