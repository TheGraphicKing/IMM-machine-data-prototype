import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { STATE_META, STAGE_META, TEAMS } from '../sim/catalog';
import type { MState, Segment, Stage, TeamId } from '../sim/types';
import { cx, dur, planLabel, planStatus, planVar } from '../lib/format';
import { useSim } from '../sim/store';

export const EASE = [0.22, 1, 0.36, 1] as const;

export function useThemeHex() {
  const theme = useSim((s) => s.theme);
  const dark = theme === 'dark';
  return {
    dark,
    run: dark ? '#34C77B' : '#1E9E57',
    idle: dark ? '#FFC233' : '#E5B000',
    mould: dark ? '#5B8DFF' : '#2F6FEB',
    down: dark ? '#FF5A47' : '#D8382B',
    off: dark ? '#4A4F57' : '#9AA0A8',
    fg: dark ? '#FFFFFF' : '#15171A',
    fg2: dark ? '#C9CDD3' : '#4A4F57',
    fg3: dark ? '#8A9099' : '#6B7079',
    fg4: dark ? '#6A7079' : '#9AA0A8',
    line: dark ? '#2A2F36' : '#E3E1DB',
    panel: dark ? '#15181C' : '#FFFFFF',
    panel2: dark ? '#1B1F24' : '#FAF9F6',
    ink: dark ? '#C9CDD3' : '#15171A',
    brand: '#F26A21',
  };
}
export const stateHex = (s: MState, dark: boolean) => (dark ? STATE_META[s].hexDark : STATE_META[s].hexLight);

/** Glass panel with cursor spotlight */
export function Panel({
  title,
  sub,
  right,
  children,
  className,
  bodyClass,
  onClick,
  style,
  id,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClass?: string;
  onClick?: () => void;
  style?: CSSProperties;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <section id={id} ref={ref} onMouseMove={onMove} onClick={onClick} style={style} className={cx('glass spotlight flex min-w-0 flex-col', onClick && 'cursor-pointer', className)}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
          <div className="min-w-0">
            {title && <h3 className="num truncate text-[18px] font-semibold leading-6 text-fg">{title}</h3>}
            {sub && <div className="mt-0.5 text-[12px] text-fg3">{sub}</div>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cx('min-h-0 flex-1 p-4', !!title && 'pt-3', bodyClass)}>{children}</div>
    </section>
  );
}

export function StatePill({ s, label, since, size = 'sm', className }: { s: MState; label?: string; since?: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const v = STATE_META[s].v;
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] font-semibold uppercase tracking-[0.06em]', size === 'sm' && 'h-[22px] px-2 text-[11px]', size === 'md' && 'h-7 px-2.5 text-[12px]', size === 'lg' && 'h-9 px-3 text-[15px]', className)}
      style={{ background: `rgb(var(--${v}) / 0.16)`, color: `rgb(var(--${v}-t, var(--${v})))` }}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {(s === 'DOWN' || s === 'RUN') && <span className="absolute inset-0 animate-pulseRing rounded-full" style={{ background: `rgb(var(--${v}))` }} />}
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: `rgb(var(--${v}))` }} />
      </span>
      {label ?? STATE_META[s].label}
      {since !== undefined && <span className="num font-semibold opacity-90">· {dur(since)}</span>}
    </span>
  );
}

export function PlanChip({ p, className }: { p: number; className?: string }) {
  const st = planStatus(p);
  const v = planVar[st];
  return (
    <span className={cx('inline-flex h-[22px] items-center rounded-[3px] px-2 text-[11px] font-semibold tracking-[0.06em]', className)} style={{ background: `rgb(var(--${v}) / 0.16)`, color: `rgb(var(--${v}-t))` }}>
      {planLabel[st]}
    </span>
  );
}

export const planColor = (p: number) => `rgb(var(--${planVar[planStatus(p)]}))`;
export const planText = (p: number) => `rgb(var(--${planVar[planStatus(p)]}-t))`;

export function TeamDot({ team, className }: { team: TeamId | 'unassigned' | null | undefined; className?: string }) {
  const c = team && team !== 'unassigned' ? TEAMS[team].color : '#D8382B';
  return <span className={cx('inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]', className)} style={{ background: c }} />;
}

