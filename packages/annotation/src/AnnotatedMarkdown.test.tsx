import { asset } from '@contextbridge/shared/testFactories';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { AnnotatedMarkdown, annotatedMarkdownTestIds } from './AnnotatedMarkdown.tsx';

describe('AnnotatedMarkdown image rendering', () => {
  const fixtureAsset = asset.build({
    id: 'abc123',
    originalPath: '/tmp/fixture.png',
  });

  it('rewrites local-path img srcs to /assets/<id> when a matching asset is provided', () => {
    render(
      <AnnotatedMarkdown
        content="![fixture](/tmp/fixture.png)"
        assets={[fixtureAsset]}
        containerRef={createRef<HTMLDivElement>()}
      />,
    );
    const img = screen.getByAltText('fixture');
    expect(img.getAttribute('src')).toBe('/assets/abc123');
  });

  it('leaves remote img srcs unchanged', () => {
    render(
      <AnnotatedMarkdown
        content="![cat](https://example.com/cat.png)"
        assets={[fixtureAsset]}
        containerRef={createRef<HTMLDivElement>()}
      />,
    );
    const img = screen.getByAltText('cat');
    expect(img.getAttribute('src')).toBe('https://example.com/cat.png');
  });

  it('leaves local-path img srcs unchanged when assets prop is omitted', () => {
    render(<AnnotatedMarkdown content="![diagram](/tmp/missing.png)" containerRef={createRef<HTMLDivElement>()} />);
    const img = screen.getByAltText('diagram');
    expect(img.getAttribute('src')).toBe('/tmp/missing.png');
  });
});

describe('AnnotatedMarkdown syntax highlighting', () => {
  it('renders fenced code with Shiki token spans while preserving the annotatable pre', () => {
    const { container: rendered } = render(
      <AnnotatedMarkdown
        content={'```typescript\nconst answer: number = 42;\n```'}
        containerRef={createRef<HTMLDivElement>()}
        themeId="dracula"
      />,
    );

    const container = rendered.querySelector<HTMLElement>(`[data-testid="${annotatedMarkdownTestIds.container}"]`)!;
    const pre = container.querySelector('pre');
    const tokens = container.querySelectorAll('.shiki-token');

    expect(pre).toHaveAttribute('data-target-kind', 'code-block');
    expect(pre).toHaveAttribute('data-src-start-line', '1');
    expect(pre).toHaveAttribute('data-src-end-line', '3');
    expect(pre).toHaveClass('bg-[var(--code-background)]');
    expect(tokens.length).toBeGreaterThan(0);
    expect(Array.from(tokens).every((token) => token.textContent === token.textContent?.trim())).toBe(true);
    expect((tokens[0] as HTMLElement).style.color).not.toBe('');
  });

  it('leaves adapter-owned code blocks un-tokenized', () => {
    const { container: rendered } = render(
      <AnnotatedMarkdown content={'```mermaid\ngraph TD\n  A --> B\n```'} containerRef={createRef<HTMLDivElement>()} />,
    );

    expect(rendered.querySelector('.shiki-token')).toBeNull();
  });
});
