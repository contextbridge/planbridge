import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSubmitOnCmdEnter } from './useSubmitOnCmdEnter.ts';

describe('useSubmitOnCmdEnter', () => {
  it('submits on Cmd+Enter and prevents default', () => {
    const onSubmit = vi.fn();
    const preventDefault = vi.fn();
    const handler = useSubmitOnCmdEnter(onSubmit);

    handler(buildKeyEvent({ key: 'Enter', metaKey: true, preventDefault }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('submits on Ctrl+Enter', () => {
    const onSubmit = vi.fn();
    const handler = useSubmitOnCmdEnter(onSubmit);

    handler(buildKeyEvent({ key: 'Enter', ctrlKey: true }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit on plain Enter', () => {
    const onSubmit = vi.fn();
    const preventDefault = vi.fn();
    const handler = useSubmitOnCmdEnter(onSubmit);

    handler(buildKeyEvent({ key: 'Enter', preventDefault }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignores other keys even with modifiers', () => {
    const onSubmit = vi.fn();
    const handler = useSubmitOnCmdEnter(onSubmit);

    handler(buildKeyEvent({ key: 's', metaKey: true }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

function buildKeyEvent(init: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  preventDefault?: () => void;
}): KeyboardEvent<HTMLTextAreaElement> {
  return {
    key: init.key,
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    preventDefault: init.preventDefault ?? (() => {}),
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
}
