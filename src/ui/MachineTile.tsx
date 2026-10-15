import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { World } from '../sim/engine';
import { machineKpis } from '../sim/kpi';
import { TEAMS } from '../sim/catalog';
import type { Machine } from '../sim/types';
import { cx, dur, fmt } from '../lib/format';
import { EASE, StatePill, stageLabel } from './primitives';

export function machineNote(w: World, m: Machine) {
  const k = machineKpis(w, m);
  const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
  if (m.state === 'DOWN') return { text: `${m.reasonLogged ? m.reason : 'No reason logged'} · ${dur(w.t - m.since)}`, tone: 'down' as const, stage: tk ? stageLabel(tk.stage, tk.team) : '' };
  if (m.state === 'IDLE') return { text: `${m.reason} · ${dur(w.t - m.since)}`, tone: 'idle' as const, stage: '' };
  if (m.state === 'MC') {
    const md = w.mould[m.nextMouldId ?? ''];
    return { text: `${m.reason} · ${Math.round((w.t - m.since) / 60)} / ${md?.stdChangeMin ?? 30} min`, tone: 'mould' as const, stage: '' };
  }
  if (m.state === 'OFF') return { text: m.reason || 'No data', tone: null, stage: '' };
  if (tk && tk.stage === 'verify') return { text: `Running · fix not verified`, tone: 'idle' as const, stage: 'VERIFY FIX' };
  const dev = (m.cycleFactor - 1) * 100;
  if (dev > 5) return { text: `Cycle +${dev.toFixed(0)}% vs std ${k.std.toFixed(1)} s`, tone: 'down' as const, stage: '' };
  return { text: `${k.ct.toFixed(1)} s cycle · ${m.operator}`, tone: null, stage: '' };
}

export default function MachineTile({ w, m, i = 0, compact }: { w: World; m: Machine; i?: number; compact?: boolean }) {
  const nav = useNavigate();
  const k = machineKpis(w, m);
  const n = machineNote(w, m);
  const p = k.target ? (k.good / k.target) * 100 : 0;
  const md = w.mould[m.mouldId];
  const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(i, 20) * 0.02, ease: EASE }}
      whileHover={{ y: -2 }}
      onClick={() => nav(`/machine/${m.id}`)}
      className={cx('glass relative flex flex-col gap-1.5 overflow-hidden !rounded-[10px] p-3 text-left', m.state === 'DOWN' && '!bg-down/[0.05]')}
      style={{ borderLeft: `2px solid rgb(var(--${m.state === 'RUN' ? 'run' : m.state === 'IDLE' ? 'idle' : m.state === 'MC' ? 'mould' : m.state === 'DOWN' ? 'down' : 'off'}))` }}
      aria-label={`${m.code} ${m.state}`}
    >
      <div className="flex items-center justify-between gap-2">
        <motion.span layoutId={`m-title-${m.id}`} className="num whitespace-nowrap text-[14px] font-medium leading-6">
          {m.code}
        </motion.span>
        <StatePill s={m.state} />
      </div>
      <div className="truncate text-[12px] text-fg3">
        {md?.id} · {m.tonnage} T{!compact && ` · ${m.hall}`}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="num text-[18px] font-medium leading-7">{fmt(k.good)}</span>
        <span className="num text-[13px] font-semibold" style={{ color: p >= 95 ? 'rgb(var(--run-t))' : p >= 88 ? 'rgb(var(--idle-t))' : 'rgb(var(--down-t))' }}>
          {p.toFixed(0)}%
        </span>
      </div>
      <div className="truncate text-[12px] font-medium" style={{ color: n.tone ? `rgb(var(--${n.tone}-t))` : 'rgb(var(--fg3))' }}>
        {n.text}
      </div>
      {tk && tk.stage !== 'closed' && (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: tk.team ? TEAMS[tk.team].color : 'rgb(var(--down-t))' }}>
          <span className={cx('h-2 w-4 rounded-[1px]', tk.stage === 'unassigned' ? 'pat-unassigned' : tk.stage === 'assigned' ? 'pat-assigned' : tk.stage === 'spare' ? 'pat-spare' : tk.stage === 'verify' ? 'pat-verify' : 'pat-working')} style={{ ['--team' as string]: tk.team ? TEAMS[tk.team].color : '#B9533F' }} />
          <span className="truncate">{n.stage || stageLabel(tk.stage, tk.team)}</span>
        </div>
      )}
    </motion.button>
  );
}
