import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronRight, Layers3, LayoutGrid, Map as MapIcon, Rows3, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROLES, useSim, useWorld } from '../sim/store';
import { aggMachines, derive, hourly, machinesOfUnit, moneyOf, type Agg } from '../sim/kpi';
import { hourIdx, type World } from '../sim/engine';
import { clock, cx, fmt, inr, pct } from '../lib/format';
import { EASE, Kpi, LiveDot, Panel, PlanChip, Segmented, Sparkline, StateMix, Ticker, planColor, planText } from '../ui/primitives';
import type { Org, Unit } from '../sim/types';
import { TENANT } from '../sim/catalog';
import { notify } from '../shell/Toasts';

type Win = 'today' | 'week' | 'month';

function scaleWin(a: ReturnType<typeof derive>, u: Unit | null, win: Win) {
  if (win === 'today' || !u) return a;
  const k = win === 'week' ? 0.55 : 0.35;
  const base = { plan: 80 + u.health * 17, oee: 56 + u.health * 24, rej: 4.4 - u.health * 3 };
  return { ...a, plan: a.plan * (1 - k) + base.plan * k, oee: a.oee * (1 - k) + base.oee * k, rej: a.rej * (1 - k) + base.rej * k };
}

export function unitStats(w: World, u: Unit) {
  const ms = machinesOfUnit(w, u);
  const a = aggMachines(w, ms);
  const d = derive(a);
  const h = hourly(w, ms);
  const hi = hourIdx(w.t);
  const spark = h.out.slice(0, hi + 1).map((v, i) => (i === hi ? v / Math.max(0.05, (w.t % 3600) / 3600) : v));
  return { a, d, spark, planH: h.planH };
}

