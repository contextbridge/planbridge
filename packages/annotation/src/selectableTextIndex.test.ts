import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderAnnotatedMarkdown, textRange } from '#src/testHelpers/index.tsx';
import { buildSelectableTextIndex } from './selectableTextIndex.ts';

afterEach(() => {
  cleanup();
});

describe('buildSelectableTextIndex', () => {
  it('walks annotatable elements and assigns target ids', () => {
    const container = renderAnnotatedMarkdown('First paragraph.\n\nSecond paragraph.');

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
    const container = renderAnnotatedMarkdown('Hello world.');

    buildSelectableTextIndex(container);

    const p = container.querySelector('p')!;
    expect(p.dataset.targetId).toMatch(/^p:0:[0-9a-f]{8}$/);
  });

  it('keeps repeated blocks in separate parents distinct when rebuilding the index', () => {
    const container = renderAnnotatedMarkdown('> Repeated paragraph.\n\n> Repeated paragraph.');
    const elements = [...container.querySelectorAll<HTMLElement>('[data-target-kind]')];
    const index = buildSelectableTextIndex(container);
    const targetIds = elements.map((element) => element.dataset.targetId!);

    expect(container.querySelectorAll('blockquote')).toHaveLength(2);
    expect(index.targets.size).toBe(elements.length);
    expect(new Set(targetIds).size).toBe(elements.length);
    for (const element of elements) {
      expect(index.resolveTarget(element.dataset.targetId!)?.element).toBe(element);
    }

    const rebuiltIndex = buildSelectableTextIndex(container);
    expect([...rebuiltIndex.targets.keys()]).toEqual(targetIds);
  });
});

describe('rangeToAnchor', () => {
  it('captures quote, position, endpoints, target, snapshot, and sourceLines for a drag in a paragraph', () => {
    const container = renderAnnotatedMarkdown('Start by refactoring the parser before touching the API.');
    const index = buildSelectableTextIndex(container);

    const textNode = container.querySelector('p')!.firstChild as Text;
    const anchor = index.rangeToAnchor(textRange({ node: textNode, from: 9, to: 31 }), 'drag');

    expect(anchor.createdFrom).toBe('drag');
    expect(anchor.sourceLines).toEqual({ start: 1, end: 1 });
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
    const container = renderAnnotatedMarkdown('Keep the **migration path** clear.');
    const index = buildSelectableTextIndex(container);

    const strong = container.querySelector('strong')!;
    const anchor = index.rangeToAnchor(textRange({ node: strong.firstChild as Text }), 'element', strong);

    expect(anchor.createdFrom).toBe('element');
    expect(anchor.target?.kind).toBe('inline');
    expect(anchor.snapshot.targetText).toBe('migration path');
    expect(anchor.snapshot.blockText).toBe('Keep the migration path clear.');
  });
});

describe('restoreAnchor', () => {
  it.each([
    { key: 'strong', markdown: '**After**' },
    { key: 'em', markdown: '*After*' },
    { key: 'a', markdown: '[After](https://example.com)' },
  ])('restores each occurrence of repeated $key text across blocks to its original node', ({ key, markdown }) => {
    const container = renderAnnotatedMarkdown(`${markdown}\n\nSome context between them.\n\n${markdown}`);
    const index = buildSelectableTextIndex(container);

    for (const element of container.querySelectorAll(key)) {
      const textNode = element.firstChild as Text;

      const anchor = index.rangeToAnchor(textRange({ node: textNode }), 'drag');
      const restored = index.restoreAnchor(anchor);

      expect(restored).not.toBeNull();
      expect(restored!.toString()).toBe('After');
      expect(restored!.startContainer).toBe(textNode);
      expect(restored!.endContainer).toBe(textNode);
      expect(index.resolveTarget(anchor.target!.id)?.element).toBe(element);
    }
  });

  it('round-trips a drag anchor back to the same range', () => {
    const container = renderAnnotatedMarkdown('Start by refactoring the parser before touching the API.');
    const index = buildSelectableTextIndex(container);

    const textNode = container.querySelector('p')!.firstChild as Text;
    const anchor = index.rangeToAnchor(textRange({ node: textNode, from: 9, to: 31 }), 'drag');
    const restored = index.restoreAnchor(anchor);

    expect(restored).not.toBeNull();
    expect(restored!.toString()).toBe('refactoring the parser');
  });

  it('falls back to the quote selector when target ids and positions are stale', () => {
    const container = renderAnnotatedMarkdown('Start by refactoring the parser before touching the API.');
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
    const container = renderAnnotatedMarkdown('Some other text here.');
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
