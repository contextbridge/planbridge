import type { SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import { type ReactNode, useEffect, useState } from 'react';
import { App, type AppProps } from '../App.tsx';
import { TerminalWindow } from './TerminalWindow.tsx';

type InputMode = 'plan' | 'accept';

interface InputBoxApi {
  setMode: (mode: InputMode) => void;
  setContent: (content: string) => void;
  type: (text: string, perCharMs?: number) => Promise<void>;
  clear: () => void;
}

declare global {
  interface Window {
    __demoOpenBrowser?: (payload: SubmissionPayload) => void;
    __demoCloseBrowser?: () => void;
    __demoInputBox?: InputBoxApi;
  }
}

const RULE_WIDTH = 125;

export function DemoStage(_appProps: AppProps) {
  const [payload, setPayload] = useState<SubmissionPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [boxContent, setBoxContent] = useState('');
  const [boxMode, setBoxMode] = useState<InputMode>('plan');

  useEffect(() => {
    window.__demoOpenBrowser = (next) => {
      setPayload(next);
      setIteration((current) => current + 1);
      setOpen(true);
    };
    window.__demoCloseBrowser = () => {
      setOpen(false);
    };
    window.__demoInputBox = {
      setMode: (mode) => setBoxMode(mode),
      setContent: (content) => setBoxContent(content),
      type: async (text, perCharMs = 26) => {
        for (let i = 1; i <= text.length; i += 1) {
          setBoxContent(text.slice(0, i));
          await new Promise((resolve) => {
            setTimeout(resolve, perCharMs);
          });
        }
      },
      clear: () => setBoxContent(''),
    };
    return () => {
      delete window.__demoOpenBrowser;
      delete window.__demoCloseBrowser;
      delete window.__demoInputBox;
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950">
      <div className="absolute top-[10px] left-[40px] flex h-[880px] w-[1080px] flex-col overflow-hidden rounded-lg border border-zinc-700/70 bg-[#0e0e10] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]">
        <WindowChrome title="~/code/stripe-webhooks — claude" />
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <TerminalWindow />
          </div>
          <InputBox content={boxContent} mode={boxMode} />
        </div>
      </div>

      {payload ? (
        <div className="pointer-events-none absolute top-[130px] left-[400px]" aria-hidden={!open}>
          <div
            className={`flex h-[760px] w-[1180px] origin-top-left flex-col overflow-hidden rounded-lg border border-zinc-700/70 bg-background shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] transition-all duration-[350ms] ease-out ${
              open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.97] opacity-0'
            }`}
          >
            <WindowChrome title="PlanBridge" />
            <div className="demo-plan-scroll min-h-0 flex-1 overflow-y-auto">
              <App key={iteration} initialPayload={payload} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WindowChrome({ title }: { title: string }): ReactNode {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-700/60 bg-zinc-900/90 px-4 py-2">
      <span className="h-3 w-3 rounded-full bg-red-500/70" />
      <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
      <span className="h-3 w-3 rounded-full bg-green-500/70" />
      <span className="ml-3 truncate font-mono text-xs text-zinc-400">{title}</span>
    </div>
  );
}

const HORIZ = '─'.repeat(RULE_WIDTH);

function InputBox({ content, mode }: { content: string; mode: InputMode }): ReactNode {
  const accentClass = mode === 'plan' ? 'text-[#4f968c]' : 'text-[#ad8aff]';
  const modeText = mode === 'plan' ? 'plan mode on' : 'accept edits on';
  return (
    <div className="select-none px-3 pt-1 pb-2 font-mono text-[14px] leading-[1.3] text-[#71717a]">
      <div>{HORIZ}</div>
      <div>
        <span className="text-[#71717a]">{'❯ '}</span>
        <span className="text-zinc-100">{content}</span>
      </div>
      <div>{HORIZ}</div>
      <div className="mt-0.5">
        <span className={accentClass}>{'⏵⏵'}</span>
        <span> </span>
        <span className={accentClass}>{modeText}</span>
        <span> </span>
        <span>(shift+tab to cycle)</span>
      </div>
    </div>
  );
}
