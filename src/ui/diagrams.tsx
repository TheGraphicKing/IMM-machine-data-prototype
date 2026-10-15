import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EASE } from './primitives';
import type { Agg } from '../sim/kpi';
import { machineKpis } from '../sim/kpi';
import type { World } from '../sim/engine';
import type { Machine, MState } from '../sim/types';
import { STATE_META } from '../sim/catalog';
import { dur, fmt } from '../lib/format';

/* ------------------------------------------------------------------ */
/* Shift-time flow: planned minutes → states → what running time made */
/* ------------------------------------------------------------------ */

interface FNode {
  id: string;
  label: string;
  v: number;
  col: number;
  tone: string;
}

export function TimeFlow({ a, height = 260, showOee = true }: { a: Agg; height?: number; showOee?: boolean }) {
  const W = 500;
  const H = height;
  const planned = Math.max(1, a.plannedSec);
  const goodT = a.stdShotSec * (a.parts ? a.good / a.parts : 1);
  const rejT = a.stdShotSec - goodT;
  const slowT = Math.max(0, a.runSec - a.stdShotSec);
  const ink = 'var(--fg)';
  const nodes: FNode[] = [
    { id: 'plan', label: 'Planned time', v: planned, col: 0, tone: ink },
    { id: 'run', label: 'Running', v: a.runSec, col: 1, tone: 'var(--run)' },
    { id: 'idle', label: 'Idle', v: a.idleSec, col: 1, tone: 'var(--idle)' },
    { id: 'mc', label: 'Mould change', v: a.mcSec, col: 1, tone: 'var(--mould)' },
    { id: 'down', label: 'Down', v: a.downSec, col: 1, tone: 'var(--down)' },
    { id: 'good', label: 'Good output', v: goodT, col: 2, tone: 'var(--run)' },
    { id: 'slow', label: 'Slow cycles', v: slowT, col: 2, tone: 'var(--idle)' },
    { id: 'rej', label: 'Rejects', v: rejT, col: 2, tone: 'var(--down)' },
  ];
  const links: [string, string][] = [
    ['plan', 'run'],
    ['plan', 'idle'],
    ['plan', 'mc'],
    ['plan', 'down'],
    ['run', 'good'],
    ['run', 'slow'],
    ['run', 'rej'],
  ];
  const colX = [0, 230, 470];
  const nodeW = 10;
  const gap = 14;
  const usable = H - gap * 3 - 10;
  const scale = usable / planned;
  // place nodes per column
  const pos: Record<string, { x: number; y: number; h: number }> = {};
  [0, 1, 2].forEach((c) => {
    const col = nodes.filter((n) => n.col === c);
    const total = col.reduce((s, n) => s + n.v, 0) * scale + gap * (col.length - 1);
    let y = c === 2 ? 5 + (pos.run?.y ?? 0) - (total - (pos.run?.h ?? 0)) / 2 : (H - total) / 2;
    y = Math.max(4, Math.min(H - total - 4, y));
    for (const n of col) {
      const h = Math.max(2, n.v * scale);
      pos[n.id] = { x: colX[c], y, h };
      y += h + gap;
    }
  });
  const used: Record<string, number> = {};
  const usedIn: Record<string, number> = {};
  const oee = (goodT / planned) * 100;
  return (
    <div className="relative w-full">
      <svg viewBox={`-4 0 ${W + 120} ${H + 34}`} className="h-auto w-full" style={{ maxHeight: H + 54 }} role="img" aria-label="Where the shift's planned time went">
        <defs>
          {links.map(([f, t]) => (
            <linearGradient key={f + t} id={`g-${f}-${t}`} x1="0" x2="1">
              <stop offset="0" stopColor={`rgb(${nodes.find((n) => n.id === f)!.tone} / 0.22)`} />
              <stop offset="1" stopColor={`rgb(${nodes.find((n) => n.id === t)!.tone} / 0.32)`} />
            </linearGradient>
          ))}
        </defs>
        {links.map(([f, t], i) => {
          const s = pos[f];
          const d = pos[t];
          const vt = nodes.find((n) => n.id === t)!.v * scale;
          const sy = s.y + (used[f] ?? 0);
          const dy = d.y + (usedIn[t] ?? 0);
          used[f] = (used[f] ?? 0) + vt;
          usedIn[t] = (usedIn[t] ?? 0) + vt;
          const x0 = s.x + nodeW;
          const x1 = d.x;
          const mx = (x0 + x1) / 2;
          const path = `M${x0},${sy} C${mx},${sy} ${mx},${dy} ${x1},${dy} L${x1},${dy + vt} C${mx},${dy + vt} ${mx},${sy + vt} ${x0},${sy + vt} Z`;
          return <motion.path key={f + t} d={path} fill={`url(#g-${f}-${t})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 + i * 0.07, duration: 0.6, ease: EASE }} />;
        })}
        {nodes.map((n, i) => {
          const p = pos[n.id];
          return <motion.rect key={n.id} x={p.x} width={nodeW} rx={3} fill={`rgb(${n.tone} / ${n.id === 'plan' ? 0.85 : 0.9})`} initial={{ y: p.y + p.h / 2, height: 0 }} animate={{ y: p.y, height: p.h }} transition={{ delay: i * 0.05, duration: 0.7, ease: EASE }} />;
        })}
        {[0, 1, 2].flatMap((c) => {
          const col = nodes.filter((n) => n.col === c);
          let last = -Infinity;
          return col.map((n) => {
            const p = pos[n.id];
            let y = p.y + p.h / 2;
            if (y < last + 30) y = last + 30;
            last = y;
            const pct = (n.v / planned) * 100;
            const lx = p.x + nodeW + 8;
            return (
              <g key={`l-${n.id}`}>
                {Math.abs(y - (p.y + p.h / 2)) > 2 && <line x1={p.x + nodeW + 1} x2={lx - 2} y1={p.y + p.h / 2} y2={y} stroke="rgb(var(--line2))" strokeWidth={1} />}
                <text x={lx} y={y - 6} dominantBaseline="middle" fill="rgb(var(--fg))" style={{ fontFamily: 'Inter', fontSize: 12 }}>
                  {n.label}
                </text>
                <text x={lx} y={y + 9} dominantBaseline="middle" fill="rgb(var(--fg3))" style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, letterSpacing: '0.04em' }}>
                  {n.id === 'plan' ? `${fmt(n.v / 60)} MACHINE-MIN` : `${fmt(n.v / 60)} MIN · ${pct.toFixed(0)}%`}
                </text>
              </g>
            );
          });
        })}
      </svg>
      {showOee && (
        <div className="mt-2 flex items-baseline justify-end gap-2 text-right">
          <span className="eyebrow">Good output ÷ planned time</span>
          <span className="num text-[18px]">= {oee.toFixed(1)}% OEE</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Isometric floor map: each machine a small 3D block, top = state    */
/* ------------------------------------------------------------------ */

const TOP: Record<MState, string> = { RUN: 'var(--run)', IDLE: 'var(--idle)', MC: 'var(--mould)', DOWN: 'var(--down)', OFF: 'var(--off)' };

export function IsoFloor({ w, ms, highlight }: { w: World; ms: Machine[]; highlight?: string | null }) {
  const nav = useNavigate();
  const [hover, setHover] = useState<string | null>(null);
  const halls = [...new Set(ms.map((m) => m.hall))];
  const perRow = Math.max(5, ...halls.map((h) => Math.ceil(ms.filter((m) => m.hall === h).length / 2)));
  const cell = 34; // grid unit
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  // grid coordinates
  const items = ms.map((m) => {
    const hi = halls.indexOf(m.hall);
    const inHall = ms.filter((x) => x.hall === m.hall);
    const idx = inHall.indexOf(m);
    const off = (perRow * 1.6 + 2.2) * 0.78;
    const gx = (idx % perRow) * 1.6 + hi * off;
    const gy = Math.floor(idx / perRow) * 2.4 - hi * off;
    const k = machineKpis(w, m);
    const p = k.target ? k.good / k.target : 0;
    return { m, gx, gy, h: 0.5 + Math.min(1.2, p) * 0.9, p };
  });
  const proj = (x: number, y: number, z = 0) => [(x - y) * cos * cell, (x + y) * sin * cell - z * cell] as const;
  const pts = items.flatMap((i) => [proj(i.gx, i.gy), proj(i.gx + 1, i.gy + 1.4), proj(i.gx + 1, i.gy), proj(i.gx, i.gy + 1.4), proj(i.gx, i.gy, i.h + 1)]);
  const minX = Math.min(...pts.map((p) => p[0])) - 20;
  const maxX = Math.max(...pts.map((p) => p[0])) + 20;
  const minY = Math.min(...pts.map((p) => p[1])) - 30;
  const maxY = Math.max(...pts.map((p) => p[1])) + 26;
  // draw back to front
  const order = [...items].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
  const hov = items.find((i) => i.m.id === hover);
  return (
    <div className="relative w-full">
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="mx-auto block h-auto w-full" style={{ maxHeight: 300 }} role="img" aria-label="Isometric map of the factory floor">
        {halls.map((h, hi) => {
          const off = (perRow * 1.6 + 2.2) * 0.78;
          const x0 = hi * off - 0.5;
          const x1 = x0 + perRow * 1.6 + 0.4;
          const y0 = -0.6 - hi * off;
          const y1 = 2.4 + 1.4 + 0.6 - hi * off;
          const c = [proj(x0, y0), proj(x1, y0), proj(x1, y1), proj(x0, y1)];
          const lp = proj(x0, y1 + 0.3);
          return (
            <g key={h}>
              <polygon points={c.map((p) => p.join(',')).join(' ')} fill="rgb(var(--panel3) / 0.7)" stroke="rgb(var(--line))" strokeWidth={1} />
              <text x={lp[0]} y={lp[1] + 14} className="fill-fg4 text-[10px]" style={{ fontFamily: 'JetBrains Mono', letterSpacing: '0.06em' }}>
                {h.toUpperCase()}
              </text>
            </g>
          );
        })}
        {order.map(({ m, gx, gy, h }) => {
          const wdt = 1;
          const dep = 1.4;
          const top = [proj(gx, gy, h), proj(gx + wdt, gy, h), proj(gx + wdt, gy + dep, h), proj(gx, gy + dep, h)];
          const left = [proj(gx, gy + dep, h), proj(gx + wdt, gy + dep, h), proj(gx + wdt, gy + dep, 0), proj(gx, gy + dep, 0)];
          const right = [proj(gx + wdt, gy, h), proj(gx + wdt, gy + dep, h), proj(gx + wdt, gy + dep, 0), proj(gx + wdt, gy, 0)];
          const isH = hover === m.id || highlight === m.id;
          const lbl = proj(gx + wdt / 2, gy + dep / 2, h);
          const pp = (a: readonly (readonly [number, number])[]) => a.map((p) => p.join(',')).join(' ');
          return (
            <g key={m.id} onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)} onClick={() => nav(`/machine/${m.id}`)} className="cursor-pointer" style={{ transform: isH ? 'translateY(-6px)' : undefined, transition: 'transform .25s cubic-bezier(.22,1,.36,1)' }}>
              {m.state === 'DOWN' && (
                <ellipse cx={proj(gx + 0.5, gy + 0.7)[0]} cy={proj(gx + 0.5, gy + 0.7)[1]} rx={cell * 1.05} ry={cell * 0.55} fill="none" stroke="rgb(var(--down))" strokeWidth={1.2} className="origin-center animate-pulse" />
              )}
              <polygon points={pp(left)} fill="rgb(var(--fg) / 0.13)" />
              <polygon points={pp(right)} fill="rgb(var(--fg) / 0.07)" />
              <polygon points={pp(top)} fill={`rgb(${TOP[m.state]} / ${m.state === 'RUN' ? 0.55 : 0.85})`} stroke="rgb(var(--panel))" strokeWidth={0.8} />
              <text x={lbl[0]} y={lbl[1] - 9} textAnchor="middle" className="fill-fg2 text-[9.5px]" style={{ fontFamily: 'JetBrains Mono' }}>
                {m.code.slice(4)}
              </text>
            </g>
          );
        })}
      </svg>
      {hov && (
        <div className="glass-strong pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-[12px] px-4 py-2.5 text-center shadow-[var(--shadow)]">
          <div className="text-[13px] font-medium">
            {hov.m.code} · {STATE_META[hov.m.state].label}
          </div>
          <div className="num text-[11.5px] text-fg3">
            {fmt(machineKpis(w, hov.m).good)} parts · {(hov.p * 100).toFixed(0)}% of target
            {hov.m.state !== 'RUN' && ` · ${hov.m.reasonLogged ? hov.m.reason : 'no reason'} · ${dur(w.t - hov.m.since)}`}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Generic 3-column flow (sankey) with label collision avoidance      */
/* ------------------------------------------------------------------ */

export interface SNode {
  id: string;
  label: string;
  col: number;
  color: string; // css color
  hatch?: boolean;
}
export interface SLink {
  from: string;
  to: string;
  v: number;
}

export function Sankey({ nodes, links, height = 300, fmtV, cols = 3 }: { nodes: SNode[]; links: SLink[]; height?: number; fmtV: (v: number) => string; cols?: number }) {
  const H = height;
  const W = 520;
  const colX = Array.from({ length: cols }, (_, i) => (i * W) / (cols - 1 || 1) - (i === cols - 1 ? 10 : 0));
  const nodeW = 10;
  const gap = 12;
  const val = (id: string) => Math.max(links.filter((l) => l.to === id).reduce((a, l) => a + l.v, 0), links.filter((l) => l.from === id).reduce((a, l) => a + l.v, 0));
  const total = Math.max(...Array.from({ length: cols }, (_, c) => nodes.filter((n) => n.col === c).reduce((a, n) => a + val(n.id), 0)));
  const maxCount = Math.max(...Array.from({ length: cols }, (_, c) => nodes.filter((n) => n.col === c).length));
  const scale = (H - gap * (maxCount - 1) - 8) / Math.max(1, total);
  const pos: Record<string, { x: number; y: number; h: number }> = {};
  for (let c = 0; c < cols; c++) {
    const col = nodes.filter((n) => n.col === c);
    const tot = col.reduce((a, n) => a + val(n.id) * scale, 0) + gap * (col.length - 1);
    let y = (H - tot) / 2;
    for (const n of col) {
      const h = Math.max(2, val(n.id) * scale);
      pos[n.id] = { x: colX[c], y, h };
      y += h + gap;
    }
  }
  const outUsed: Record<string, number> = {};
  const inUsed: Record<string, number> = {};
  const colorOf = (id: string) => nodes.find((n) => n.id === id)!.color;
  return (
    <svg viewBox={`-4 -6 ${W + 150} ${H + 20}`} className="h-auto w-full" role="img">
      {links.map((l, i) => {
        const s = pos[l.from];
        const d = pos[l.to];
        if (!s || !d) return null;
        const t = l.v * scale;
        const sy = s.y + (outUsed[l.from] ?? 0);
        const dy = d.y + (inUsed[l.to] ?? 0);
        outUsed[l.from] = (outUsed[l.from] ?? 0) + t;
        inUsed[l.to] = (inUsed[l.to] ?? 0) + t;
        const x0 = s.x + nodeW;
        const x1 = d.x;
        const mx = (x0 + x1) / 2;
        return (
          <motion.path
            key={i}
            d={`M${x0},${sy} C${mx},${sy} ${mx},${dy} ${x1},${dy} L${x1},${dy + t} C${mx},${dy + t} ${mx},${sy + t} ${x0},${sy + t} Z`}
            fill={colorOf(l.to)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.22 }}
            whileHover={{ opacity: 0.45 }}
            transition={{ delay: 0.1 + i * 0.04, duration: 0.5, ease: EASE }}
          />
        );
      })}
      {nodes.map((n, i) => {
        const p = pos[n.id];
        return <motion.rect key={n.id} x={p.x} width={nodeW} rx={3} fill={n.color} className={n.hatch ? 'pat-unassigned' : undefined} initial={{ y: p.y + p.h / 2, height: 0 }} animate={{ y: p.y, height: p.h }} transition={{ delay: i * 0.03, duration: 0.6, ease: EASE }} />;
      })}
      {Array.from({ length: cols }, (_, c) =>
        (() => {
          let last = -Infinity;
          return nodes
            .filter((n) => n.col === c)
            .map((n) => {
              const p = pos[n.id];
              let y = p.y + p.h / 2;
              if (y < last + 26) y = last + 26;
              last = y;
              const lx = p.x + nodeW + 8;
              return (
                <g key={`l-${n.id}`}>
                  {Math.abs(y - (p.y + p.h / 2)) > 2 && <line x1={p.x + nodeW + 1} x2={lx - 2} y1={p.y + p.h / 2} y2={y} stroke="rgb(var(--line2))" strokeWidth={1} />}
                  <text x={lx} y={y - 5} dominantBaseline="middle" fill="rgb(var(--fg))" style={{ fontFamily: 'Inter', fontSize: 11.5 }}>
                    {n.label}
                  </text>
                  <text x={lx} y={y + 9} dominantBaseline="middle" fill="rgb(var(--fg3))" style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5 }}>
                    {fmtV(val(n.id))}
                  </text>
                </g>
              );
            });
        })(),
      )}
    </svg>
  );
}