export default function Home() {
  const w = useWorld();
  const nav = useNavigate();
  const { scope, role, set, modules, basis } = useSim();
  const [view, setView] = useState<'tiles' | 'table'>('tiles');
  const [win, setWin] = useState<Win>('today');
  const [pinned, setPinned] = useState<string[]>(['MN1']);

  const orgs: Org[] = scope.kind === 'corp' ? w.orgs : scope.kind === 'org' ? [w.org[scope.id]] : [w.org[w.unit[scope.id].orgId]];
  const unitFilter = (u: Unit) => scope.kind !== 'unit' || u.id === scope.id;
  const allUnits = orgs.flatMap((o) => o.unitIds.map((id) => w.unit[id])).filter(unitFilter);
  const allMs = allUnits.flatMap((u) => machinesOfUnit(w, u));
  const A = aggMachines(w, allMs);
  const D = derive(A);
  const money = modules.money ? moneyOf(w, allMs, basis) : null;
  const greet = w.t < 6 * 3600 ? 'Good morning' : w.t < 11 * 3600 ? 'Good afternoon' : 'Good evening';
  const first = ROLES[role].name.split(' ')[0];
  const unitsDown = allUnits.filter((u) => u.machineIds.some((id) => w.machine[id].state === 'DOWN')).length;
  const alerts = w.alerts.filter((a) => a.status !== 'resolved' && allUnits.some((u) => u.id === a.unitId)).slice(0, 7);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-4 sm:p-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="overline">Thursday, {w.day} October 2026 · {TENANT.name}</div>
          <h1 className="num mt-1 text-[30px] font-bold leading-9 sm:text-[34px]">
            {greet}, {first}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Win> options={[{ v: 'today', l: 'Today' }, { v: 'week', l: 'This week' }, { v: 'month', l: 'This month' }]} value={win} onChange={setWin} />
          <Segmented<'tiles' | 'table'> options={[{ v: 'tiles', l: <span className="inline-flex items-center gap-1.5"><LayoutGrid size={14} />Tiles</span> }, { v: 'table', l: <span className="inline-flex items-center gap-1.5"><Rows3 size={14} />Table</span> }]} value={view} onChange={setView} />
          <Link to="/twin/MN1" className="btn btn-ghost"><Layers3 size={14} />Digital twin</Link>
          {allUnits.length > 1 && <Link to="/rollup" className="btn btn-ghost"><MapIcon size={14} />Roll-up map</Link>}
        </div>
      </div>

      {/* dark KPI strip */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="relative overflow-hidden rounded-[12px] border border-[#2A2F36] bg-[#111316] text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgba(242,106,33,0.12),transparent_50%)]" />
        <div className="relative grid grid-cols-2 gap-x-6 gap-y-5 p-5 md:grid-cols-3 xl:grid-cols-5">
          <Kpi
            dark
            label={<>Output vs plan · to {clock(w.t)} {win !== 'today' && '· live shift'}</>}
            value={<Ticker value={A.good} format={fmt} />}
            unit={<>/ {fmt(A.planParts)}</>}
            bar={{ v: D.plan, tone: planColor(D.plan) }}
            sub={<span><span className="num font-semibold" style={{ color: planColor(D.plan) }}>{pct(D.plan)}</span> of plan · {allUnits.length} units</span>}
            onClick={() => nav(allUnits.length === 1 ? `/unit/${allUnits[0].id}` : '/rollup')}
          />
          <Kpi dark label="OEE" value={<Ticker value={D.oee} format={(n) => n.toFixed(1)} />} unit="%" sub={<>Target 75% · A {D.A.toFixed(0)} · P {D.P.toFixed(0)} · Q {D.Q.toFixed(1)}</>} bar={{ v: D.oee, tone: D.oee >= 75 ? 'rgb(var(--run))' : D.oee >= 65 ? 'rgb(var(--idle))' : 'rgb(var(--down))' }} />
          <Kpi dark label="Rejection" value={<Ticker value={D.rej} format={(n) => n.toFixed(1)} />} unit="%" tone={D.rej > 3 ? 'down' : null} sub={<>{fmt(A.bad)} parts · limit 3.0%</>} onClick={() => nav('/records')} />
          <Kpi
            dark
            label="Machines down now"
            value={<span style={{ color: A.down ? '#FF6A5A' : undefined }}>{A.down}</span>}
            unit={<>/ {A.machines}</>}
            sub={<>{unitsDown} units · {A.run} running · {A.mc} mould change</>}
            onClick={() => nav('/breakdowns')}
          >
            <StateMix run={A.run} idle={A.idle} mc={A.mc} down={A.down} off={A.off} h={6} />
          </Kpi>
          {money ? (
            <Kpi dark label="Lost today · ₹" value={<span className="text-[#FF8A7A]"><Ticker value={money.lost} format={(n) => inr(n)} /></span>} sub={<>{pct((money.lost / money.capValue) * 100)} of value at standard · Money view →</>} onClick={() => nav('/money')} />
          ) : (
            <Kpi dark label="Mould changes" value={A.mcDone} sub="done this shift" />
          )}
        </div>
        <div className="relative flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#23272D] px-5 py-2.5 text-[12px] text-[#8A9099]">
          <LiveDot label={<span className="text-[#C9CDD3]">Live</span>} />
          {[
            ['run', 'Running'],
            ['idle', 'Idle'],
            ['mould', 'Mould change'],
            ['down', 'Down'],
            ['off', 'Offline'],
          ].map(([v, l]) => (
            <span key={v} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `rgb(var(--${v}))` }} />
              {l}
            </span>
          ))}
          <span className="ml-auto">Plan status: on track ≥ 95% · at risk 88–95% · behind &lt; 88%</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {view === 'tiles' ? (
            orgs.map((o, oi) => <OrgSection key={o.id} org={o} units={o.unitIds.map((id) => w.unit[id]).filter(unitFilter)} win={win} delay={oi * 0.06} pinned={pinned} onPin={(id) => setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} onOrg={() => set({ scope: { kind: 'org', id: o.id } })} />)
          ) : (
            <HierarchyTable orgs={orgs} units={allUnits} win={win} />
          )}
        </div>
        <Panel title="Live alerts" sub={`${w.alerts.filter((a) => a.status === 'open').length} open in scope`} right={<Link to="/alerts" className="text-[12px] font-semibold text-brand hover:underline">View all</Link>} className="h-fit xl:sticky xl:top-4">
          <div className="-mx-1 flex flex-col">
            {alerts.length === 0 && <div className="py-6 text-center text-[13px] text-fg3">All clear · No open alerts in this scope</div>}
            {alerts.map((a, i) => (
              <motion.button
                key={a.id}
                layout
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3, ease: EASE }}
                onClick={() => nav(a.machineId ? `/machine/${a.machineId}` : '/alerts')}
                className="flex gap-3 rounded-md px-1 py-2.5 text-left transition hover:bg-panel3/60"
              >
                <span className="w-1 shrink-0 rounded-full" style={{ background: a.severity === 'critical' ? 'rgb(var(--down))' : a.severity === 'warning' ? 'rgb(var(--idle))' : 'rgb(var(--mould))' }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg3">
                    <span className="truncate">
                      {w.unit[a.unitId].name}
                      {a.machineId && ` · ${w.machine[a.machineId].code}`}
                    </span>
                    <span className="num">{clock(a.t)}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-[18px]">{a.title}</span>
                  <span className={cx('text-[11px]', a.status === 'ack' ? 'text-run-t' : a.escalated ? 'text-down-t' : 'text-fg4')}>{a.status === 'ack' ? `Ack · ${a.ackBy}` : a.escalated ? 'Open · escalated' : 'Open'}</span>
                </span>
              </motion.button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function OrgSection({ org, units, win, delay, pinned, onPin, onOrg }: { org: Org; units: Unit[]; win: Win; delay: number; pinned: string[]; onPin: (id: string) => void; onOrg: () => void }) {
  const w = useWorld();
  const ms = units.flatMap((u) => machinesOfUnit(w, u));
  const a = aggMachines(w, ms);
  const d = scaleWin(derive(a), null, win);
  const sorted = [...units].sort((x, y) => Number(pinned.includes(y.id)) - Number(pinned.includes(x.id)));
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4, ease: EASE }} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line/70 pb-2">
        <h2 className="num text-[20px] font-bold uppercase tracking-[0.04em]">{org.name}</h2>
        <span className="text-[12px] text-fg3">{org.city} · {units.length} units · {org.head}</span>
        <div className="ml-auto flex flex-wrap items-center gap-4 text-[13px]">
          <span>
            Plan <b className="num" style={{ color: planText(d.plan) }}>{pct(d.plan)}</b>
          </span>
          <span>
            OEE <b className="num">{pct(d.oee)}</b>
          </span>
          <span>
            Reject <b className="num" style={{ color: d.rej > 3 ? 'rgb(var(--down-t))' : undefined }}>{pct(d.rej)}</b>
          </span>
          <span>
            Down <b className="num" style={{ color: a.down ? 'rgb(var(--down-t))' : undefined }}>{a.down}</b>
          </span>
          <button onClick={onOrg} className="text-[12px] font-semibold text-brand hover:underline">
            Org view →
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4" style={{ gridTemplateColumns: undefined }}>
        {sorted.map((u, i) => (
          <UnitTile key={u.id} u={u} win={win} i={i} pinned={pinned.includes(u.id)} onPin={() => onPin(u.id)} />
        ))}
      </div>
    </motion.section>
  );
}

