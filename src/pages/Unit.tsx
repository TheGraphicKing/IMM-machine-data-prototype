import { motion } from 'framer-motion';
import { Download, Layers3, MonitorPlay } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorld } from '../sim/store';
import { aggMachines, availability, derive, downtimeByReason, hourly, machineKpis, machinesOfUnit, requiredRate, shiftElapsed } from '../sim/kpi';
import { hourIdx, PLAN_FACTOR } from '../sim/engine';
import { SHIFT_LEN, SHIFT_WINDOWS, shiftOf, shiftStartOf } from '../sim/catalog';
import { clock, cx, fmt, pct } from '../lib/format';
import { Bar, EASE, Kpi, LiveDot, Panel, Segmented, StatePill, TimelineBar, Ticker, planColor, planText, stageLabel } from '../ui/primitives';
import { HourlyBars, Pareto } from '../ui/charts';
import MachineTile, { machineNote } from '../ui/MachineTile';
import LogReason from '../ui/LogReason';
import { notify } from '../shell/Toasts';
import type { Machine, Segment } from '../sim/types';
import { TEAMS } from '../sim/catalog';

const ORDER = { DOWN: 0, IDLE: 1, MC: 2, RUN: 4, OFF: 5 } as const;

export default function Unit({ view }: { view: 'overview' | 'timeline' }) {
  const { unitId = 'MN1' } = useParams();
  const w = useWorld();
  const nav = useNavigate();
  const u = w.unit[unitId] ?? w.unit.MN1;
  const org = w.org[u.orgId];
  const [hall, setHall] = useState('All halls');
  const [win, setWin] = useState<'today' | '7d' | 'custom'>('today');
  const ms = machinesOfUnit(w, u).filter((m) => hall === 'All halls' || m.hall === hall);
  const A = aggMachines(w, ms);
  const D = derive(A);
  const need = requiredRate(w, A);
  const sh = shiftOf(w.t);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg3">
            <Link to="/home" className="hover:text-fg">Corporate</Link>/<Link to="/rollup" className="hover:text-fg">{org.name}</Link>/<span className="text-fg2">{u.name}</span>
            <span className="mx-1 h-3.5 w-px bg-line" />
            <LiveDot label={`Live · Shift ${sh} ${SHIFT_WINDOWS[sh]}`} />
          </div>
          <motion.h1 layoutId={`unit-title-${u.id}`} className="num mt-1 text-[30px] font-bold leading-9">
            {u.name}
          </motion.h1>
          <div className="text-[13px] text-fg3">
            {org.name} · {u.city}, {u.state} · {u.machineIds.length} machines · Plant head {u.head}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<'overview' | 'timeline'> options={[{ v: 'overview', l: 'Overview' }, { v: 'timeline', l: 'Machine timeline' }]} value={view} onChange={(v) => nav(v === 'overview' ? `/unit/${u.id}` : `/unit/${u.id}/timeline`)} />
          <Segmented<'today' | '7d' | 'custom'> size="sm" options={[{ v: 'today', l: `Shift ${sh} · today` }, { v: '7d', l: '7 days' }, { v: 'custom', l: 'Custom' }]} value={win} onChange={(v) => { setWin(v); if (v !== 'today') notify({ tone: 'info', title: v === '7d' ? 'Showing live shift' : 'Custom range', body: 'Historical ranges come from the KPI service in production · prototype shows the live shift' }); }} />
          {u.halls.length > 1 && (
            <select className="input !h-8 !w-auto !py-0 !text-[13px]" value={hall} onChange={(e) => setHall(e.target.value)} aria-label="Hall filter">
              {['All halls', ...u.halls].map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          )}
          <Link to={`/twin/${u.id}`} className="btn btn-ghost !h-8"><Layers3 size={14} />Digital twin</Link>
          <button className="btn btn-ghost !h-8" onClick={() => notify({ tone: 'run', title: `Sent to TV · ${u.name} Hall A`, body: 'Playlist “Production” will show within 15 s' })}><MonitorPlay size={14} />Send to TV</button>
          <button className="btn btn-ghost !h-8" onClick={() => notify({ tone: 'run', title: 'Export ready', body: `${u.code}_shift_${sh}_${clock(w.t).replace(':', '')}.xlsx downloaded` })}><Download size={14} />Export</button>
        </div>
      </div>

      {view === 'overview' ? <Overview ms={ms} A={A} D={D} need={need} unitId={u.id} /> : <Timeline ms={ms} D={D} A={A} />}
    </div>
  );
}

