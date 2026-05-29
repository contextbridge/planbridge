import { AppWindow, CheckCircle2, Code2, FileText, type LucideIcon, MessageSquare, TerminalSquare } from 'lucide-react';
import { type Transition, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const DESKTOP_LOOP_HEIGHT = 60;
const MOBILE_LOOP_INSET = 12;

export type FlowVariantId = 'plan' | 'file' | 'last';

interface NodeConfig {
  icon: LucideIcon;
  heading: string;
  chip: string[];
  chipMono?: boolean;
  description: string;
}

export interface FlowVariant {
  id: FlowVariantId;
  tabLabel: string;
  input: NodeConfig;
  pill: { icon: LucideIcon; label: string };
  output: NodeConfig;
}

export const flowVariants: FlowVariant[] = [
  {
    id: 'plan',
    tabLabel: 'Plan-mode collaboration',
    input: { icon: TerminalSquare, heading: 'Coding Agent', chip: ['Plan mode'], description: 'Generates plan' },
    pill: { icon: FileText, label: 'Plan' },
    output: { icon: Code2, heading: 'Coding Agent', chip: ['Accept edits'], description: 'Implements plan' },
  },
  {
    id: 'file',
    tabLabel: 'Precision feedback on a file',
    input: {
      icon: FileText,
      heading: 'You',
      chip: ['/planbridge-open', '$planbridge-open'],
      chipMono: true,
      description: 'Open a file',
    },
    pill: { icon: FileText, label: 'File' },
    output: { icon: Code2, heading: 'Coding Agent', chip: ['Applies notes'], description: 'Revises the file' },
  },
  {
    id: 'last',
    tabLabel: 'Annotate the last message',
    input: {
      icon: MessageSquare,
      heading: 'Coding Agent',
      chip: ['/planbridge-last', '$planbridge-last'],
      chipMono: true,
      description: 'Wrote a reply',
    },
    pill: { icon: MessageSquare, label: 'Message' },
    output: { icon: Code2, heading: 'Coding Agent', chip: ['Revises'], description: 'Revises the reply' },
  },
];

export function UseCaseFlows() {
  const [activeId, setActiveId] = useState<FlowVariantId>('plan');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = flowVariants.find((v) => v.id === activeId);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + flowVariants.length) % flowVariants.length;
    const nextVariant = flowVariants[nextIndex];
    if (!nextVariant) return;
    setActiveId(nextVariant.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="PlanBridge use cases"
        className="flex flex-wrap gap-px bg-foreground border border-foreground"
      >
        {flowVariants.map((variant, index) => {
          const selected = variant.id === activeId;
          return (
            <button
              key={variant.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              type="button"
              id={`flow-tab-${variant.id}`}
              aria-selected={selected}
              aria-controls={`flow-panel-${variant.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(variant.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`flex-1 whitespace-nowrap px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground ${
                selected ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'
              }`}
            >
              {variant.tabLabel}
            </button>
          );
        })}
      </div>

      {active && (
        <div role="tabpanel" id={`flow-panel-${active.id}`} aria-labelledby={`flow-tab-${active.id}`} className="mt-px">
          <ReviewLoopDiagram key={active.id} variant={active} />
        </div>
      )}
    </div>
  );
}

interface Box {
  cx: number;
  cy: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface DesktopLayout {
  size: { w: number; h: number };
  paths: { forward1: string; forward2: string; loop1: string; loop2: string };
  b1: Box;
  b2: Box;
  b3: Box;
}

interface MobileLayout {
  size: { w: number; h: number };
  paths: { forward1: string; forward2: string; loop1: string; loop2: string };
  b1: Box;
  b2: Box;
  b3: Box;
  loopX: number;
  midY: number;
}

export function ReviewLoopDiagram({ variant }: { variant: FlowVariant }) {
  return (
    <div className="w-full max-w-full mx-auto border border-foreground bg-background p-8 md:p-16 overflow-hidden">
      <DesktopDiagram variant={variant} />
      <MobileDiagram variant={variant} />
    </div>
  );
}

function DesktopDiagram({ variant }: { variant: FlowVariant }) {
  const desktopRef = useRef<HTMLDivElement>(null);
  const box1Ref = useRef<HTMLDivElement>(null);
  const box2Ref = useRef<HTMLDivElement>(null);
  const box3Ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<DesktopLayout | null>(null);
  const inView = useInView(desktopRef, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();
  const animate = inView || reduceMotion;
  const target = animate ? 1 : 0;

  useEffect(() => {
    const c = desktopRef.current;
    const b1 = box1Ref.current;
    const b2 = box2Ref.current;
    const b3 = box3Ref.current;
    if (!c || !b1 || !b2 || !b3) return;

    const compute = () => {
      const cr = c.getBoundingClientRect();
      const a = relBox(b1, cr);
      const b = relBox(b2, cr);
      const d = relBox(b3, cr);
      const forward1 = `M ${a.right} ${a.cy} L ${b.left} ${b.cy}`;
      const forward2 = `M ${b.right} ${b.cy} L ${d.left} ${d.cy}`;
      const peak = b.top - DESKTOP_LOOP_HEIGHT;
      const px = (a.cx + b.cx) / 2;
      const loop1 = `M ${b.cx} ${b.top} Q ${b.cx} ${peak} ${px} ${peak}`;
      const loop2 = `M ${px} ${peak} Q ${a.cx} ${peak} ${a.cx} ${a.top}`;
      setLayout({
        size: { w: cr.width, h: cr.height },
        paths: { forward1, forward2, loop1, loop2 },
        b1: a,
        b2: b,
        b3: d,
      });
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(c);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, []);

  const draw = drawTrans(reduceMotion);
  const fade = fadeTrans(reduceMotion);

  return (
    <div ref={desktopRef} className="hidden md:block relative pt-12">
      {layout && (
        <svg
          className="absolute inset-0 pointer-events-none z-0"
          width={layout.size.w}
          height={layout.size.h}
          viewBox={`0 0 ${layout.size.w} ${layout.size.h}`}
          aria-hidden="true"
        >
          <motion.path
            d={layout.paths.forward1}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: target }}
            transition={draw(0.1, 0.5)}
          />
          <motion.path
            d={triangleRight(layout.b2.left, layout.b2.cy)}
            className="fill-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: target }}
            transition={fade(0.6)}
          />
          <motion.path
            d={layout.paths.forward2}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: target }}
            transition={draw(0.4, 0.5)}
          />
          <motion.path
            d={triangleRight(layout.b3.left, layout.b3.cy)}
            className="fill-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: target }}
            transition={fade(0.9)}
          />
          <motion.path
            d={layout.paths.loop1}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: target }}
            transition={draw(0.7, 0.45)}
          />
          <motion.path
            d={layout.paths.loop2}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: target }}
            transition={draw(1.25, 0.45)}
          />
          <motion.path
            d={triangleDown(layout.b1.cx, layout.b1.top)}
            className="fill-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: target }}
            transition={fade(1.7)}
          />
        </svg>
      )}

      {layout && (
        <motion.div
          className="absolute z-20"
          style={{
            top: layout.b1.cy,
            left: (layout.b1.right + layout.b2.left) / 2,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: target }}
          transition={fade(0.5)}
        >
          <InputPill icon={variant.pill.icon} label={variant.pill.label} />
        </motion.div>
      )}

      {layout && (
        <motion.div
          className="absolute z-20"
          style={{
            top: layout.b2.cy,
            left: (layout.b2.right + layout.b3.left) / 2,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: target }}
          transition={fade(0.8)}
        >
          <ApprovePill />
        </motion.div>
      )}

      {layout && (
        <motion.div
          className="absolute z-20"
          style={{
            top: layout.b2.top - DESKTOP_LOOP_HEIGHT,
            left: (layout.b1.cx + layout.b2.cx) / 2,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: target }}
          transition={fade(1.15)}
        >
          <RevisePill />
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-8 relative z-10 mt-16">
        <div className="flex justify-center">
          <div
            ref={box1Ref}
            className="w-full max-w-[240px] bg-background border border-foreground p-8 text-center flex flex-col items-center gap-4"
          >
            <NodeIcon icon={variant.input.icon} />
            <NodeBody node={variant.input} />
          </div>
        </div>

        <div className="flex justify-center">
          <div
            ref={box2Ref}
            className="w-full max-w-[240px] bg-foreground text-background border border-foreground p-8 text-center flex flex-col items-center gap-4"
          >
            <PlanBridgeIcon />
            <PlanBridgeBody />
          </div>
        </div>

        <div className="flex justify-center">
          <div
            ref={box3Ref}
            className="w-full max-w-[240px] bg-background border border-foreground p-8 text-center flex flex-col items-center gap-4"
          >
            <NodeIcon icon={variant.output.icon} />
            <NodeBody node={variant.output} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileDiagram({ variant }: { variant: FlowVariant }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const b1Ref = useRef<HTMLDivElement>(null);
  const b2Ref = useRef<HTMLDivElement>(null);
  const b3Ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<MobileLayout | null>(null);
  const inView = useInView(containerRef, { once: true, margin: '-40px' });
  const reduceMotion = useReducedMotion();
  const animate = inView || reduceMotion;
  const target = animate ? 1 : 0;

  useEffect(() => {
    const c = containerRef.current;
    const b1 = b1Ref.current;
    const b2 = b2Ref.current;
    const b3 = b3Ref.current;
    if (!c || !b1 || !b2 || !b3) return;

    const compute = () => {
      const cr = c.getBoundingClientRect();
      const a = relBox(b1, cr);
      const b = relBox(b2, cr);
      const d = relBox(b3, cr);
      const forward1 = `M ${a.cx} ${a.bottom} L ${b.cx} ${b.top}`;
      const forward2 = `M ${b.cx} ${b.bottom} L ${d.cx} ${d.top}`;
      const loopX = Math.max(MOBILE_LOOP_INSET, a.left / 2);
      const midY = (a.cy + b.cy) / 2;
      const loop1 = `M ${b.left} ${b.cy} Q ${loopX} ${b.cy} ${loopX} ${midY}`;
      const loop2 = `M ${loopX} ${midY} Q ${loopX} ${a.cy} ${a.left} ${a.cy}`;
      setLayout({
        size: { w: cr.width, h: cr.height },
        paths: { forward1, forward2, loop1, loop2 },
        b1: a,
        b2: b,
        b3: d,
        loopX,
        midY,
      });
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(c);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, []);

  const draw = drawTrans(reduceMotion);
  const fade = fadeTrans(reduceMotion);

  return (
    <div ref={containerRef} className="md:hidden relative pt-2">
      {layout && (
        <svg
          className="absolute inset-0 pointer-events-none z-0"
          width={layout.size.w}
          height={layout.size.h}
          viewBox={`0 0 ${layout.size.w} ${layout.size.h}`}
          aria-hidden="true"
        >
          <motion.path
            d={layout.paths.forward1}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: target }}
            transition={draw(0.1, 0.4)}
          />
          <motion.path
            d={triangleDown(layout.b2.cx, layout.b2.top)}
            className="fill-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: target }}
            transition={fade(0.5)}
          />
          <motion.path
            d={layout.paths.forward2}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: target }}
            transition={draw(0.35, 0.4)}
          />
          <motion.path
            d={triangleDown(layout.b3.cx, layout.b3.top)}
            className="fill-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: target }}
            transition={fade(0.75)}
          />
          <motion.path
            d={layout.paths.loop1}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: target }}
            transition={draw(0.6, 0.4)}
          />
          <motion.path
            d={layout.paths.loop2}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: target }}
            transition={draw(1.1, 0.4)}
          />
          <motion.path
            d={triangleRight(layout.b1.left, layout.b1.cy)}
            className="fill-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: target }}
            transition={fade(1.5)}
          />
        </svg>
      )}

      {layout && (
        <motion.div
          className="absolute z-20"
          style={{
            top: (layout.b1.bottom + layout.b2.top) / 2,
            left: layout.b2.cx,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: target }}
          transition={fade(0.4)}
        >
          <InputPill icon={variant.pill.icon} label={variant.pill.label} />
        </motion.div>
      )}

      {layout && (
        <motion.div
          className="absolute z-20"
          style={{
            top: (layout.b2.bottom + layout.b3.top) / 2,
            left: layout.b3.cx,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: target }}
          transition={fade(0.65)}
        >
          <ApprovePill />
        </motion.div>
      )}

      {layout && (
        <motion.div
          className="absolute z-20"
          style={{
            top: layout.midY,
            left: layout.loopX,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: target }}
          transition={fade(0.95)}
        >
          <RevisePill compact />
        </motion.div>
      )}

      <div className="flex flex-col gap-24 pl-20 relative z-10">
        <div
          ref={b1Ref}
          className="bg-background border border-foreground p-6 flex flex-col items-center text-center gap-4"
        >
          <NodeIcon icon={variant.input.icon} />
          <NodeBody node={variant.input} />
        </div>

        <div
          ref={b2Ref}
          className="bg-foreground text-background border border-foreground p-6 flex flex-col items-center text-center gap-4"
        >
          <PlanBridgeIcon />
          <PlanBridgeBody />
        </div>

        <div
          ref={b3Ref}
          className="bg-background border border-foreground p-6 flex flex-col items-center text-center gap-4"
        >
          <NodeIcon icon={variant.output.icon} />
          <NodeBody node={variant.output} />
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

function relBox(el: Element, cr: DOMRect): Box {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - cr.left,
    right: r.right - cr.left,
    top: r.top - cr.top,
    bottom: r.bottom - cr.top,
    cx: (r.left + r.right) / 2 - cr.left,
    cy: (r.top + r.bottom) / 2 - cr.top,
  };
}

function triangleRight(tipX: number, tipY: number): string {
  return `M ${tipX - 10} ${tipY - 7} L ${tipX - 10} ${tipY + 7} L ${tipX} ${tipY} z`;
}

function triangleDown(tipX: number, tipY: number): string {
  return `M ${tipX - 7} ${tipY - 10} L ${tipX + 7} ${tipY - 10} L ${tipX} ${tipY} z`;
}

function drawTrans(reduce: boolean | null) {
  return (delay: number, duration: number): Transition => ({
    duration: reduce ? 0 : duration,
    delay: reduce ? 0 : delay,
    ease: 'easeInOut',
  });
}

function fadeTrans(reduce: boolean | null) {
  return (delay: number): Transition => ({
    duration: reduce ? 0 : 0.3,
    delay: reduce ? 0 : delay,
  });
}

// --- Shared visual atoms ---

function NodeIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="p-2 border border-foreground text-foreground flex-shrink-0">
      <Icon className="w-8 h-8 md:w-6 md:h-6" />
    </div>
  );
}

function NodeBody({ node }: { node: NodeConfig }) {
  return (
    <div>
      <h3 className="font-mono font-bold text-foreground text-base uppercase tracking-tight">{node.heading}</h3>
      <div className="mt-4 flex justify-center">
        <NodeChip lines={node.chip} mono={node.chipMono} />
      </div>
      <p className="text-base text-foreground mt-4 font-sans">{node.description}</p>
    </div>
  );
}

function NodeChip({ lines, mono }: { lines: string[]; mono?: boolean }) {
  return (
    <span
      className={`inline-flex flex-col items-center border border-foreground px-2 py-2 font-mono text-foreground ${
        mono ? 'text-sm gap-0.5' : 'text-base uppercase tracking-[0.16em]'
      }`}
    >
      {lines.map((line) => (
        <span key={line} className="whitespace-nowrap">
          {line}
        </span>
      ))}
    </span>
  );
}

function PlanBridgeIcon() {
  return (
    <div className="p-2 border border-background text-background flex-shrink-0">
      <AppWindow className="w-8 h-8 md:w-6 md:h-6" />
    </div>
  );
}

function PlanBridgeBody() {
  return (
    <div>
      <h3 className="font-mono font-bold text-background text-base uppercase tracking-tight">PlanBridge</h3>
      <p className="text-base text-background mt-4 font-sans">Local browser review</p>
    </div>
  );
}

function InputPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="bg-background px-4 py-2 border border-foreground flex items-center gap-2 text-foreground text-base font-mono font-bold uppercase tracking-tight">
      <Icon className="w-4 h-4" />
      {label}
    </div>
  );
}

function ApprovePill() {
  return (
    <div className="bg-background px-4 py-2 border border-foreground flex items-center gap-2 text-foreground text-base font-mono font-bold uppercase tracking-tight">
      <CheckCircle2 className="w-4 h-4" />
      Approve
    </div>
  );
}

function RevisePill({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`bg-background py-2 border border-foreground flex items-center gap-2 text-foreground text-base font-mono font-bold uppercase tracking-tight ${
        compact ? 'px-4 whitespace-nowrap' : 'px-6'
      }`}
    >
      <MessageSquare className="w-4 h-4" />
      Revise
    </div>
  );
}