function UnitTile({ u, win, i, pinned, onPin }: { u: Unit; win: Win; i: number; pinned: boolean; onPin: () => void }) {
  const w = useWorld();
  const nav = useNavigate();
  const { a, d: d0, spark, planH } = unitStats(w, u);
  const d = scaleWin(d0, u, win);
  const down = u.machineIds.map((id) => w.machine[id]).filter((m) => m.state === 'DOWN');
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + i * 0.04, duration: 0.35, ease: EASE }}
      whileHover={{ y: -3 }}
      onClick={() => nav(`/unit/${u.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && nav(`/unit/${u.id}`)}
      role="link"
      tabIndex={0}
      aria-label={`${u.name}, ${pct(d.plan)} of plan`}
      className="glass spotlight group relative cursor-pointer overflow-hidden !rounded-[10px] p-4"
      style={{ borderTop: `3px solid ${planColor(d.plan)}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <motion.div layoutId={`unit-title-${u.id}`} className="num truncate text-[18px] font-semibold leading-6">
          {u.name}
        </motion.div>
        <div className="flex items-center gap-1.5">
          <PlanChip p={d.plan} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
              notify({ tone: 'info', title: pinned ? `${u.name} unpinned` : `${u.name} pinned to top` });
            }}
            className={cx('grid h-6 w-6 place-items-center rounded text-fg4 transition hover:text-brand', pinned && '!text-brand')}
            aria-label={pinned ? 'Unpin unit' : 'Pin unit'}
          >
            <Star size={13} fill={pinned ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="num text-[34px] font-bold leading-9" style={{ color: planText(d.plan) }}>
            <Ticker value={d.plan} format={(n) => `${n.toFixed(1)}%`} />
          </div>
          <div className="text-[12px] text-fg3">
            of plan · <span className="num">{fmt(a.good)}</span> / <span className="num">{fmt(a.planParts)}</span>
          </div>
        </div>
        <Sparkline data={spark} plan={planH} w={92} h={34} color="rgb(var(--fg2))" />
      </div>
      <div className="mt-3 flex items-center gap-4 text-[12px] text-fg3">
        <span>
          OEE <b className="num text-[14px] text-fg">{pct(d.oee)}</b>
        </span>
        <span>
          Rej <b className="num text-[14px]" style={{ color: d.rej > 3 ? 'rgb(var(--down-t))' : 'rgb(var(--fg))' }}>{pct(d.rej)}</b>
        </span>
        <span className="ml-auto num">{u.city}</span>
      </div>
      <StateMix run={a.run} idle={a.idle} mc={a.mc} down={a.down} off={a.off} className="mt-3" />
      <div className="mt-2 flex items-center justify-between text-[12px]">
        <span className="text-fg2">
          <b className="num">{a.run}</b>/{a.machines} running · <b className="num" style={{ color: a.down ? 'rgb(var(--down-t))' : undefined }}>{a.down}</b> down
        </span>
        <ArrowRight size={14} className="text-fg4 transition group-hover:translate-x-0.5 group-hover:text-brand" />
      </div>
      {down[0] && (
        <div className="mt-2 truncate rounded bg-down/10 px-2 py-1 text-[11px] font-semibold text-down-t">
          {down[0].code} · {down[0].reasonLogged ? down[0].reason : 'no reason logged'}
          {down.length > 1 && ` · +${down.length - 1} more`}
        </div>
      )}
    </motion.div>
  );
}

