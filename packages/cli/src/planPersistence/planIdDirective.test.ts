import { describe, expect, test } from 'bun:test';
import { extractPlanIdDirective, formatPlanIdDirective, resolvePlanIdInput } from './planIdDirective.ts';

describe('planIdDirective', () => {
  test('formats a marker comment', () => {
    expect(formatPlanIdDirective('plan-1')).toBe('<!-- contextbridge-plan-id: plan-1 -->');
  });

  test('extracts and strips a leading directive', () => {
    const content = `${formatPlanIdDirective('plan-1')}\n# Title\n`;
    expect(extractPlanIdDirective(content)).toEqual({ content: '# Title\n', planId: 'plan-1' });
  });

  test('returns null plan id when no directive is present', () => {
    expect(extractPlanIdDirective('# Title')).toEqual({ content: '# Title', planId: null });
  });

  describe('resolvePlanIdInput', () => {
    test('prefers an explicit plan id and strips a matching directive', () => {
      const content = `${formatPlanIdDirective('plan-1')}\n# Title`;
      const resolved = resolvePlanIdInput({ explicitPlanId: 'plan-1', content })._unsafeUnwrap();
      expect(resolved).toEqual({ content: '# Title', planId: 'plan-1' });
    });

    test('uses the directive plan id when no explicit id is given', () => {
      const content = `${formatPlanIdDirective('plan-2')}\n# Title`;
      expect(resolvePlanIdInput({ content })._unsafeUnwrap().planId).toBe('plan-2');
    });

    test('errors when an explicit id is empty', () => {
      expect(resolvePlanIdInput({ explicitPlanId: '  ', content: '# Title' }).isErr()).toBe(true);
    });

    test('errors on conflicting directives', () => {
      const content = `${formatPlanIdDirective('plan-1')}\n${formatPlanIdDirective('plan-2')}\n# Title`;
      expect(resolvePlanIdInput({ content }).isErr()).toBe(true);
    });

    test('errors when an explicit id contradicts the directive', () => {
      const content = `${formatPlanIdDirective('plan-1')}\n# Title`;
      expect(resolvePlanIdInput({ explicitPlanId: 'plan-2', content }).isErr()).toBe(true);
    });
  });
});