export function StageBadge({ stage, team, className }: { stage: Stage; team: TeamId | null; className?: string }) {
  const color = team ? TEAMS[team].color : '#D8382B';
  const cls = stage === 'unassigned' ? 'pat-unassigned' : stage === 'assigned' ? 'pat-assigned' : stage === 'working' ? 'pat-working' : stage === 'spare' ? 'pat-spare' : stage === 'verify' ? 'pat-verify' : '';
  return (
    <span className={cx('inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em]', className)}>
      <span className={cx('h-3 w-5 rounded-[2px]', cls)} style={{ ['--team' as string]: color, background: stage === 'closed' ? 'rgb(var(--run))' : undefined }} />
      <span style={{ color: stage === 'unassigned' ? 'rgb(var(--down-t))' : stage === 'verify' ? 'rgb(var(--idle-t))' : color }}>
        {stage === 'unassigned' ? STAGE_META[stage].short : stage === 'verify' ? 'VERIFY FIX' : `${team ? TEAMS[team].label.split(' ·')[0] : ''} · ${STAGE_META[stage].short}`}
      </span>
    </span>
  );
}

/** Rolling number that animates to new values (≤ 450 ms). */
export function Ticker({ value, format = (n) => String(Math.round(n)), className, style }: { value: number; format?: (n: number) => string; className?: string; style?: CSSProperties }) {
  const calm = useSim((s) => s.calm);
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);
  useEffect(() => {
    if (calm || !Number.isFinite(value)) {
      setShown(value);
      from.current = value;
      return;
    }
    const a = from.current;
    const b = value;
    if (a === b) return;
    const t0 = performance.now();
    const D = 420;
    cancelAnimationFrame(raf.current);
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      const e = 1 - Math.pow(1 - k, 3);
      const v = a + (b - a) * e;
      setShown(v);
      from.current = v;
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, calm]);
  return (
    <span className={cx('num', className)} style={style}>
      {format(shown)}
    </span>
  );
}

