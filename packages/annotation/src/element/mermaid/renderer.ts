export type MermaidTheme = 'default' | 'dark';

export function currentMermaidTheme(): MermaidTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
}

export interface RenderedMermaid {
  svg: string;
}

// Mermaid is heavy (~3MB of the bundle). Load it lazily so plans without diagrams never pay
// the parse cost. securityLevel 'strict' sanitizes the agent-authored source and strips
// mermaid's own click/href directives so they don't fight our annotation handler.
export async function loadMermaid(theme: MermaidTheme): Promise<typeof import('mermaid').default> {
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme });
  return mermaid;
}

export async function renderMermaid(id: string, source: string, theme: MermaidTheme): Promise<RenderedMermaid> {
  const mermaid = await loadMermaid(theme);
  const { svg } = await mermaid.render(id, source);
  return { svg };
}
