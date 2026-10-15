import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Sparkles, Wand2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorld } from '../sim/store';
import { aggMachines, derive, machinesOfUnit, moneyOf } from '../sim/kpi';
import { TEAMS, TONNAGES } from '../sim/catalog';
import { clock, cx, fmt, inr } from '../lib/format';
import { EASE, Panel, Segmented, StatePill } from '../ui/primitives';
import { notify } from '../shell/Toasts';
import type { Job } from '../sim/types';

const H0 = 0; // 06:00
const SPAN = 30; // hours shown
const ROW = 46;

export default function Planning() {
  const w = useWorld();
  const [tab, setTab] = useState<'board' | 'capacity'>('board');
  return (
    <div className="mx-auto flex max-w-[1700px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] text-fg3">Manesar U1 · PPC · S. Arora</div>
          <h1 className="num text-[30px] font-bold leading-9">Production planning</h1>
          <div className="text-[13px] text-fg3">Right job, right machine, right time · drag bars to reschedule, constraints checked live</div>
        </div>
        <Segmented<'board' | 'capacity'> options={[{ v: 'board', l: 'Planning board' }, { v: 'capacity', l: 'Capacity & RFQ' }]} value={tab} onChange={setTab} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
          {tab === 'board' ? <Board /> : <Capacity />}
        </motion.div>
      </AnimatePresence>
      <div className="text-[12px] text-fg3">Shown at {clock(w.t)}. Publishing a plan sets hourly targets on dashboards from the next hour; manual overrides are audited.</div>
    </div>
  );
}