function HierarchyTable({ orgs, units, win }: { orgs: Org[]; units: Unit[]; win: Win }) {
  const w = useWorld();
  const nav = useNavigate();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [behindFirst, setBehindFirst] = useState(true);
  const rows = useMemo(() => {
    const list: { kind: 'corp' | 'org' | 'unit'; id: string; name: string; sub: string; a: Agg; d: ReturnType<typeof derive>; spark: number[] }[] = [];
    const all = aggMachines(w, units.flatMap((u) => machinesOfUnit(w, u)));
    list.push({ kind: 'corp', id: 'corp', name: `Corporate · ${TENANT.name}`, sub: `${orgs.length} organisations · ${units.length} units`, a: all, d: derive(all), spark: [] });
    const os = orgs.map((o) => {
      const us = o.unitIds.map((id) => w.unit[id]).filter((u) => units.includes(u));
      const a = aggMachines(w, us.flatMap((u) => machinesOfUnit(w, u)));
      return { o, us, a, d: scaleWin(derive(a), null, win) };
    });
    if (behindFirst) os.sort((x, y) => x.d.plan - y.d.plan);
    for (const { o, us, a, d } of os) {
      list.push({ kind: 'org', id: o.id, name: o.name, sub: `${o.city} · ${us.length} units · ${o.head}`, a, d, spark: [] });
      if (open[o.id] ?? true) {
        const ur = us.map((u) => ({ u, ...unitStats(w, u) }));
        if (behindFirst) ur.sort((x, y) => x.d.plan - y.d.plan);
        for (const r of ur) list.push({ kind: 'unit', id: r.u.id, name: r.u.name, sub: `${r.u.machineIds.length} machines · ${r.u.head}`, a: r.a, d: scaleWin(r.d, r.u, win), spark: r.spark });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.t, open, behindFirst, win, orgs, units]);

  return (
    <Panel
      title="Hierarchy · corporate → organisation → unit"
      sub="Sorted by plan attainment so the units that need help are on top"
      right={
        <>
          <button className={cx('chip', behindFirst && 'chip-on')} onClick={() => setBehindFirst((v) => !v)}>
            Behind plan first
          </button>
          <button className="chip" onClick={() => setOpen(Object.fromEntries(orgs.map((o) => [o.id, !(open[o.id] ?? true)])))}>
            Expand / collapse
          </button>
        </>
      }
      bodyClass="!p-0"
    >
      <div className="overflow-x-auto">
        <table className="tbl w-full min-w-[900px] text-[13px]">
          <thead>
            <tr>
              <th>Name</th>
              <th className="!text-right">OEE</th>
              <th>Output vs plan</th>
              <th className="!text-right">Reject</th>
              <th>Machines</th>
              <th>Last 6 h</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kind + r.id} className={cx('row-click', r.kind === 'corp' && 'bg-panel3/50', r.kind === 'org' && 'bg-panel2/40')} onClick={() => (r.kind === 'org' ? setOpen((o) => ({ ...o, [r.id]: !(o[r.id] ?? true) })) : r.kind === 'unit' ? nav(`/unit/${r.id}`) : undefined)}>
                <td style={{ paddingLeft: 12 + (r.kind === 'org' ? 18 : r.kind === 'unit' ? 40 : 0) }}>
                  <div className="flex items-center gap-2">
                    {r.kind === 'org' && ((open[r.id] ?? true) ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                    <div>
                      <div className={cx('num', r.kind === 'unit' ? 'text-[15px] font-semibold' : 'text-[18px] font-semibold')}>{r.name}</div>
                      <div className="text-[11px] text-fg3">{r.sub}</div>
                    </div>
                  </div>
                </td>
                <td className="num !text-right text-[15px] font-semibold">{pct(r.d.oee)}</td>
                <td className="w-[260px]">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.d.plan)}%`, background: planColor(r.d.plan) }} />
                    </div>
                    <span className="num w-12 text-right font-semibold" style={{ color: planText(r.d.plan) }}>{pct(r.d.plan)}</span>
                  </div>
                  <div className="num mt-0.5 text-[11px] text-fg3">
                    {fmt(r.a.good)} / {fmt(r.a.planParts)}
                  </div>
                </td>
                <td className="num !text-right font-semibold" style={{ color: r.d.rej > 3 ? 'rgb(var(--down-t))' : undefined }}>{pct(r.d.rej)}</td>
                <td className="w-[180px]">
                  <StateMix run={r.a.run} idle={r.a.idle} mc={r.a.mc} down={r.a.down} off={r.a.off} />
                  <div className="mt-1 text-[11px] text-fg3">
                    {r.a.machines} · <span style={{ color: r.a.down ? 'rgb(var(--down-t))' : undefined }}>{r.a.down} down</span>
                  </div>
                </td>
                <td>{r.spark.length > 1 ? <Sparkline data={r.spark} w={110} h={26} color="rgb(var(--fg2))" /> : <span className="text-fg4">—</span>}</td>
                <td>{r.kind === 'unit' && <span className="btn btn-primary !h-7 !px-2.5 !text-[12px]">Open →</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
