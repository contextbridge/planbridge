import { type ITerminalOptions, Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'react';

export interface TerminalHandle {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
}

declare global {
  interface Window {
    __demoTerminal?: TerminalHandle;
  }
}

interface TerminalWindowProps {
  cols?: number;
  rows?: number;
}

const claudeCodeTheme: ITerminalOptions['theme'] = {
  background: '#0e0e10',
  foreground: '#e6e6e6',
  cursor: '#d97706',
  cursorAccent: '#0e0e10',
  selectionBackground: '#3a3a40',
  black: '#0e0e10',
  red: '#f43f5e',
  green: '#22c55e',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#d97baf',
  cyan: '#22d3ee',
  white: '#e6e6e6',
  brightBlack: '#52525b',
  brightRed: '#fb7185',
  brightGreen: '#4ade80',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#f0abfc',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa',
};

export function TerminalWindow({ cols = 125, rows = 39 }: TerminalWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cols,
      rows,
      fontFamily: '"IBM Plex Mono", Menlo, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: claudeCodeTheme,
      convertEol: true,
      disableStdin: true,
      allowTransparency: false,
      scrollback: 200,
    });
    term.open(container);

    const handle: TerminalHandle = {
      write: (data) => term.write(data),
      writeln: (data) => term.writeln(data),
      clear: () => term.clear(),
    };
    window.__demoTerminal = handle;

    return () => {
      if (window.__demoTerminal === handle) {
        delete window.__demoTerminal;
      }
      term.dispose();
    };
  }, [cols, rows]);

  return <div ref={containerRef} className="h-full w-full p-3" />;
}
