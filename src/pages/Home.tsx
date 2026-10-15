import { motion } from 'framer-motion';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROLES, useSim, useWorld } from '../sim/store';
import { aggMachines, derive, hourly, machinesOfUnit, moneyOf } from '../sim/kpi';
import { hourIdx, type World } from '../sim/engine';
import { clock, cx, fmt, inr, pct } from '../lib/format';
import { EASE, Segmented, Sparkline, StateMix, Ticker, planColor } from '../ui/primitives';
import { Bullet, Ring } from '../ui/charts';
import type { Org, Unit } from '../sim/types';
import type { NetOrg } from '../three/GroupNetwork';

const Stage = lazy(() => import('../three/Stage'));
const GroupNetwork = lazy(() => import('../three/GroupNetwork'));

type Win = 'today' | 'week' | 'month';

export function unitStats(w: World, u: Unit) {
  const ms = machinesOfUnit(w, u);
  const a = aggMachines(w, ms);
  const d = derive(a);
  const h = hourly(w, ms);
  const hi = hourIdx(w.t);
  const spark = h.out.slice(0, hi + 1).map((v, i) => (i === hi ? v / Math.max(0.05, (w.t % 3600) / 3600) : v));
  return { a, d, spark, planH: h.planH };
}

function useWide() {
  const [wide, setWide] = useState(typeof window === 'undefined' || window.innerWidth >= 768);
  useEffect(() => {
    const r = () => setWide(window.innerWidth >= 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  return wide;
}

export default function Home() {
  const w = useWorld();
  const nav = useNavigate();
  const { scope, role, modules, basis } = useSim();
  const [win, setWin] = useState<Win>('today');
  const wide = useWide();

  const orgs: Org[] = scope.kind === 'corp' ? w.orgs : scope.kind === 'org' ? [w.org[scope.id]] : [w.org[w.unit[scope.id].orgId]];
  const unitFilter = (u: Unit) => scope.kind !== 'unit' || u.id === scope.id;
  const allUnits = orgs.flatMap((o) => o.unitIds.map((id) => w.unit[id])).filter(unitFilter);
  const allMs = allUnits.flatMap((u) => machinesOfUnit(w, u));
  const A = aggMachines(w, allMs);
  const D = derive(A);
  const money = modules.money ? moneyOf(w, allMs, basis) : null;
  const greet = w.t < 6 * 3600 ? 'Good morning' : w.t < 11 * 3600 ? 'Good afternoon' : 'Good evening';
  const first = ROLES[role].name.split(' ')[0];
  const alerts = w.alerts.filter((a) => a.status === 'open' && allUnits.some((u) => u.id === a.unitId)).slice(0, 5);

  const net: NetOrg[] = orgs.map((o) => {
    const us = o.unitIds.map((id) => w.unit[id]).filter(unitFilter);
    const oa = derive(aggMachines(w, us.flatMap((u) => machinesOfUnit(w, u))));
    return {
      id: o.id,
      name: o.name,
      plan: oa.plan,
      units: us.map((u) => {
        const s = unitStats(w, u);
        return { id: u.id, name: u.name, plan: s.d.plan, oee: s.d.oee, good: s.a.good, down: s.a.down };
      }),
    };
  });

  const stats: { l: string; v: number; f: (n: number) => string; sub: string; to: string; tone?: string }[] = [
    { l: 'Output vs plan', v: D.plan, f: (n) => `${n.toFixed(1)}%`, sub: `${fmt(A.good)} of ${fmt(A.planParts)} parts`, to: '/rollup', tone: planColor(D.plan) },
    { l: 'OEE', v: D.oee, f: (n) => `${n.toFixed(1)}%`, sub: 'target 75%', to: `/unit/${allUnits[0]?.id ?? 'MN1'}` },
    { l: 'Machines down', v: A.down, f: (n) => `${Math.round(n)}`, sub: `of ${A.machines} · ${A.run} running`, to: '/breakdowns' },
    money ? { l: 'Lost today', v: money.lost, f: (n) => inr(n), sub: `${pct((money.lost / money.capValue) * 100)} of value`, to: '/money' } : { l: 'Rejects', v: D.rej, f: (n) => `${n.toFixed(1)}%`, sub: 'limit 3.0%', to: '/records' },
  ];

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Thu {w.day} Oct · live {clock(w.t)}</div>
          <h1 className="mt-1.5 text-[24px] font-normal tracking-[-0.02em]">
            {greet}, {first}
          </h1>
        </div>
        <Segmented<Win> size="sm" options={[{ v: 'today', l: 'Today' }, { v: 'week', l: 'Week' }, { v: 'month', l: 'Month' }]} value={win} onChange={setWin} />
      </div>

      {/* headline numbers: four, no boxes */}
      <div data-tour="home-kpis" className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.button key={s.l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, ease: EASE }} onClick={() => nav(s.to)} className="group flex flex-col items-start gap-1 text-left">
            <span className="eyebrow flex items-center gap-1.5">
              {s.tone && <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.tone }} />}
              {s.l}
            </span>
            <span className="text-[34px] font-normal leading-[40px] tracking-[-0.035em]">
              <Ticker value={s.v} format={s.f} />
            </span>
            <span className="flex items-center gap-1 text-[12px] text-fg3">
              {s.sub}
              <ArrowUpRight size={12} className="opacity-0 transition group-hover:opacity-100" />
            </span>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
        {/* the group as a 3D diagram */}
        <div data-tour="home-network" className="relative h-[440px] overflow-hidden rounded-[20px] border border-line bg-[radial-gradient(ellipse_at_50%_40%,rgb(var(--panel)),rgb(var(--bg2)))] sm:h-[500px]">
          {wide ? (
            <Suspense fallback={null}>
              <Stage className="absolute inset-0" bg="transparent" bloom={false} orthographic camera={{ position: [28, 24, 28], zoom: 21, near: -100, far: 200 }}>
                <GroupNetwork orgs={net} onUnit={(id) => nav(`/unit/${id}`)} />
              </Stage>
            </Suspense>
          ) : (
            <FlatNetwork net={net} onUnit={(id) => nav(`/unit/${id}`)} />
          )}
          <div className="pointer-events-none absolute left-5 top-5">
            <div className="eyebrow">The group, live</div>
            <div className="mt-1 text-[12px] text-fg3">Tower height = output · cap = plan status</div>
          </div>
          <div className="pointer-events-none absolute bottom-5 left-5 flex gap-4 text-[11px] text-fg3">
            {[
              ['run', 'On track'],
              ['idle', 'At risk'],
              ['down', 'Behind'],
            ].map(([v, l]) => (
              <span key={v} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[3px]" style={{ background: `rgb(var(--${v}))` }} />
                {l}
              </span>
            ))}
          </div>
          <Link to="/twin/MN1" className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-panel/90 px-3.5 py-1.5 text-[12px] font-medium shadow-[var(--card-shadow)] transition hover:bg-panel">
            Walk the factory floor <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* live alerts: a quiet list */}
        <div data-tour="home-alerts" className="flex flex-col gap-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">Needs attention</span>
            <Link to="/alerts" className="text-[12px] text-fg3 hover:text-fg">
              All {w.alerts.filter((a) => a.status === 'open').length}
            </Link>
          </div>
          {alerts.length === 0 && <div className="py-6 text-[12px] text-fg3">All clear.</div>}
          {alerts.map((a, i) => (
            <motion.button key={a.id} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} onClick={() => nav(a.machineId ? `/machine/${a.machineId}` : '/alerts')} className="group flex gap-3 rounded-[10px] px-2 py-2.5 text-left transition hover:bg-panel3/70">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.severity === 'critical' ? 'rgb(var(--down))' : a.severity === 'warning' ? 'rgb(var(--idle))' : 'rgb(var(--mould))' }} />
              <span className="min-w-0">
                <span className="block text-[12.5px] leading-[18px]">{a.title}</span>
                <span className="mt-0.5 block text-[11px] text-fg4">
                  {w.unit[a.unitId].name} · {clock(a.t)}
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* plants: one line each */}
      <section data-tour="home-units" className="flex flex-col gap-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="eyebrow">Plants · behind plan first</span>
          <span className="flex items-center gap-4 text-[11px] text-fg4">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-[2px] bg-brand" />
              plan
            </span>
            <span>OEE ring</span>
            <span>machines</span>
          </span>
        </div>
        {orgs.map((o) => (
          <div key={o.id} className="flex flex-col">
            <div className="eyebrow mt-4 pb-2 !text-fg4">{o.name}</div>
            {o.unitIds
              .map((id) => w.unit[id])
              .filter(unitFilter)
              .map((u) => ({ u, ...unitStats(w, u) }))
              .sort((x, y) => x.d.plan - y.d.plan)
              .map(({ u, a, d, spark, planH }, i) => (
                <motion.button
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => nav(`/unit/${u.id}`)}
                  className="group grid grid-cols-[minmax(110px,1.2fr)_minmax(90px,2fr)_56px_36px] items-center gap-4 border-t border-line/70 py-3 text-left transition hover:bg-panel3/40 sm:grid-cols-[minmax(150px,1.2fr)_minmax(160px,2.4fr)_64px_40px_minmax(110px,1fr)_100px_20px]"
                >
                  <span className="truncate text-[13px]">{u.name}</span>
                  <Bullet actual={a.good} plan={a.planParts} tone={planColor(d.plan)} h={5} />
                  <span className="num text-right text-[13px]">{d.plan.toFixed(1)}%</span>
                  <Ring v={d.oee} size={30} stroke={3} color="rgb(var(--fg) / 0.7)">
                    <span className="num text-[8.5px]">{d.oee.toFixed(0)}</span>
                  </Ring>
                  <span className="hidden sm:block">
                    <StateMix run={a.run} idle={a.idle} mc={a.mc} down={a.down} off={a.off} h={5} />
                  </span>
                  <span className="hidden sm:block">
                    <Sparkline data={spark} plan={planH} w={100} h={22} color="rgb(var(--fg) / 0.6)" />
                  </span>
                  <ChevronRight size={14} className="hidden text-fg4 transition group-hover:translate-x-0.5 group-hover:text-fg sm:block" />
                </motion.button>
              ))}
          </div>
        ))}
      </section>
    </div>
  );
}

/** Phone fallback: same story as flat columns. */
function FlatNetwork({ net, onUnit }: { net: NetOrg[]; onUnit: (id: string) => void }) {
  const max = Math.max(1, ...net.flatMap((o) => o.units.map((u) => u.good)));
  return (
    <div className="flex h-full items-end justify-around gap-3 px-4 pb-14 pt-16">
      {net.map((o) => (
        <div key={o.id} className="flex flex-col items-center gap-2">
          <div className="flex items-end gap-1">
            {o.units.map((u) => (
              <button key={u.id} onClick={() => onUnit(u.id)} className="w-4 rounded-t-[4px] bg-fg/15" style={{ height: 20 + (u.good / max) * 160, boxShadow: `inset 0 3px 0 ${planColor(u.plan)}` }} aria-label={u.name} />
            ))}
          </div>
          <span className={cx('eyebrow !text-[9px]')}>{o.name.replace('Apex ', '')}</span>
        </div>
      ))}
    </div>
  );
}
