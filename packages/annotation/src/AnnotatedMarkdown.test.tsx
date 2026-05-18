import { asset } from '@contextbridge/shared/testFactories';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { AnnotatedMarkdown } from './AnnotatedMarkdown.tsx';

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
