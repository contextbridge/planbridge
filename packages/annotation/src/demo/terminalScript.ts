import type { TerminalHandle } from './TerminalWindow.tsx';

export async function streamLines(term: TerminalHandle, lines: readonly string[], perLineMs = 220): Promise<void> {
  for (const line of lines) {
    term.writeln(line);
    await sleep(perLineMs);
  }
}

export function dumpLines(term: TerminalHandle, lines: readonly string[]): void {
  for (const line of lines) {
    term.writeln(line);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
