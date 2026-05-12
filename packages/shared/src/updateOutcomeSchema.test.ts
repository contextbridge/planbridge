import { describe, expect, it } from 'bun:test';
import { UpdateOutcomeSchema } from './updateOutcomeSchema.ts';

describe('UpdateOutcomeSchema', () => {
  it('parses a success outcome', () => {
    const parsed = UpdateOutcomeSchema.parse({ status: 'success' });
    expect(parsed).toEqual({ status: 'success' });
  });

  it('parses a recoverable failure outcome', () => {
    const parsed = UpdateOutcomeSchema.parse({
      status: 'failed',
      message: 'install method unknown',
      recoverable: true,
    });
    expect(parsed).toEqual({ status: 'failed', message: 'install method unknown', recoverable: true });
  });

  it('parses an unrecoverable failure outcome', () => {
    const parsed = UpdateOutcomeSchema.parse({
      status: 'failed',
      message: 'updates disabled in this environment',
      recoverable: false,
    });
    expect(parsed).toEqual({
      status: 'failed',
      message: 'updates disabled in this environment',
      recoverable: false,
    });
  });

  it('rejects a failed outcome with an empty message', () => {
    const result = UpdateOutcomeSchema.safeParse({ status: 'failed', message: '   ', recoverable: true });
    expect(result.success).toBe(false);
  });

  it('rejects a failed outcome missing the recoverable flag', () => {
    const result = UpdateOutcomeSchema.safeParse({ status: 'failed', message: 'oops' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown status', () => {
    const result = UpdateOutcomeSchema.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });
});