function Overview({ ms, A, D, need, unitId }: { ms: Machine[]; A: ReturnType<typeof aggMachines>; D: ReturnType<typeof derive>; need: number; unitId: string }) {
  const w = useWorld();
  const nav = useNavigate();
  const [filter, setFilter] = useState<'all' | 'down' | 'idle' | 'behind' | 'mc'>('all');
  const [logFor, setLogFor] = useState<string | null>(null);
  const h = hourly(w, ms);
  const hi = hourIdx(w.t);
  const s0 = shiftStartOf(w.t);
  const labels = Array.from({ length: 8 }, (_, i) => `${clock(s0 + i * 3600).slice(0, 2)}–${clock(s0 + (i + 1) * 3600).slice(0, 2)}`);
  const pareto = downtimeByReason(w, ms);
  const rows = pareto.list.slice(0, 7).map((r) => ({ label: r.label, team: r.team, value: r.sec / 60 }));
  const noReason = ms.filter((m) => (m.state === 'DOWN' || m.state === 'IDLE') && !m.reasonLogged);
  const prev = w.prevShifts[unitId] ?? [];
  const alerts = w.alerts.filter((a) => a.unitId === unitId && a.status !== 'resolved').slice(0, 5);
  const sorted = [...ms]
    .map((m) => ({ m, k: machineKpis(w, m) }))
    .filter(({ m, k }) => filter === 'all' || (filter === 'down' && m.state === 'DOWN') || (filter === 'idle' && m.state === 'IDLE') || (filter === 'mc' && m.state === 'MC') || (filter === 'behind' && k.target > 0 && k.good / k.target < 0.88))
    .sort((a, b) => {
      const ra = a.m.state === 'RUN' && a.k.target && a.k.good / a.k.target < 0.88 ? 3 : ORDER[a.m.state];
      const rb = b.m.state === 'RUN' && b.k.target && b.k.good / b.k.target < 0.88 ? 3 : ORDER[b.m.state];
      return ra - rb || a.m.code.localeCompare(b.m.code);
    });
  const behind = ms.filter((m) => {
    const k = machineKpis(w, m);
    return k.target > 0 && k.good / k.target < 0.88;
  }).length;
  const kwhPart = A.good ? A.kwh / A.good : 0;

  return (
    <>
      <div className="glass grid grid-cols-2 gap-x-6 gap-y-5 !rounded-[12px] p-5 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label={`Output vs plan · to ${clock(w.t)}`}
          value={<Ticker value={A.good} format={fmt} />}
          unit={`/ ${fmt(A.planParts)}`}
          bar={{ v: D.plan, tone: planColor(D.plan) }}
          sub={
            <>
              <b className="num" style={{ color: planText(D.plan) }}>{pct(D.plan)}</b> · Shift plan {fmt(A.shiftPlan)} · needs <b className="num text-fg">{fmt(need)}</b> / h to close
            </>
          }
        />
        <Kpi label="OEE" value={<Ticker value={D.oee} format={(n) => n.toFixed(1)} />} unit="%" sub="Target 75%">
          <div className="mt-1 grid grid-cols-3 gap-2">
            {[
              ['Availability', D.A],
              ['Performance', D.P],
              ['Quality', D.Q],
            ].map(([l, v]) => (
              <div key={l as string}>
                <div className="flex justify-between text-[10px] text-fg3">
                  <span>{(l as string).slice(0, 5)}</span>
                  <span className="num font-semibold text-fg2">{(v as number).toFixed(0)}</span>
                </div>
                <Bar v={v as number} h={4} />
              </div>
            ))}
          </div>
        </Kpi>
        <Kpi label="Rejection" value={<Ticker value={D.rej} format={(n) => n.toFixed(1)} />} unit="%" tone={D.rej > 3 ? 'down' : null} sub={`${fmt(A.bad)} parts · limit 3.0%`} onClick={() => nav('/records')} />
        <Kpi label="Cycle time vs std" value={<>{D.cycleDev >= 0 ? '+' : ''}{D.cycleDev.toFixed(1)}</>} unit="%" tone={D.cycleDev > 5 ? 'down' : D.cycleDev > 3 ? 'idle' : null} sub={`${A.overCycle} machines over +5%`} />
        <Kpi label="Energy" value={<Ticker value={A.kwh} format={fmt} />} unit="kWh" sub={`${kwhPart.toFixed(3)} kWh / part`} onClick={() => nav('/energy')} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Hourly output vs plan" sub={<span className="inline-flex flex-wrap gap-x-4"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-fg2" />Actual</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-down" />Below 90% of plan</span><span>Good parts per shop-floor hour</span></span>}>
            <HourlyBars out={h.out} planH={h.planH} labels={labels} current={hi} frac={(w.t - s0 - hi * 3600) / 3600} height={220} />
          </Panel>

          <Panel
            title={`Machines · ${A.run} running · ${A.idle} idle · ${A.mc} mould change · ${A.down} down`}
            right={
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['all', `All ${ms.length}`],
                  ['down', `Down ${A.down}`],
                  ['idle', `Idle ${A.idle}`],
                  ['behind', `Behind target ${behind}`],
                  ['mc', `Mould change ${A.mc}`],
                ] as const).map(([k, l]) => (
                  <button key={k} className={cx('chip !h-7', filter === k && 'chip-on')} onClick={() => setFilter(k)}>
                    {l}
                  </button>
                ))}
              </div>
            }
          >
            <motion.div layout className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {sorted.map(({ m }, i) => (
                <MachineTile key={m.id} w={w} m={m} i={i} />
              ))}
            </motion.div>
            {sorted.length === 0 && <div className="py-8 text-center text-[13px] text-fg3">No machines match this filter right now.</div>}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Downtime by reason" sub={`${Math.round(pareto.total / 60)} min this shift · coloured by owning team`}>
            <Pareto rows={rows} />
            {noReason.length > 0 && (
              <button onClick={() => setLogFor(noReason[0].id)} className="mt-3 w-full rounded-md bg-down/10 px-3 py-2 text-left text-[12px] font-semibold text-down-t transition hover:bg-down/15">
                {noReason.length} stop{noReason.length > 1 ? 's have' : ' has'} no reason logged · Log reason →
              </button>
            )}
          </Panel>
          <Panel title="Shift comparison" sub="Live shift vs previous 3 shifts">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-fg3">
                  <th className="pb-2 font-semibold">Shift</th>
                  <th className="pb-2 text-right font-semibold">Output</th>
                  <th className="pb-2 text-right font-semibold">OEE</th>
                  <th className="pb-2 text-right font-semibold">Rej</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line/60">
                  <td className="py-2 font-semibold text-brand">Shift {shiftOf(w.t)} today (live)</td>
                  <td className="num py-2 text-right font-semibold">{fmt(A.good)}</td>
                  <td className="num py-2 text-right font-semibold">{pct(D.oee)}</td>
                  <td className="num py-2 text-right font-semibold" style={{ color: D.rej > 3 ? 'rgb(var(--down-t))' : undefined }}>{pct(D.rej)}</td>
                </tr>
                {prev.slice(0, 3).map((s) => (
                  <tr key={s.label} className="border-t border-line/60">
                    <td className="py-2 text-fg2">{s.label}</td>
                    <td className="num py-2 text-right">{fmt(s.out)}</td>
                    <td className="num py-2 text-right">{pct(s.oee)}</td>
                    <td className="num py-2 text-right" style={{ color: s.rej > 3 ? 'rgb(var(--down-t))' : undefined }}>{pct(s.rej)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-fg3">Live shift is {Math.round((shiftElapsed(w) / SHIFT_LEN) * 100)}% through · full-shift plan {fmt(A.shiftPlan)} at {Math.round(PLAN_FACTOR * 100)}% of standard</div>
          </Panel>
          <Panel title="Open alerts" right={<Link to="/alerts" className="text-[12px] font-semibold text-brand hover:underline">All →</Link>}>
            <div className="flex flex-col gap-1">
              {alerts.length === 0 && <div className="py-4 text-center text-[13px] text-fg3">All clear · No open alerts for this unit</div>}
              {alerts.map((a) => (
                <button key={a.id} onClick={() => nav(a.machineId ? `/machine/${a.machineId}` : '/alerts')} className="flex gap-2.5 rounded-md p-1.5 text-left transition hover:bg-panel3/60">
                  <span className="w-1 shrink-0 rounded-full" style={{ background: a.severity === 'critical' ? 'rgb(var(--down))' : a.severity === 'warning' ? 'rgb(var(--idle))' : 'rgb(var(--mould))' }} />
                  <span className="min-w-0">
                    <span className="num text-[12px] font-semibold text-fg3">
                      {a.machineId ? w.machine[a.machineId].code : 'UNIT'} · {clock(a.t)}
                    </span>
                    <span className="block text-[13px] leading-[18px]">{a.title}</span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      {logFor && <LogReason machineId={logFor} open={!!logFor} onClose={() => setLogFor(null)} />}
    </>
  );
}

function Timeline({ ms, D, A }: { ms: Machine[]; D: ReturnType<typeof derive>; A: ReturnType<typeof aggMachines> }) {
  const w = useWorld();
  const nav = useNavigate();
  const [sort, setSort] = useState<'status' | 'name' | 'avail' | 'loss'>('status');
  const [problems, setProblems] = useState(false);
  const [tip, setTip] = useState<{ s: Segment; m: Machine; x: number; y: number } | null>(null);
  const s0 = shiftStartOf(w.t);
  const s1 = s0 + SHIFT_LEN;
  const list = useMemo(() => {
    let l = ms.map((m) => ({ m, k: machineKpis(w, m), av: availability(m) }));
    if (problems) l = l.filter(({ m, k }) => m.state !== 'RUN' || m.cycleFactor > 1.05 || k.rej > 3 || (k.target && k.good / k.target < 0.88));
    l.sort((a, b) => (sort === 'status' ? ORDER[a.m.state] - ORDER[b.m.state] : sort === 'name' ? a.m.code.localeCompare(b.m.code) : sort === 'avail' ? a.av - b.av : b.m.downSec + b.m.idleSec - (a.m.downSec + a.m.idleSec)));
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.t, ms, sort, problems]);
  const hours = Array.from({ length: 9 }, (_, i) => s0 + i * 3600);

  return (
    <div className="glass relative !rounded-[12px]">
      <div className="flex flex-wrap items-center gap-3 border-b border-line/60 px-4 py-3">
        <div className="flex items-center gap-4 text-[13px]">
          <span>PLAN <b className="num text-[16px]" style={{ color: planText(D.plan) }}>{pct(D.plan)}</b></span>
          <span>OEE <b className="num text-[16px]">{pct(D.oee)}</b></span>
          <span>REJECT <b className="num text-[16px]">{pct(D.rej)}</b></span>
          <span>DOWN <b className="num text-[16px] text-down-t">{A.down} / {A.machines}</b></span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="input !h-8 !w-auto !text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="status">Sort: Status</option>
            <option value="name">Sort: Name</option>
            <option value="avail">Sort: Availability</option>
            <option value="loss">Sort: Loss</option>
          </select>
          <button className={cx('chip', problems && 'chip-on')} onClick={() => setProblems((v) => !v)}>
            Only problems
          </button>
          <div className="hidden items-center gap-3 text-[11px] text-fg3 lg:flex">
            {[
              ['run', 'Running'],
              ['idle', 'Idle'],
              ['mould', 'Mould change'],
              ['down', 'Down'],
            ].map(([v, l]) => (
              <span key={v} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `rgb(var(--${v}))` }} />
                {l}
              </span>
            ))}
            <span className="inline-flex items-center gap-1"><span className="pat-unassigned h-2.5 w-4 rounded-[2px]" />Not assigned</span>
            <span className="inline-flex items-center gap-1"><span className="pat-assigned h-2.5 w-4 rounded-[2px]" />Assigned</span>
            <span className="inline-flex items-center gap-1"><span className="pat-spare h-2.5 w-4 rounded-[2px]" />Waiting spare</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          <div className="grid grid-cols-[150px_210px_minmax(0,1fr)_100px_110px_60px] items-center gap-3 border-b border-line/60 bg-panel2/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg3">
            <span>Machine</span>
            <span>Job · mould</span>
            <div className="relative h-4">
              {hours.map((t, i) => (
                <span key={t} className="num absolute -translate-x-1/2 text-[10px]" style={{ left: `${(i / 8) * 100}%` }}>
                  {i === 0 ? <span className="translate-x-1/2">{clock(t)}</span> : i === 8 ? <span className="-translate-x-1/2">{clock(t)}</span> : clock(t)}
                </span>
              ))}
              <span className="num absolute -top-0.5 -translate-x-1/2 rounded bg-brand px-1 text-[10px] text-ink" style={{ left: `${((w.t - s0) / SHIFT_LEN) * 100}%` }}>
                {clock(w.t)}
              </span>
            </div>
            <span className="text-right">Cycle / std</span>
            <span className="text-right">Output</span>
            <span className="text-right">Rej</span>
          </div>
          {list.map(({ m, k }, i) => {
            const n = machineNote(w, m);
            const p = k.target ? (k.good / k.target) * 100 : 0;
            const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
            const md = w.mould[m.mouldId];
            const ctDev = (m.cycleFactor - 1) * 100;
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015, duration: 0.3, ease: EASE }}
                className={cx('grid cursor-pointer grid-cols-[150px_210px_minmax(0,1fr)_100px_110px_60px] items-center gap-3 border-b border-line/40 px-4 py-2.5 transition hover:bg-panel3/40', m.state === 'DOWN' && 'bg-down/[0.06]')}
                onClick={() => nav(`/machine/${m.id}`)}
              >
                <div className="min-w-0">
                  <div className="num text-[16px] font-semibold" style={{ color: m.state === 'DOWN' ? 'rgb(var(--down-t))' : undefined }}>
                    {m.code}
                  </div>
                  <div className="truncate text-[11px]" style={{ color: n.tone ? `rgb(var(--${n.tone}-t))` : 'rgb(var(--fg3))' }}>
                    {tk && tk.stage !== 'closed' ? stageLabel(tk.stage, tk.team).toLowerCase() : m.state === 'RUN' ? 'running' : n.text}
                  </div>
                </div>
                <div className="min-w-0 text-[12px]">
                  <div className="truncate font-semibold">
                    {m.wo} · {w.part[md?.positions[0].partId ?? '']?.name}
                  </div>
                  <div className="truncate text-fg3">
                    {md?.id} · {m.operator}
                  </div>
                </div>
                <TimelineBar
                  segs={m.timeline}
                  t0={s0}
                  t1={s1}
                  now={w.t}
                  h={20}
                  onSeg={(s, e) => setTip(s && e ? { s, m, x: e.clientX, y: e.clientY } : null)}
                />
                <div className="text-right">
                  <div className="num text-[15px] font-semibold" style={{ color: ctDev > 5 ? 'rgb(var(--down-t))' : undefined }}>
                    {k.ct.toFixed(1)} s
                  </div>
                  <div className="num text-[11px] text-fg3">
                    std {k.std.toFixed(1)} · {ctDev >= 0 ? '+' : ''}
                    {ctDev.toFixed(0)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[15px] font-semibold">{fmt(k.good)}</div>
                  <div className="num text-[11px]" style={{ color: planText(p) }}>
                    {p.toFixed(0)}% target
                  </div>
                </div>
                <div className="num text-right text-[14px] font-semibold" style={{ color: k.rej > 3 ? 'rgb(var(--down-t))' : undefined }}>
                  {k.rej.toFixed(1)}%
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      {tip && (
        <div className="glass-strong pointer-events-none fixed z-[60] w-64 rounded-md p-3 text-[12px] shadow-[var(--shadow)]" style={{ left: Math.min(tip.x + 14, window.innerWidth - 270), top: tip.y + 14 }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="num text-[14px] font-semibold">{tip.m.code}</span>
            <StatePill s={tip.s.s} />
          </div>
          <div className="num">
            {clock(tip.s.start)} → {clock(tip.s.end)} · {Math.max(1, Math.round((tip.s.end - tip.s.start) / 60))} min
          </div>
          {tip.s.reason && <div className="text-fg2">{tip.s.reason}</div>}
          {tip.s.stage && <div style={{ color: tip.s.team ? TEAMS[tip.s.team].color : 'rgb(var(--down-t))' }}>{stageLabel(tip.s.stage, tip.s.team)}</div>}
          {tip.s.ticketId && <div className="num text-fg3">Ticket {tip.s.ticketId}</div>}
          <div className="mt-1 text-fg4">Click to open machine</div>
        </div>
      )}
    </div>
  );
}
