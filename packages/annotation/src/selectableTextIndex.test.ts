import { describe, expect, it } from 'vitest';
import { buildSelectableTextIndex } from './selectableTextIndex.ts';

describe('buildSelectableTextIndex', () => {
  it('walks annotatable elements and assigns target ids', () => {
    const container = renderContainer(
      `<p data-target-kind="block" data-target-key="p">First paragraph.</p>` +
        `<p data-target-kind="block" data-target-key="p">Second paragraph.</p>`,
    );

    const index = buildSelectableTextIndex(container);

    const targetIds = [...index.targets.keys()];
    expect(targetIds).toHaveLength(2);
    expect(targetIds[0]?.startsWith('p:0:')).toBe(true);
    expect(targetIds[1]?.startsWith('p:1:')).toBe(true);

    const first = index.resolveTarget(targetIds[0]!);
    expect(first?.label).toBe('Paragraph: "First paragraph."');
    expect(first?.text).toBe('First paragraph.');
  });

  it('writes data-target-id on each annotatable element', () => {
    const container = renderContainer(`<p data-target-kind="block" data-target-key="p">Hello world.</p>`);

    buildSelectableTextIndex(container);

    const p = container.querySelector('p')!;
    expect(p.dataset.targetId).toMatch(/^p:0:[0-9a-f]{8}$/);
  });
});

describe('rangeToAnchor', () => {
  it('captures quote, position, endpoints, target, snapshot, and sourceLines for a drag in a paragraph', () => {
    const container = renderContainer(
      `<p data-target-kind="block" data-target-key="p" data-src-start-line="3" data-src-end-line="3">Start by refactoring the parser before touching the API.</p>`,
    );
    const index = buildSelectableTextIndex(container);

    const paragraph = container.querySelector('p')!;
    const textNode = paragraph.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 9);
    range.setEnd(textNode, 31);

    const anchor = index.rangeToAnchor(range, 'drag');

    expect(anchor.createdFrom).toBe('drag');
    expect(anchor.sourceLines).toEqual({ start: 3, end: 3 });
    expect(anchor.quote.exact).toBe('refactoring the parser');
    expect(anchor.quote.prefix.endsWith('Start by ')).toBe(true);
    expect(anchor.quote.suffix.startsWith(' before')).toBe(true);
    expect(anchor.position).toEqual({ start: 9, end: 31 });
    expect(anchor.endpoints.start.targetId).toBe(anchor.endpoints.end.targetId);
    expect(anchor.endpoints.start.offset).toBe(9);
    expect(anchor.endpoints.end.offset).toBe(31);
    expect(anchor.target?.kind).toBe('block');
    expect(anchor.snapshot.targetText).toContain('Start by refactoring');
  });

  it('populates snapshot.blockText for inline targets via the surrounding block', () => {
    const container = renderContainer(
      `<p data-target-kind="block" data-target-key="p" data-src-start-line="5" data-src-end-line="5">Keep the <strong data-target-kind="inline" data-target-key="strong" data-src-start-line="5" data-src-end-line="5">migration path</strong> clear.</p>`,
    );
    const index = buildSelectableTextIndex(container);

    const strong = container.querySelector('strong')!;
    const textNode = strong.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, textNode.data.length);

    const anchor = index.rangeToAnchor(range, 'element', strong);

    expect(anchor.createdFrom).toBe('element');
    expect(anchor.target?.kind).toBe('inline');
    expect(anchor.snapshot.targetText).toBe('migration path');
    expect(anchor.snapshot.blockText).toBe('Keep the migration path clear.');
  });
});

describe('restoreAnchor', () => {
  it('round-trips a drag anchor back to the same range', () => {
    const container = renderContainer(
      `<p data-target-kind="block" data-target-key="p" data-src-start-line="3" data-src-end-line="3">Start by refactoring the parser before touching the API.</p>`,
    );
    const index = buildSelectableTextIndex(container);

    const textNode = container.querySelector('p')!.firstChild as Text;
    const source = document.createRange();
    source.setStart(textNode, 9);
    source.setEnd(textNode, 31);

    const anchor = index.rangeToAnchor(source, 'drag');
    const restored = index.restoreAnchor(anchor);

    expect(restored).not.toBeNull();
    expect(restored!.toString()).toBe('refactoring the parser');
  });

  it('falls back to the quote selector when target ids and positions are stale', () => {
    const container = renderContainer(
      `<p data-target-kind="block" data-target-key="p">Start by refactoring the parser before touching the API.</p>`,
    );
    const index = buildSelectableTextIndex(container);

    const originalTargetId = [...index.targets.keys()][0]!;
    const anchor = {
      kind: 'text' as const,
      createdFrom: 'drag' as const,
      sourceLines: { start: 1, end: 1 },
      quote: { exact: 'refactoring the parser', prefix: 'Start by ', suffix: ' before' },
      position: { start: 9999, end: 10000 },
      endpoints: {
        start: { targetId: 'stale:0:deadbeef', offset: 9 },
        end: { targetId: 'stale:0:deadbeef', offset: 31 },
      },
      target: { id: originalTargetId, kind: 'block' as const, label: 'Paragraph' },
      snapshot: { targetText: 'dummy' },
    };

    const restored = index.restoreAnchor(anchor);
    expect(restored).not.toBeNull();
    expect(restored!.toString()).toBe('refactoring the parser');
  });

  it('returns null when no selector can resolve', () => {
    const container = renderContainer(`<p data-target-kind="block" data-target-key="p">Some other text here.</p>`);
    const index = buildSelectableTextIndex(container);

    const anchor = {
      kind: 'text' as const,
      createdFrom: 'drag' as const,
      sourceLines: { start: 1, end: 1 },
      quote: { exact: 'not present', prefix: '', suffix: '' },
      position: { start: 9999, end: 10000 },
      endpoints: {
        start: { targetId: 'gone:0:00000000', offset: 0 },
        end: { targetId: 'gone:0:00000000', offset: 1 },
      },
      snapshot: { targetText: 'dummy' },
    };

    expect(index.restoreAnchor(anchor)).toBeNull();
  });
});

function renderContainer(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.innerHTML = '';
  document.body.appendChild(container);
  return container;
}
