import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { EASE } from './primitives';
import { fmt, cx } from '../lib/format';
import { TEAMS } from '../sim/catalog';
import type { TeamId } from '../sim/types';

/** Hourly output vs plan (shop-floor hours). Bars below 90% of plan in red; current hour shown partial. */
export function HourlyBars({ out, planH, labels, current, frac, height = 200 }: { out: number[]; planH: number; labels: string[]; current: number; frac: number; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(planH * 1.25, ...out) || 1;
  const planY = (1 - planH / max) * 100;
  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-x-0 top-0 h-[calc(100%-22px)]">
        {[0.25, 0.5, 0.75].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-line/50" style={{ top: `${g * 100}%` }} />
        ))}
        <div className="absolute inset-x-0 z-[2] border-t border-dashed border-brand" style={{ top: `${planY}%` }}>
          <span className="num absolute -top-5 right-0 rounded bg-panel px-1.5 text-[11px] font-semibold text-fg2">Plan {fmt(planH)} / h</span>
        </div>
        <div className="absolute inset-0 flex items-end gap-2 px-1">
          {out.map((v, i) => {
            const future = i > current;
            const isCur = i === current;
            const planHere = isCur ? planH * frac : planH;
            const low = !future && v < planHere * 0.9;
            const h = future ? 0 : (v / max) * 100;
            return (
              <div key={i} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {future ? (
                  <div className="h-[78%] rounded-t-[6px] border border-dashed border-line" />
                ) : (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.7, delay: i * 0.05, ease: EASE }}
                    className="relative rounded-t-[6px]"
                    style={{ background: isCur ? 'repeating-linear-gradient(135deg, rgb(var(--fg) / 0.16) 0 4px, rgb(var(--fg) / 0.05) 4px 8px)' : low ? 'linear-gradient(180deg, rgb(var(--down) / 0.42), rgb(var(--down) / 0.18))' : 'linear-gradient(180deg, rgb(var(--fg) / 0.2), rgb(var(--fg) / 0.08))', boxShadow: isCur ? undefined : low ? 'inset 0 2px 0 rgb(var(--down))' : 'inset 0 2px 0 rgb(var(--fg) / 0.75)' }}
                  >
                    <span className="num absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold" style={{ color: low && !isCur ? 'rgb(var(--down-t))' : 'rgb(var(--fg))' }}>
                      {fmt(v)}
                    </span>
                  </motion.div>
                )}
                {hover === i && !future && (
                  <div className="glass-strong pointer-events-none absolute bottom-full left-1/2 z-10 mb-6 w-40 -translate-x-1/2 rounded-md p-2 text-[12px] shadow-[var(--shadow)]">
                    <div className="font-semibold">{labels[i]}{isCur && ' · in progress'}</div>
                    <div className="num">Actual {fmt(v)} · plan {fmt(planHere)}</div>
                    <div className="num" style={{ color: low ? 'rgb(var(--down-t))' : 'rgb(var(--run-t))' }}>{((v / planHere) * 100).toFixed(0)}% of plan</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-2 px-1">
        {labels.map((l, i) => (
          <div key={l} className={cx('num flex-1 text-center text-[11px]', i === current ? 'font-semibold text-brand' : 'text-fg3')}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ParetoRow {
  label: string;
  team: TeamId | 'unassigned';
  value: number; // minutes
  sub?: ReactNode;
}

/** Downtime Pareto coloured by owning team. */
export function Pareto({ rows, unit = 'min', max: maxIn, onRow }: { rows: ParetoRow[]; unit?: string; max?: number; onRow?: (r: ParetoRow) => void }) {
  const max = maxIn ?? Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => {
        const c = r.team === 'unassigned' ? '#B9533F' : TEAMS[r.team]?.color ?? '#6B675F';
        return (
          <button key={r.label} className="group flex flex-col gap-1 text-left" onClick={() => onRow?.(r)}>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className={cx('flex min-w-0 items-center gap-2', r.team === 'unassigned' && 'text-down-t')}>
                <span className={cx('h-2 w-2 shrink-0 rounded-full', r.team === 'unassigned' && 'pat-unassigned')} style={{ background: r.team === 'unassigned' ? undefined : c }} />
                <span className="truncate">{r.label}</span>
              </span>
              <span className="num shrink-0 font-semibold">
                {Math.round(r.value)} {unit} <span className="text-fg3">· {Math.round((r.value / total) * 100)}%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line/60">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(r.value / max) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
                className={cx('h-full rounded-full', r.team === 'unassigned' && 'pat-unassigned')}
                style={{ background: r.team === 'unassigned' ? undefined : i === 0 ? 'rgb(var(--fg) / 0.8)' : 'rgb(var(--fg) / 0.32)' }}
              />
            </div>
            {r.sub && <div className="text-[11px] text-fg3">{r.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}

/** Generic line chart with reference lines + optional band. */
export function LineChart({
  data,
  height = 180,
  refs = [],
  band,
  color = 'rgb(var(--fg2))',
  dots = false,
  dotColor,
  yMin,
  yMax,
  xLabels,
  highlightFrom,
}: {
  data: number[];
  height?: number;
  refs?: { v: number; label: string; tone?: string; dash?: boolean }[];
  band?: [number, number];
  color?: string;
  dots?: boolean;
  dotColor?: (v: number, i: number) => string;
  yMin?: number;
  yMax?: number;
  xLabels?: string[];
  highlightFrom?: number;
}) {
  const W = 600;
  const H = 100;
  const vals = [...data, ...refs.map((r) => r.v), ...(band ?? [])];
  const lo = yMin ?? Math.min(...vals);
  const hi = yMax ?? Math.max(...vals);
  const pad = (hi - lo) * 0.12 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const x = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * W : W / 2);
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-[calc(100%-18px)] w-full overflow-visible">
        {band && <rect x={0} width={W} y={y(band[1])} height={y(band[0]) - y(band[1])} fill="rgb(var(--run))" opacity={0.1} />}
        {highlightFrom !== undefined && <rect x={x(highlightFrom)} width={W - x(highlightFrom)} y={0} height={H} fill="rgb(var(--down))" opacity={0.06} />}
        {refs.map((r) => (
          <line key={r.label} x1={0} x2={W} y1={y(r.v)} y2={y(r.v)} stroke={r.tone ?? 'rgb(var(--fg3))'} strokeWidth={1} strokeDasharray={r.dash === false ? undefined : '4 4'} vectorEffect="non-scaling-stroke" />
        ))}
        {!dots && <motion.path d={d} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: EASE }} />}
      </svg>
      {dots && (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-[calc(100%-18px)] w-full overflow-visible">
          {data.map((v, i) => (
            <ellipse key={i} cx={x(i)} cy={y(v)} rx={2.2} ry={2.2 * (H / W) * 4} fill={dotColor?.(v, i) ?? color} />
          ))}
        </svg>
      )}
      {refs.map((r) => (
        <span key={r.label} className="num pointer-events-none absolute right-0 rounded bg-panel/80 px-1 text-[10px] font-semibold" style={{ top: `calc((100% - 18px) * ${(y(r.v) / H).toFixed(4)} - 15px)`, color: r.tone ?? 'rgb(var(--fg3))' }}>
          {r.label}
        </span>
      ))}
      {xLabels && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between">
          {xLabels.map((l, i) => (
            <span key={i} className="num text-[10px] text-fg3">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Animated ring gauge */
export function Ring({ v, size = 64, stroke = 6, color = 'rgb(var(--run))', children, track = 'rgb(var(--line))' }: { v: number; size?: number; stroke?: number; color?: string; children?: ReactNode; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, v / 100))) }} transition={{ duration: 0.9, ease: EASE }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