function Board() {
  const w = useWorld();
  const nav = useNavigate();
  const ms = machinesOfUnit(w, w.unit.MN1);
  const [jobs, setJobs] = useState<Job[]>(() => w.jobs.map((j) => ({ ...j })));
  const [sel, setSel] = useState<string | null>(null);
  const [anim, setAnim] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const nowH = w.t / 3600;
  const pctX = (h: number) => `${((h - H0) / SPAN) * 100}%`;

  const conflicts = new Set<string>();
  for (const m of ms) {
    const js = jobs.filter((j) => j.machineId === m.id).sort((a, b) => a.start - b.start);
    for (let i = 1; i < js.length; i++) if (js[i].start - js[i].changeover < js[i - 1].start + js[i - 1].dur - 0.01) conflicts.add(js[i].id);
  }
  const late = jobs.filter((j) => j.start + j.dur > j.due);
  const changeovers = jobs.filter((j) => j.changeover > 0 && j.start < SPAN).length;

  const autoSchedule = () => {
    setAnim(true);
    setJobs((prev) => {
      const out: Job[] = [];
      for (const m of ms) {
        const js = prev.filter((j) => j.machineId === m.id);
        const [first, ...rest] = js.sort((a, b) => a.start - b.start);
        if (!first) continue;
        out.push(first);
        // group same mould first (fewer changeovers), then by due date
        rest.sort((a, b) => (a.mouldId === first.mouldId ? -1 : b.mouldId === first.mouldId ? 1 : a.due - b.due));
        let t = Math.max(first.start + first.dur, nowH);
        let lastMould = first.mouldId;
        for (const j of rest) {
          const co = j.mouldId === lastMould ? 0 : 0.5;
          const start = t + co;
          out.push({ ...j, start, changeover: co, late: start + j.dur > j.due });
          t = start + j.dur;
          lastMould = j.mouldId;
        }
      }
      return out;
    });
    setTimeout(() => setAnim(false), 1400);
    notify({ tone: 'run', title: 'Auto-schedule complete', body: 'Sorted by due date · same-mould jobs grouped · changeovers minimised' });
  };

  const onDragEnd = (j: Job, dx: number) => {
    const el = area.current;
    if (!el) return;
    const hrs = (dx / el.clientWidth) * SPAN;
    const snapped = Math.round((j.start + hrs) * 4) / 4;
    setJobs((p) => p.map((x) => (x.id === j.id ? { ...x, start: Math.max(nowH - 2, snapped), late: Math.max(nowH - 2, snapped) + x.dur > x.due } : x)));
  };
  const s = jobs.find((j) => j.id === sel);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-4 text-[13px]">
          <span>Jobs <b className="num text-[16px]">{jobs.length}</b></span>
          <span>Changeovers <b className="num text-[16px]">{changeovers}</b></span>
          <span>Late <b className="num text-[16px]" style={{ color: late.length ? 'rgb(var(--down-t))' : undefined }}>{late.length}</b></span>
          <span>Conflicts <b className="num text-[16px]" style={{ color: conflicts.size ? 'rgb(var(--down-t))' : undefined }}>{conflicts.size}</b></span>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost" onClick={() => (setJobs(w.jobs.map((j) => ({ ...j }))), notify({ tone: 'info', title: 'Draft reset to published plan' }))}>Reset draft</button>
          <button className="btn btn-ghost" onClick={autoSchedule}><Wand2 size={14} />Auto-schedule</button>
          <button className="btn btn-primary" onClick={() => notify({ tone: 'run', title: 'Plan published', body: `${jobs.length} work orders · hourly targets update from ${clock(Math.ceil(w.t / 3600) * 3600)}` })}>Publish plan</button>
        </div>
      </div>
      <div className="glass overflow-x-auto !rounded-[12px]">
        <div className="min-w-[1300px]">
          <div className="sticky top-0 z-10 grid grid-cols-[150px_minmax(0,1fr)] border-b border-line/60 bg-panel2/90 backdrop-blur">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg3">Machine</div>
            <div className="relative h-9">
              {Array.from({ length: SPAN / 2 + 1 }, (_, i) => i * 2).map((h) => (
                <span key={h} className={cx('num absolute top-2.5 text-[10px] text-fg3', h === 0 ? '' : '-translate-x-1/2')} style={{ left: pctX(h) }}>
                  {clock(h * 3600)}
                  {h === 18 && ' +1d'}
                </span>
              ))}
            </div>
          </div>
          <div className="relative grid grid-cols-[150px_minmax(0,1fr)]">
            <div>
              {ms.map((m, i) => (
                <div key={m.id} className={cx('flex flex-col justify-center border-b border-line/40 px-3', i % 2 && 'bg-panel2/30')} style={{ height: ROW }}>
                  <button onClick={() => nav(`/machine/${m.id}`)} className="flex items-center gap-2 text-left">
                    <span className="num text-[14px] font-semibold">{m.code}</span>
                    <span className="text-[11px] text-fg3">{m.tonnage} T</span>
                  </button>
                  <StatePill s={m.state} className="!h-4 !px-1 !text-[9px]" />
                </div>
              ))}
            </div>
            <div ref={area} className="relative">
              {Array.from({ length: SPAN }, (_, h) => (
                <div key={h} className={cx('absolute bottom-0 top-0 border-l', h % 8 === 0 ? 'border-line2/80' : 'border-line/30')} style={{ left: pctX(h) }} />
              ))}
              {[8, 16, 24].map((h) => (
                <span key={h} className="absolute top-1 z-[1] -translate-x-1/2 rounded bg-panel3 px-1 text-[9px] font-semibold text-fg3" style={{ left: pctX(h) }}>
                  Shift {h === 8 ? 'B' : h === 16 ? 'C' : 'A'}
                </span>
              ))}
              <div className="absolute bottom-0 top-0 z-[4] w-[2px] bg-brand shadow-[0_0_10px_rgba(242,106,33,0.8)]" style={{ left: pctX(nowH) }}>
                <span className="num absolute -top-0 left-1 rounded bg-brand px-1 text-[10px] font-semibold text-ink">now</span>
              </div>
              <div className="absolute bottom-0 left-0 top-0 bg-[repeating-linear-gradient(135deg,rgb(var(--line)/0.5)_0_2px,transparent_2px_8px)]" style={{ width: pctX(nowH) }} />
              {ms.map((m, i) => (
                <div key={m.id} className={cx('relative border-b border-line/40', i % 2 && 'bg-panel2/30')} style={{ height: ROW }}>
                  {jobs
                    .filter((j) => j.machineId === m.id && j.start < SPAN)
                    .map((j) => {
                      const team = j.customer.startsWith('Orion') ? '#5B8DFF' : j.customer.startsWith('Nova') ? '#0F9D8F' : '#A3A9B3';
                      const bad = conflicts.has(j.id);
                      return (
                        <motion.div key={j.id} className="absolute top-1.5" initial={false} animate={{ left: pctX(j.start - j.changeover) }} transition={{ duration: anim ? 0.9 : 0.25, ease: EASE, delay: anim ? (i % 10) * 0.05 : 0 }} style={{ height: ROW - 12, width: `calc(${pctX(j.dur + j.changeover)})` }}>
                          <motion.div
                            drag="x"
                            dragMomentum={false}
                            dragSnapToOrigin
                            onDragEnd={(_, info) => onDragEnd(j, info.offset.x)}
                            whileDrag={{ scale: 1.03, zIndex: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}
                            onClick={() => setSel(j.id)}
                            className={cx('flex h-full cursor-grab overflow-hidden rounded-[5px] active:cursor-grabbing', bad && 'ring-2 ring-down', sel === j.id && 'ring-2 ring-brand')}
                          >
                            {j.changeover > 0 && <div className="h-full shrink-0 bg-[repeating-linear-gradient(135deg,#A855F7_0_4px,transparent_4px_8px)] opacity-80" style={{ width: `${(j.changeover / (j.dur + j.changeover)) * 100}%` }} title="Mould change" />}
                            <div className="flex min-w-0 flex-1 flex-col justify-center px-2" style={{ background: `${team}33`, borderLeft: `3px solid ${team}` }}>
                              <span className="truncate text-[11px] font-semibold">{j.id} · {j.partName}</span>
                              <span className="num truncate text-[10px] text-fg3">
                                {j.mouldId} · {fmt(j.qty)} pcs {j.start + j.dur > j.due && <b className="text-down-t">· LATE</b>}
                              </span>
                            </div>
                          </motion.div>
                        </motion.div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-fg3">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border-l-[3px] border-[#5B8DFF] bg-[#5B8DFF33]" />Orion Motors</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border-l-[3px] border-[#0F9D8F] bg-[#0F9D8F33]" />Nova Appliances</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border-l-[3px] border-[#A3A9B3] bg-[#A3A9B333]" />Kestrel Two-Wheelers</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 bg-[repeating-linear-gradient(135deg,#A855F7_0_4px,transparent_4px_8px)]" />Mould change ({TEAMS.mouldchange.label})</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm ring-2 ring-down" />Conflict</span>
      </div>
      <AnimatePresence>
        {s && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="glass flex flex-wrap items-center gap-6 !rounded-[12px] p-4 text-[13px]">
            <div>
              <div className="overline">Work order</div>
              <div className="num text-[20px] font-bold">{s.id}</div>
            </div>
            <div><div className="overline">Part</div><div className="font-semibold">{s.partName} · {s.customer}</div></div>
            <div><div className="overline">Mould</div><div className="font-semibold">{s.mouldId}</div></div>
            <div><div className="overline">Window</div><div className="num font-semibold">{clock(s.start * 3600)} → {clock((s.start + s.dur) * 3600)}</div></div>
            <div><div className="overline">Due</div><div className="num font-semibold" style={{ color: s.start + s.dur > s.due ? 'rgb(var(--down-t))' : 'rgb(var(--run-t))' }}>{clock(s.due * 3600)} {s.due >= 18 ? 'tomorrow' : 'today'}</div></div>
            <div className="text-fg3">Constraints: mould–machine mapping ✓ · tonnage ✓ · mould PM ✓ · operator skill ✓{conflicts.has(s.id) && <span className="ml-1 font-semibold text-down-t">· overlaps previous job</span>}</div>
            <button className="btn btn-ghost ml-auto" onClick={() => setSel(null)}>Close</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Capacity() {
  const w = useWorld();
  const [qty, setQty] = useState(50000);
  const [part, setPart] = useState('Bumper bracket');
  const [due, setDue] = useState(30);
  const [verdict, setVerdict] = useState<null | { ok: boolean; machines: string[]; hours: number; earliest: number; impact: string }>(null);
  const [checking, setChecking] = useState(false);
  const all = aggMachines(w, w.machines);
  const d = derive(all);
  const mon = moneyOf(w, w.machines, 'cm');
  const lossShare = 1 - d.oee / 100;
  const hidden = w.machines.length * lossShare;
  const classes = TONNAGES.map((t) => {
    const ms = w.machines.filter((m) => m.tonnage === t);
    const avail = ms.length * 24 * 28 * 0.92;
    const load = avail * (0.62 + ((t * 7) % 30) / 100);
    return { t, n: ms.length, avail, load };
  }).filter((c) => c.n);
  const check = () => {
    setChecking(true);
    setVerdict(null);
    setTimeout(() => {
      const cands = w.machines.filter((m) => m.tonnage >= 350 && m.tonnage <= 550).slice(0, 4);
      const rate = (3600 / 34) * 2 * 0.82; // parts/h per machine
      const hours = qty / rate;
      const days = due - w.day;
      const free = cands.length * days * 24 * 0.3;
      const ok = free >= hours;
      setVerdict({ ok, machines: cands.map((m) => `${m.code} · ${w.unit[m.unitId].name}`), hours, earliest: w.day + Math.ceil(hours / (cands.length * 24 * 0.3)), impact: ok ? 'No customer order slips · 3 extra mould changes' : `Needs Sunday shifts or moves WO-48207 by 2 days` });
      setChecking(false);
    }, 1300);
  };
  const max = Math.max(...classes.map((c) => c.avail));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel title="Machine-hours by tonnage class · next 4 weeks" sub="Available (outline) vs loaded (filled)">
        <div className="flex flex-col gap-3">
          {classes.map((c, i) => {
            const util = (c.load / c.avail) * 100;
            return (
              <div key={c.t} className="grid grid-cols-[70px_minmax(0,1fr)_110px] items-center gap-3 text-[13px]">
                <span className="num font-semibold">{c.t} T <span className="text-[11px] text-fg3">×{c.n}</span></span>
                <div className="relative h-6 rounded-[4px] border border-line2" style={{ width: `${(c.avail / max) * 100}%` }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${util}%` }} transition={{ delay: i * 0.06, duration: 0.6, ease: EASE }} className="h-full rounded-[3px]" style={{ background: util > 88 ? 'rgb(var(--down))' : util > 75 ? 'rgb(var(--idle))' : 'rgb(var(--fg2))' }} />
                </div>
                <span className="num text-right">{fmt(c.load)} / {fmt(c.avail)} h</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-[10px] border border-line/70 p-3 text-[13px]">
          <div className="overline">Hidden factory</div>
          <div className="num text-[24px] font-bold">≈ {hidden.toFixed(0)} machines</div>
          <div className="text-fg3">of capacity lost to downtime, speed and quality right now · {inr(mon.lost)} today. Recovering 5 OEE points frees ≈ {Math.round(w.machines.length * 0.05)} machines — no capex.</div>
        </div>
      </Panel>
      <Panel title="Can we take this order?" sub="Feasible machines, hours, earliest date and impact on other orders">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="overline">Part / mould</span>
            <select className="input" value={part} onChange={(e) => setPart(e.target.value)}>
              {['Bumper bracket', 'Lamp housing', 'Glove box lid', 'Fan shroud', 'Side panel LH'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="overline">Quantity</span>
            <input className="input num" type="number" value={qty} onChange={(e) => setQty(Math.max(0, +e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="overline">Due by</span>
            <select className="input" value={due} onChange={(e) => setDue(+e.target.value)}>
              {[22, 25, 28, 30, 31].map((x) => (
                <option key={x} value={x}>{x} Oct 2026</option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn btn-primary mt-4 !h-11 !px-5" onClick={check} disabled={checking}>
          <Sparkles size={15} />
          {checking ? 'Checking capacity…' : `Can we take ${fmt(qty)} parts by ${due} Oct?`}
        </button>
        <div className="mt-4 min-h-[180px]">
          <AnimatePresence mode="wait">
            {checking && (
              <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
                {['Mould–machine mapping', 'Tonnage class load', 'Mould PM windows', 'Operator skills', 'Customer order book'].map((x, i) => (
                  <motion.div key={x} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }} className="flex items-center gap-2 text-[13px] text-fg2">
                    <span className="h-1.5 w-1.5 animate-blink rounded-full bg-brand" />
                    Checking {x.toLowerCase()}…
                  </motion.div>
                ))}
              </motion.div>
            )}
            {verdict && (
              <motion.div key="v" initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className={cx('rounded-[12px] border p-4', verdict.ok ? 'border-run/50 bg-run/10' : 'border-idle/50 bg-idle/10')}>
                <div className="flex items-center gap-3">
                  {verdict.ok ? <CheckCircle2 size={30} className="text-run-t" /> : <AlertTriangle size={30} className="text-idle-t" />}
                  <div className="num text-[26px] font-bold">{verdict.ok ? 'Yes — feasible' : 'Tight — feasible with changes'}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
                  <div><div className="overline">Machine-hours needed</div><div className="num text-[20px] font-semibold">{fmt(verdict.hours)} h</div></div>
                  <div><div className="overline">Earliest completion</div><div className="num text-[20px] font-semibold">{Math.min(31, verdict.earliest)} Oct</div></div>
                </div>
                <div className="mt-2 text-[13px]"><span className="overline">Machines</span><div>{verdict.machines.join(' · ')}</div></div>
                <div className="mt-2 text-[13px] text-fg2">Impact: {verdict.impact}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Panel>
    </div>
  );
}