export function Kpi({
  label,
  value,
  unit,
  sub,
  tone,
  bar,
  onClick,
  children,
  className,
  dark,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  tone?: 'run' | 'idle' | 'down' | 'mould' | null;
  bar?: { v: number; tone?: string };
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <motion.div whileHover={onClick ? { y: -2 } : undefined} onClick={onClick} className={cx('flex min-w-0 flex-col gap-1.5', onClick && 'cursor-pointer', className)} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className={cx('overline truncate', dark && '!text-[#8A9099]')}>{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[32px] font-bold leading-9" style={tone ? { color: `rgb(var(--${tone}-t))` } : undefined}>
          {value}
        </span>
        {unit && <span className={cx('num text-[16px] font-semibold', dark ? 'text-[#8A9099]' : 'text-fg3')}>{unit}</span>}
      </div>
      {bar && (
        <div className="h-1.5 overflow-hidden rounded-full bg-line/70">
          <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, bar.v))}%` }} transition={{ duration: 0.6, ease: EASE }} style={{ background: bar.tone ?? 'rgb(var(--fg2))' }} />
        </div>
      )}
      {sub && <div className={cx('truncate text-[12px]', dark ? 'text-[#8A9099]' : 'text-fg3')}>{sub}</div>}
      {children}
    </motion.div>
  );
}

export function Sparkline({ data, w = 120, h = 28, color = 'currentColor', plan, className, fill = false }: { data: number[]; w?: number; h?: number; color?: string; plan?: number; className?: string; fill?: boolean }) {
  if (data.length < 2) return <svg width={w} height={h} className={className} />;
  const max = Math.max(...data, plan ?? -Infinity) * 1.05;
  const min = Math.min(...data, plan ?? Infinity) * 0.95;
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / span) * h] as const);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      {plan !== undefined && <line x1={0} x2={w} y1={h - ((plan - min) / span) * h} y2={h - ((plan - min) / span) * h} stroke="rgb(var(--fg4))" strokeDasharray="3 3" strokeWidth={1} />}
      {fill && <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity={0.12} />}
      <motion.path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE }} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill={color} />
    </svg>
  );
}

export function segClass(s: Segment) {
  if (s.s === 'DOWN') {
    if (!s.stage || s.stage === 'unassigned') return 'pat-unassigned';
    if (s.stage === 'assigned') return 'pat-assigned';
    if (s.stage === 'spare') return 'pat-spare';
    return 'pat-working';
  }
  if (s.s === 'RUN' && s.stage === 'verify') return 'pat-verify';
  if (s.s === 'OFF') return 'pat-planned';
  return '';
}
export function segBg(s: Segment, patterns: boolean) {
  if (s.s === 'DOWN') return patterns ? undefined : 'rgb(var(--down))';
  if (s.s === 'RUN') return s.stage === 'verify' && patterns ? undefined : 'rgb(var(--run))';
  if (s.s === 'IDLE') return 'rgb(var(--idle))';
  if (s.s === 'MC') return 'rgb(var(--mould))';
  return undefined;
}

/** Status timeline across a shift window [t0, t1] with a "now" marker. */
export function TimelineBar({
  segs,
  t0,
  t1,
  now,
  h = 18,
  patterns = true,
  onSeg,
  className,
  showNow = true,
}: {
  segs: Segment[];
  t0: number;
  t1: number;
  now: number;
  h?: number;
  patterns?: boolean;
  onSeg?: (s: Segment | null, e?: MouseEvent) => void;
  className?: string;
  showNow?: boolean;
}) {
  const span = t1 - t0;
  const nowPct = ((now - t0) / span) * 100;
  return (
    <div className={cx('relative w-full overflow-hidden rounded-[3px] bg-line/40', className)} style={{ height: h }} onMouseLeave={() => onSeg?.(null)}>
      {segs.map((s, i) => {
        const a = Math.max(t0, s.start);
        const b = Math.min(t1, s.end);
        if (b <= a) return null;
        const team = s.team ? TEAMS[s.team]?.color : undefined;
        const useTeam = patterns && s.s === 'DOWN' && s.stage && s.stage !== 'unassigned';
        return (
          <div
            key={i}
            className={cx('absolute top-0 h-full', patterns && segClass(s))}
            style={{ left: `${((a - t0) / span) * 100}%`, width: `${((b - a) / span) * 100}%`, background: useTeam && s.stage === 'working' ? team : segBg(s, patterns), ['--team' as string]: team ?? '#F97316' }}
            onMouseEnter={(e) => onSeg?.(s, e)}
            onMouseMove={(e) => onSeg?.(s, e)}
          />
        );
      })}
      <div className="absolute top-0 h-full bg-[repeating-linear-gradient(135deg,rgb(var(--line))_0_2px,transparent_2px_6px)] opacity-60" style={{ left: `${nowPct}%`, right: 0 }} />
      {showNow && <div className="absolute top-[-2px] z-[2] h-[calc(100%+4px)] w-[2px] bg-brand shadow-[0_0_8px_rgba(242,106,33,0.8)]" style={{ left: `calc(${nowPct}% - 1px)` }} />}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md', className }: { options: { v: T; l: ReactNode }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div className={cx('relative inline-flex rounded-[7px] border border-line2/70 bg-panel2/60 p-0.5', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.v}
          role="tab"
          aria-selected={o.v === value}
          onClick={() => onChange(o.v)}
          className={cx('relative z-[1] whitespace-nowrap rounded-[5px] font-semibold transition-colors', size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]', o.v === value ? 'text-bg' : 'text-fg2 hover:text-fg')}
        >
          {o.v === value && <motion.span layoutId={`seg-${options.map((x) => x.v).join('')}`} className="absolute inset-0 -z-[1] rounded-[5px] bg-fg" transition={{ duration: 0.3, ease: EASE }} />}
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Drawer({ open, onClose, children, width = 560, title }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[70] bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="glass-strong fixed bottom-0 right-0 top-0 z-[71] flex max-w-[100vw] flex-col shadow-[var(--shadow)]"
            style={{ width }}
            initial={{ x: width + 40 }}
            animate={{ x: 0 }}
            exit={{ x: width + 40 }}
            transition={{ duration: 0.38, ease: EASE }}
            role="dialog"
            aria-modal
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line/60 px-5">
              <div className="num text-[18px] font-semibold">{title}</div>
              <button className="btn btn-ghost !h-8 !w-8 !p-0" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function Modal({ open, onClose, children, width = 560, title }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="glass-strong max-h-[90vh] w-full overflow-hidden rounded-[14px] shadow-[var(--shadow)]"
            style={{ maxWidth: width }}
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            {title && (
              <div className="flex h-14 items-center justify-between border-b border-line/60 px-5">
                <div className="num text-[20px] font-semibold">{title}</div>
                <button className="btn btn-ghost !h-8 !w-8 !p-0" onClick={onClose} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="max-h-[calc(90vh-56px)] overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('overline', className)}>{children}</div>;
}

export function Bar({ v, tone = 'rgb(var(--fg2))', h = 6, className, bg = 'rgb(var(--line) / 0.7)' }: { v: number; tone?: string; h?: number; className?: string; bg?: string }) {
  return (
    <div className={cx('w-full overflow-hidden rounded-full', className)} style={{ height: h, background: bg }}>
      <motion.div className="h-full rounded-full" style={{ background: tone }} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, v))}%` }} transition={{ duration: 0.6, ease: EASE }} />
    </div>
  );
}

