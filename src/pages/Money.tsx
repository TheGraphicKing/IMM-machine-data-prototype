import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Lightbulb, Mail, Map as MapIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSim, useWorld } from '../sim/store';
import { OWNER_META, aggMachines, derive, machinesOfOrg, machinesOfUnit, moneyOf, orderRisk, type Money as MoneyT, type ValueBasis } from '../sim/kpi';
import type { World } from '../sim/engine';
import { DAY, TEAMS } from '../sim/catalog';
import { h01 } from '../sim/records';
import { clock, cx, fmt, inr, pct } from '../lib/format';
import { EASE, Panel, Segmented, Ticker, planText, stageLabel } from '../ui/primitives';
import { notify } from '../shell/Toasts';
import type { Machine } from '../sim/types';

type Win = 'today' | 'yesterday' | 'mtd' | 'quarter';

export function useMoney() {
  const w = useWorld();
  const basis = useSim((s) => s.basis);
  return useMemo(() => buildMoney(w, basis), [w.t, basis]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function buildMoney(w: World, basis: ValueBasis) {
  const all = moneyOf(w, w.machines, basis);
  const elapsed = Math.max(3600, w.t);
  const dayProj = (all.lost * DAY) / elapsed;
  const dayBudget = Math.round((dayProj * 0.82) / 10000) * 10000;
  const past = Array.from({ length: w.day - 1 }, (_, i) => dayProj * (0.72 + h01(`d${i}`) * 0.5));
  const mtd = past.reduce((a, b) => a + b, 0) + all.lost;
  const budgetMtd = dayBudget * (w.day - 1 + elapsed / DAY);
  const proj = (mtd / (w.day - 1 + elapsed / DAY)) * 31;
  const yday = all.lost * (0.78 + h01(`y${w.day}`) * 0.08);
  const byOrg = w.orgs.map((o) => {
    const ms = machinesOfOrg(w, o.id);
    const m = moneyOf(w, ms, basis);
    return { o, m, plan: derive(aggMachines(w, ms)).plan };
  }).sort((a, b) => b.m.lost - a.m.lost);
  const byUnit = w.units.map((u) => {
    const ms = machinesOfUnit(w, u);
    const m = moneyOf(w, ms, basis);
    const top = Object.entries(m.byOwner).filter(([k]) => k !== 'speed' || true).sort((a, b) => b[1] - a[1])[0];
    return { u, m, plan: derive(aggMachines(w, ms)).plan, top, trend: h01(u.id + w.day) };
  }).sort((a, b) => b.m.lost - a.m.lost);
  const risks = w.orders.map((o) => ({ o, r: orderRisk(w, o) })).filter((x) => x.r.short > 50).sort((a, b) => b.r.value - a.r.value);
  const leaks = w.machines
    .map((m) => ({ m, v: leakValue(w, m, basis) }))
    .filter((x) => x.v.value > 0)
    .sort((a, b) => b.v.value - a.v.value)
    .slice(0, 5);
  const mcDone = w.machines.reduce((a, m) => a + m.mcDone, 0);
  const mcPlanned = mcDone + w.machines.filter((m) => m.state === 'MC').length + 4;
  return { all, dayBudget, mtd, budgetMtd, proj, yday, byOrg, byUnit, risks, leaks, past, mcDone, mcPlanned };
}

function leakValue(w: World, m: Machine, basis: ValueBasis) {
  const md = w.mould[m.mouldId];
  const std = md?.stdCycle ?? 30;
  const cav = md?.positions.length ?? 1;
  const p = w.part[md?.positions[0].partId ?? ''];
  const v = basis === 'cm' ? (p ? p.sell - p.material$ - p.conv : 40) : p?.sell ?? 100;
  if (m.state === 'DOWN' || m.state === 'IDLE') {
    const sec = w.t - m.since;
    const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
    return { value: (sec / std) * cav * v, cause: m.reasonLogged ? m.reason : 'no reason logged', dur: sec, owner: tk ? stageLabel(tk.stage, tk.team) : m.state === 'IDLE' ? `IDLE · ${m.team ? TEAMS[m.team].label : ''}` : 'NOT ASSIGNED', color: tk?.team ? TEAMS[tk.team].color : m.state === 'IDLE' ? '#B8954A' : '#B9533F' };
  }
  const rej = m.rejBase + m.rejSpike;
  if (rej > 0.035) return { value: m.bad * v + m.bad * (p?.material$ ?? 20), cause: `reject ${(rej * 100).toFixed(1)}% · short shots / flash`, dur: m.runSec, owner: 'QUALITY ASSIGNED', color: TEAMS.quality.color };
  if (m.cycleFactor > 1.06) return { value: Math.max(0, m.runStdParts - m.parts) * v, cause: `slow cycle +${((m.cycleFactor - 1) * 100).toFixed(0)}%`, dur: m.runSec, owner: 'NO OWNER', color: '#B9533F' };
  return { value: 0, cause: '', dur: 0, owner: '', color: '' };
}

export default function Money({ view }: { view: 'money' | 'briefing' }) {
  const { basis, set } = useSim();
  const nav = useNavigate();
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="overline">CEO · Apex Polymers Group · live to {clock(useWorld().t)}</div>
          <h1 className="num mt-1 text-[30px] font-bold leading-9">{view === 'money' ? 'Where we are losing money' : `CEO briefing · Thursday ${useWorld().day} October`}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<'money' | 'briefing'> options={[{ v: 'money', l: 'Money view' }, { v: 'briefing', l: 'Morning briefing' }]} value={view} onChange={(v) => nav(v === 'money' ? '/money' : '/briefing')} />
        </div>
      </div>
      <div className="glass flex flex-wrap items-center justify-between gap-3 !rounded-[10px] px-4 py-2.5 text-[13px]">
        <span className="text-fg2">{basis === 'cm' ? 'Valued at contribution margin (selling price − material − variable conversion) · scrap & energy at cost' : 'Valued at selling price · scrap & energy at cost'}</span>
        <Segmented<ValueBasis> size="sm" options={[{ v: 'cm', l: 'Contribution margin' }, { v: 'sp', l: 'Selling price' }]} value={basis} onChange={(v) => set({ basis: v })} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
          {view === 'money' ? <MoneyView /> : <Briefing />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MoneyView() {
  const w = useWorld();
  const nav = useNavigate();
  const basis = useSim((s) => s.basis);
  const M = useMoney();
  const [win, setWin] = useState<Win>('today');
  const [drill, setDrill] = useState<string | null>(null);
  const k = win === 'today' ? 1 : win === 'yesterday' ? 1.24 * (DAY / Math.max(3600, w.t)) / 4.2 : win === 'mtd' ? M.mtd / Math.max(1, M.all.lost) : (M.mtd / Math.max(1, M.all.lost)) * 5.6;
  const a = M.all;
  const scale = (x: number) => x * k;
  const risk = M.risks.reduce((s, r) => s + r.r.value, 0);
  const owners = Object.entries(a.byOwner).sort((x, y) => y[1] - x[1]);
  const maxOwner = owners[0]?.[1] ?? 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Win> options={[{ v: 'today', l: 'Today' }, { v: 'yesterday', l: 'Yesterday' }, { v: 'mtd', l: 'Month to date' }, { v: 'quarter', l: 'Quarter' }]} value={win} onChange={setWin} />
        {win !== 'today' && <span className="text-[12px] text-fg3">Historical windows replay stored daily closes · today is live</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="glass col-span-2 overflow-hidden p-5 lg:col-span-1">
          <div className="overline !text-fg3">Lost {win === 'today' ? `today · to ${clock(w.t)}` : win === 'yesterday' ? 'yesterday' : win === 'mtd' ? 'month to date' : 'this quarter'}</div>
          <div className="num mt-1 text-[40px] font-bold leading-[44px] text-down-t">
            <Ticker value={scale(a.lost)} format={(n) => inr(n)} />
          </div>
          <div className="text-[12px] text-fg3">
            {pct((a.lost / a.capValue) * 100)} of value at standard{win === 'today' && <> · yesterday same time {inr(M.yday)}</>}
          </div>
        </div>
        {[
          [basis === 'cm' ? 'Contribution earned' : 'Output value (sales)', inr(scale(a.actual)), `of ${inr(scale(a.capValue))} at standard · plan ${inr(scale(a.planValue))}`],
          ['Month-to-date loss', inr(M.mtd), `${inr(M.mtd - M.budgetMtd)} ${M.mtd > M.budgetMtd ? 'over' : 'under'} budget (${M.mtd > M.budgetMtd ? '+' : ''}${(((M.mtd - M.budgetMtd) / M.budgetMtd) * 100).toFixed(0)}%)`, M.mtd > M.budgetMtd],
          ['Dispatch at risk today', inr(risk), `Sales value · ${new Set(M.risks.map((r) => r.o.customer)).size} customers · ${fmt(M.risks.reduce((s, r) => s + r.r.short, 0))} parts short`, risk > 0],
          ['Mould changes today', `${M.mcDone} / ${M.mcPlanned}`, `avg 38 min vs 30 std · overrun ${inr(a.mouldChange * 0.3)}`],
        ].map(([l, v, s, red], i) => (
          <motion.div key={l as string} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }} className="glass !rounded-[12px] p-5">
            <div className="overline">{l}</div>
            <div className="num mt-1 text-[30px] font-bold leading-9" style={{ color: red ? 'rgb(var(--down-t))' : undefined }}>{v}</div>
            <div className="text-[12px] text-fg3">{s}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="From value at standard to actual · ₹" sub="Click a bar to see units and causes · bars build in order and reconcile to the rupee">
          <Waterfall m={a} k={k} onBar={setDrill} drill={drill} />
          <AnimatePresence>{drill && <Drill key={drill} kind={drill} onClose={() => setDrill(null)} />}</AnimatePresence>
        </Panel>
        <Panel title="Loss by cause owner" sub={`${win === 'today' ? 'today' : win} · ₹`}>
          <div className="flex flex-col gap-2.5">
            {owners.map(([key, v], i) => (
              <div key={key}>
                <div className="flex justify-between text-[13px]">
                  <span className={cx('flex items-center gap-2', key === 'unassigned' && 'text-down-t')}>
                    <span className={cx('h-2 w-2 rounded-full', key === 'unassigned' && 'pat-unassigned')} style={{ background: key === 'unassigned' ? undefined : OWNER_META[key]?.color }} />
                    {OWNER_META[key]?.label ?? key}
                  </span>
                  <span className="num font-semibold">{inr(scale(v))}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/60">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(v / maxOwner) * 100}%` }} transition={{ delay: i * 0.06, duration: 0.6, ease: EASE }} className={cx('h-full rounded-full', key === 'unassigned' && 'pat-unassigned')} style={{ background: key === 'unassigned' ? undefined : i === 0 ? 'rgb(var(--fg) / 0.8)' : 'rgb(var(--fg) / 0.32)' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-md bg-down/10 px-3 py-2 text-[12px] font-semibold text-down-t">{inr(scale(a.byOwner.unassigned ?? 0))} came from stops nobody assigned to a team.</div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Top 5 money leaks right now" sub="Owner and status from breakdown tickets" className="xl:col-span-2">
          <div className="flex flex-col">
            {M.leaks.map(({ m, v }, i) => (
              <motion.button key={m.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} onClick={() => nav(`/machine/${m.id}`)} className="flex items-center gap-3 border-b border-line/50 py-2.5 text-left transition hover:bg-panel3/40">
                <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-panel3 text-[13px] font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">
                    {w.unit[m.unitId].name} · {m.code} · {v.cause}
                  </span>
                  <span className="block truncate text-[12px] text-fg3">
                    {m.state === 'DOWN' || m.state === 'IDLE' ? `Stopped ${Math.round(v.dur / 60)} min` : 'This shift'} · {w.part[w.mould[m.mouldId].positions[0].partId]?.customer} · {w.part[w.mould[m.mouldId].positions[0].partId]?.name}
                  </span>
                </span>
                <span className="hidden shrink-0 rounded-[3px] px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] sm:inline" style={{ color: v.color, background: `${v.color}22` }}>
                  {v.owner}
                </span>
                <span className="num w-20 shrink-0 text-right text-[16px] font-bold text-down-t">{inr(v.value)}</span>
              </motion.button>
            ))}
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="By organisation · today">
            {M.byOrg.map(({ o, m, plan }) => (
              <div key={o.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                <span className="w-24 font-semibold">{o.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(m.lost / M.byOrg[0].m.lost) * 100}%` }} transition={{ duration: 0.6, ease: EASE }} className="h-full rounded-full bg-fg/70" />
                </div>
                <span className="num w-16 text-right font-semibold">{inr(m.lost)}</span>
                <span className="num w-14 text-right text-[12px]" style={{ color: planText(plan) }}>{pct(plan)}</span>
              </div>
            ))}
          </Panel>
          <Panel title="Customer dispatch at risk" right={<Link to="/dispatch" className="text-[12px] font-semibold text-brand hover:underline">Gate →</Link>}>
            {M.risks.slice(0, 4).map(({ o, r }) => (
              <div key={o.id} className="flex items-start justify-between gap-3 border-b border-line/50 py-2 text-[13px]">
                <div>
                  <div className="font-semibold">{o.customer} · {r.part?.name}</div>
                  <div className="text-[12px] text-fg3">{fmt(r.short)} parts short for {o.truck} · {w.unit[o.unitId].name}</div>
                </div>
                <span className="num font-bold text-down-t">{inr(r.value)}</span>
              </div>
            ))}
            {M.risks.length === 0 && <div className="py-3 text-[13px] text-run-t">Every truck today is covered by stock + projected output.</div>}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Waterfall({ m, k, onBar, drill }: { m: MoneyT; k: number; onBar: (s: string) => void; drill: string | null }) {
  const cap = m.capValue;
  const stops = m.downtime + m.idle;
  const steps: { key: string; l: string; s: string; v: number; c: string; base?: boolean; extra?: boolean }[] = [
    { key: 'cap', l: 'Value at standard', s: 'full capacity to now · plan at 82%', v: cap, c: 'rgb(var(--fg) / 0.85)', base: true },
    { key: 'down', l: 'Downtime', s: 'machines stopped or idle', v: -stops, c: 'rgb(var(--down) / 0.9)' },
    { key: 'mc', l: 'Mould change', s: 'changeover time', v: -m.mouldChange, c: 'rgb(var(--down) / 0.65)' },
    { key: 'speed', l: 'Speed loss', s: 'cycle slower than std', v: -m.speed, c: 'rgb(var(--down) / 0.45)' },
    { key: 'rej', l: 'Rejects', s: 'NOT OK parts, lost sale', v: -m.rejects, c: 'rgb(var(--down) / 0.3)' },
    { key: 'actual', l: 'Actual', s: 'earned', v: m.actual, c: 'rgb(var(--run) / 0.85)', base: true },
    { key: 'cash', l: '+ Cash costs', s: 'scrap material + idle energy', v: -(m.scrap + m.energy), c: 'rgb(var(--fg4))', extra: true },
  ];
  let x = 0;
  const bars = steps.map((st) => {
    let left: number;
    let wd: number;
    if (st.base) {
      left = 0;
      wd = (Math.abs(st.v) / cap) * 100;
      x = wd;
    } else if (st.extra) {
      wd = (-st.v / cap) * 100;
      left = Math.max(0, (m.actual / cap) * 100 - wd);
    } else {
      wd = (-st.v / cap) * 100;
      left = x - wd;
      x = left;
    }
    return { ...st, left, wd: Math.max(0.6, wd) };
  });
  const planX = (m.planValue / cap) * 100;
  return (
    <div className="relative flex flex-col gap-2.5">
      <div className="absolute bottom-0 top-0 z-[1] border-l border-dashed border-fg3/60" style={{ left: `calc(170px + (100% - 170px - 96px) * ${planX / 100})` }}>
        <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[10px] font-semibold text-fg3">PPC plan</span>
      </div>
      {bars.map((b, i) => (
        <button key={b.key} onClick={() => !b.base && onBar(b.key)} className={cx('grid grid-cols-[170px_minmax(0,1fr)_96px] items-center gap-0 rounded-md py-1 text-left transition', !b.base && 'hover:bg-panel3/40', drill === b.key && 'bg-brand/10')}>
          <span className="pr-3">
            <span className="block text-[14px] font-semibold">{b.l}</span>
            <span className="block text-[11px] text-fg3">{b.s}</span>
          </span>
          <span className="relative h-8">
            <motion.span
              className="absolute top-1 h-[calc(100%-8px)] rounded-[6px]"
              style={{ left: `${b.left}%`, background: b.c }}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: `${b.wd}%`, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.22, duration: 0.55, ease: EASE }}
            />
          </span>
          <span className="num pl-3 text-right text-[16px] font-bold" style={{ color: b.v < 0 ? 'rgb(var(--down-t))' : undefined }}>
            {b.v < 0 ? '−' : ''}
            {inr(Math.abs(b.v * k))}
          </span>
        </button>
      ))}
      <div className="mt-1 text-[11px] text-fg3">Check: {inr(cap * k)} − {inr((stops + m.mouldChange + m.speed + m.rejects) * k)} = {inr(m.actual * k)} ✓</div>
    </div>
  );
}

function Drill({ kind, onClose }: { kind: string; onClose: () => void }) {
  const w = useWorld();
  const basis = useSim((s) => s.basis);
  const nav = useNavigate();
  const rows = w.units
    .map((u) => {
      const m = moneyOf(w, machinesOfUnit(w, u), basis);
      const v = kind === 'down' ? m.downtime + m.idle : kind === 'mc' ? m.mouldChange : kind === 'speed' ? m.speed : kind === 'rej' ? m.rejects : m.scrap + m.energy;
      return { u, v };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 5);
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden rounded-[10px] border border-line/70">
      <div className="flex items-center justify-between bg-panel2/70 px-3 py-2 text-[12px] font-semibold">
        <span>Top units · {{ down: 'Downtime', mc: 'Mould change', speed: 'Speed loss', rej: 'Rejects', cash: 'Cash costs' }[kind]}</span>
        <button onClick={onClose} className="text-fg3 hover:text-fg">Close</button>
      </div>
      {rows.map((r) => (
        <button key={r.u.id} onClick={() => nav(`/unit/${r.u.id}`)} className="flex w-full items-center justify-between px-3 py-2 text-[13px] hover:bg-panel3/40">
          <span>{r.u.name} <span className="text-fg3">· {w.org[r.u.orgId].name}</span></span>
          <span className="num font-semibold">{inr(r.v)} <ArrowRight size={12} className="inline" /></span>
        </button>
      ))}
    </motion.div>
  );
}

function Briefing() {
  const w = useWorld();
  const M = useMoney();
  const nav = useNavigate();
  const a = M.all;
  const worstOrg = M.byOrg[0];
  const basis = useSim((s) => s.basis);
  const worstUnit = [...M.byUnit].filter((x) => x.u.orgId === worstOrg.o.id).sort((a, b) => b.m.lost - a.m.lost)[0];
  const leak = w.machines
    .filter((m) => m.unitId === worstUnit.u.id)
    .map((m) => ({ m, v: leakValue(w, m, basis) }))
    .sort((a, b) => b.v.value - a.v.value)[0];
  const stopLeak = leak && (leak.m.state === 'DOWN' || leak.m.state === 'IDLE');
  const heaterLoss = a.byOwner.maintenance ?? 0;
  const days = [...M.past.slice(-10), a.lost];
  const max = Math.max(...days, M.dayBudget) * 1.15;
  const mtdCauses = Object.entries(a.byOwner).sort((x, y) => y[1] - x[1]).slice(0, 5);
  const mtdK = M.mtd / Math.max(1, a.lost);
  return (
    <div className="flex flex-col gap-4">
      <div className="glass !rounded-[14px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-fg3">Apex Polymers Group · live to {clock(w.t)} · losses at {useSim.getState().basis === 'cm' ? 'contribution margin' : 'selling price'}</div>
          <div className="flex gap-2">
            <button className="btn btn-ghost !h-8" onClick={() => notify({ tone: 'run', title: 'Daily briefing scheduled', body: 'Email PDF + WhatsApp summary at 08:00 · vikram.rao@apexpolymers.example' })}><Mail size={14} />Email me this daily at 08:00</button>
            <button className="btn btn-ghost !h-8" onClick={() => nav('/rollup')}><MapIcon size={14} />Open roll-up map</button>
          </div>
        </div>
        <p className="num mt-3 text-[30px] font-semibold leading-[38px] sm:text-[36px] sm:leading-[44px]">
          We have lost <span className="text-down-t">{inr(a.lost)}</span> so far today, <span className={a.lost > M.yday ? 'text-down-t' : 'text-run-t'}>{inr(Math.abs(a.lost - M.yday))} {a.lost > M.yday ? 'more' : 'less'}</span> than yesterday at this time.
        </p>
        <ol className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[
            `${worstOrg.o.name} is the biggest drain (${inr(worstOrg.m.lost)}), led by ${worstUnit.u.name} (${inr(worstUnit.m.lost)})${leak && leak.v.value > 0 ? `. Its biggest leak is ${leak.m.code}: ${leak.v.cause}${stopLeak ? ` for ${Math.round(leak.v.dur / 60)} min` : ' this shift'} (${inr(leak.v.value)})` : ''}. ${leak?.v.owner ? `Status: ${leak.v.owner.toLowerCase()}.` : ''}`,
            `Quality losses are ${inr(a.rejects)} today across ${fmt(aggMachines(w, w.machines).bad)} NOT OK parts. ${M.leaks.find((l) => l.v.owner === 'QUALITY ASSIGNED') ? 'Short shots on ' + M.leaks.find((l) => l.v.owner === 'QUALITY ASSIGNED')!.m.code + ' are the top quality leak.' : 'No single machine dominates.'}`,
            `${inr(a.byOwner.unassigned ?? 0)} of today’s loss has no owner because stops were never assigned. ${M.byUnit.sort((x, y) => (y.m.byOwner.unassigned ?? 0) - (x.m.byOwner.unassigned ?? 0))[0].u.name} accounts for most of it.`,
          ].map((t, i) => (
            <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }} className="flex gap-3 text-[15px] leading-6">
              <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-[16px] font-bold text-ink">{i + 1}</span>
              <span>{t}</span>
            </motion.li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Unit league table · ranked by ₹ lost today" bodyClass="!p-0">
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[640px] text-[13px]">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Unit</th>
                  <th className="!text-right">₹ lost today</th>
                  <th>Main cause</th>
                  <th className="!text-right">Vs plan</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {[...M.byUnit].sort((x, y) => y.m.lost - x.m.lost).map((r, i) => {
                  const [ok, ov] = r.top ?? ['speed', 0];
                  const tr = r.trend < 0.4 ? ['▲ worse', 'down'] : r.trend < 0.7 ? ['▼ better', 'run'] : ['— same', 'fg3'];
                  return (
                    <tr key={r.u.id} className="row-click" onClick={() => nav(`/unit/${r.u.id}`)}>
                      <td className="num font-bold">{i + 1}</td>
                      <td>
                        <div className="font-semibold">{r.u.name}</div>
                        <div className="text-[11px] text-fg3">{w.org[r.u.orgId].name}</div>
                      </td>
                      <td className="!text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line/60"><div className="h-full rounded-full bg-fg/70" style={{ width: `${(r.m.lost / M.byUnit[0].m.lost) * 100}%` }} /></div>
                          <span className="num w-16 font-bold">{inr(r.m.lost)}</span>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <span className={cx('h-2.5 w-2.5 rounded-[2px]', ok === 'unassigned' && 'pat-unassigned')} style={{ background: ok === 'unassigned' ? undefined : OWNER_META[ok]?.color }} />
                          {OWNER_META[ok]?.label ?? ok} · {inr(ov)}
                        </span>
                      </td>
                      <td className="num !text-right font-semibold" style={{ color: planText(r.plan) }}>{pct(r.plan)}</td>
                      <td className="text-[12px] font-semibold" style={{ color: tr[1] === 'fg3' ? 'rgb(var(--fg3))' : `rgb(var(--${tr[1]}-t))` }}>{tr[0]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="October · loss vs budget" sub={`${inr(M.mtd)} / ${inr(M.budgetMtd)} budget to date`}>
            <div className="relative flex h-[170px] items-end gap-1.5">
              <div className="absolute inset-x-0 z-[1] border-t border-dashed border-brand" style={{ bottom: `${(M.dayBudget / max) * 100}%` }}>
                <span className="absolute -top-5 right-0 rounded bg-panel px-1 text-[10px] font-semibold text-fg2">Budget {inr(M.dayBudget)} / day</span>
              </div>
              {days.map((d, i) => {
                const today = i === days.length - 1;
                return (
                  <div key={i} className="flex h-full flex-1 flex-col justify-end">
                    <motion.div initial={{ height: 0 }} animate={{ height: `${(d / max) * 100}%` }} transition={{ delay: i * 0.04, duration: 0.5, ease: EASE }} className="rounded-t-[5px]" style={{ background: today ? 'repeating-linear-gradient(135deg, rgb(var(--fg) / 0.35) 0 4px, rgb(var(--fg) / 0.12) 4px 8px)' : d > M.dayBudget ? 'rgb(var(--down) / 0.45)' : 'rgb(var(--fg) / 0.22)' }} />
                    <span className="num mt-1 text-center text-[9px] text-fg3">{today ? 'live' : w.day - (days.length - 1 - i)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[13px] text-fg2">At this rate October ends at <b className="num text-down-t">{inr(M.proj)}</b>.</div>
          </Panel>
          <Panel title="Month to date by cause">
            {mtdCauses.map(([key, v]) => (
              <div key={key} className="flex items-center justify-between py-1 text-[13px]">
                <span className="inline-flex items-center gap-2">
                  <span className={cx('h-2.5 w-2.5 rounded-[2px]', key === 'unassigned' && 'pat-unassigned')} style={{ background: key === 'unassigned' ? undefined : OWNER_META[key]?.color }} />
                  {OWNER_META[key]?.label ?? key}
                </span>
                <span className="num font-semibold">{inr(v * mtdK)}</span>
              </div>
            ))}
            <div className="mt-2 border-t border-line/60 pt-2 text-[12px] text-fg3">
              Mould changes today: {M.mcDone} / {M.mcPlanned} planned · avg 38 min vs 30 min standard · overrun cost {inr(a.mouldChange * 0.3)}
            </div>
          </Panel>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass relative overflow-hidden p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <Lightbulb size={22} />
          </div>
          <div>
            <div className="overline !text-brand">One decision for today</div>
            <p className="num mt-1 text-[24px] font-semibold leading-8">
              Heater-band failures have cost {inr(heaterLoss * mtdK * 0.45)} this month across 4 units. A preventive heater check on all 450 T machines would cost about ₹1.8 L and pays back in {Math.max(3, Math.round((180000 / Math.max(1, heaterLoss * mtdK * 0.45)) * 30))} days.
            </p>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary" onClick={() => notify({ tone: 'run', title: 'Approved · PM work orders created', body: '22 machines · Maintenance · next 7 days' })}>Approve ₹1.8 L PM check</button>
              <button className="btn btn-ghost" onClick={() => nav('/ask?q=heater')}>Ask IMMDATA why</button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