/** Stacked running/idle/mould/down bar */
export function StateMix({ run, idle, mc, down, off = 0, h = 8, className }: { run: number; idle: number; mc: number; down: number; off?: number; h?: number; className?: string }) {
  const t = run + idle + mc + down + off || 1;
  const parts: [number, string][] = [
    [run, 'run'],
    [idle, 'idle'],
    [mc, 'mould'],
    [down, 'down'],
    [off, 'off'],
  ];
  return (
    <div className={cx('flex w-full gap-[2px] overflow-hidden rounded-[3px]', className)} style={{ height: h }} aria-label={`${run} running, ${idle} idle, ${mc} mould change, ${down} down`}>
      {parts.map(([n, v]) => (n > 0 ? <motion.div key={v} layout className="h-full" style={{ width: `${(n / t) * 100}%`, background: `rgb(var(--${v}))` }} /> : null))}
    </div>
  );
}

export function LiveDot({ className, label }: { className?: string; label?: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5', className)}>
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inset-0 animate-pulseRing rounded-full bg-run" />
        <span className="relative h-2 w-2 rounded-full bg-run" />
      </span>
      {label}
    </span>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="num text-[18px] font-semibold">{title}</div>
      {body && <div className="max-w-sm text-[13px] text-fg3">{body}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}

export function PhoneFrame({ children, time, className, label }: { children: ReactNode; time: string; className?: string; label?: string }) {
  return (
    <div className={cx('flex flex-col items-center gap-3', className)}>
      {label && <div className="overline">{label}</div>}
      <div className="relative h-[720px] w-[360px] shrink-0 rounded-[44px] border border-line2 bg-[#0a0b0d] p-[10px] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[36px] bg-bg">
          <div className="flex h-9 shrink-0 items-center justify-between px-6 text-[12px] font-semibold text-fg">
            <span className="num">{time}</span>
            <span className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
            <span className="text-[11px] text-fg3">5G ▮▮▮</span>
          </div>
          <div className="relative min-h-0 flex-1">{children}</div>
          <div className="mx-auto mb-1.5 mt-1 h-1 w-28 shrink-0 rounded-full bg-fg/40" />
        </div>
      </div>
    </div>
  );
}

export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-end justify-between gap-3', className)}>
      <h2 className="num text-[22px] font-semibold leading-7">{children}</h2>
      {right}
    </div>
  );
}

export const stageLabel = (stage: Stage | undefined, team: TeamId | null | undefined) => {
  if (!stage) return '';
  if (stage === 'unassigned') return 'NOT ASSIGNED';
  if (stage === 'verify') return 'RUNNING · VERIFY FIX';
  const t = team ? TEAMS[team].label.split(' ·')[0].toUpperCase() : '';
  return `${t} ${stage === 'assigned' ? 'ASSIGNED · NOT ARRIVED' : stage === 'working' ? 'WORKING' : 'WAITING FOR SPARE'}`;
};
