import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ClipboardList, MonitorPlay, Siren } from 'lucide-react';
import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorld } from '../sim/store';
import { availability, machineKpis, machinesOfUnit } from '../sim/kpi';

import { SHIFT_LEN, STATE_META, TEAMS, shiftOf, shiftStartOf } from '../sim/catalog';
import { latestParts, h01 } from '../sim/records';
import { clock, cx, dur, fmt, fmt1, pct, timer } from '../lib/format';
import { Bar, EASE, Kpi, Panel, Segmented, Sparkline, StageBadge, StatePill, TimelineBar, Ticker, planText } from '../ui/primitives';
import { LineChart, Ring } from '../ui/charts';
import LogReason from '../ui/LogReason';
import Loader from '../shell/Loader';
import { notify } from '../shell/Toasts';
import { demoBreak } from '../sim/actions';
import type { Machine as M } from '../sim/types';

const MachineViewer = lazy(() => import('../three/MachineViewer'));
type Tab = 'production' | 'process' | 'quality' | 'energy' | 'history';

export default function Machine() {
  const { id = 'MN1-05' } = useParams();
  const w = useWorld();
  const nav = useNavigate();
  const m = w.machine[id] ?? w.machine['MN1-05'];
  const u = w.unit[m.unitId];
  const org = w.org[u.orgId];
  const [tab, setTab] = useState<Tab>('production');
  const [zone, setZone] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const ids = u.machineIds;
  const idx = ids.indexOf(m.id);
  const prev = w.machine[ids[(idx - 1 + ids.length) % ids.length]];
  const next = w.machine[ids[(idx + 1) % ids.length]];
  const k = machineKpis(w, m);
  const md = w.mould[m.mouldId];
  const part = w.part[md?.positions[0].partId ?? ''];
  const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
  const lastStop = [...m.timeline].reverse().find((s) => s.s !== 'RUN' && s.end < w.t - 1);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg3">
          <Link to="/home" className="hover:text-fg">Corporate</Link>/<Link to="/rollup" className="hover:text-fg">{org.name}</Link>/<Link to={`/unit/${u.id}`} className="hover:text-fg">{u.name}</Link>/<span className="text-fg2">{m.code}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-ghost !h-8" onClick={() => nav(`/machine/${prev.id}`)}><ChevronLeft size={14} />{prev.code}</button>
          <button className="btn btn-ghost !h-8" onClick={() => nav(`/machine/${next.id}`)}>{next.code}<ChevronRight size={14} /></button>
          <button className="btn btn-primary !h-8" onClick={() => setLogOpen(true)}><ClipboardList size={14} />Log downtime reason</button>
          <button className="btn btn-danger !h-8" onClick={() => (m.state === 'DOWN' ? nav(`/breakdowns?t=${m.ticketId}`) : (demoBreak(Number(m.code.slice(4)), 'MM-11'), notify({ tone: 'down', title: `Breakdown raised on ${m.code}`, body: 'Ticket created · supervisor to assign a team' })))}>
            <Siren size={14} />{m.state === 'DOWN' ? 'Open ticket' : 'Raise breakdown'}
          </button>
          <button className="btn btn-ghost !h-8" onClick={() => nav(`/tv?m=${m.id}`)}><MonitorPlay size={14} />Show on TV</button>
        </div>
      </div>

      {/* status banner + 3D */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-w-0 flex-col gap-4">
          <motion.div
            layout
            className={cx('glass relative flex flex-wrap items-center gap-x-6 gap-y-3 overflow-hidden !rounded-[12px] p-5', m.state === 'DOWN' && '!border-down/50')}
            style={{ boxShadow: m.state === 'DOWN' ? 'inset 0 0 0 1px rgb(var(--down) / 0.4), 0 0 40px rgb(var(--down) / 0.15)' : undefined }}
          >
            {m.state === 'DOWN' && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(var(--down)/0.14),transparent_60%)]" />}
            <div className="relative">
              <motion.h1 layoutId={`m-title-${m.id}`} className="num text-[44px] font-bold leading-none">
                {m.code}
              </motion.h1>
              <div className="mt-1 text-[13px] text-fg3">
                {m.make} {m.tonnage} T · {m.hall} · {m.year}
              </div>
            </div>
            <div className="relative flex flex-col gap-1.5">
              <StatePill s={m.state} size="lg" label={`${STATE_META[m.state].label.toUpperCase()} · ${m.state === 'DOWN' ? timer(w.t - m.since) : dur(w.t - m.since).toUpperCase()}`} />
              <div className="text-[13px] text-fg2">
                Since {clock(m.since)}
                {m.state !== 'RUN' && m.reason && ` · ${m.reasonLogged ? m.reason : 'no reason logged'}`}
                {m.state === 'RUN' && lastStop && ` · last stop ${Math.max(1, Math.round((lastStop.end - lastStop.start) / 60))} min (${(lastStop.reason || STATE_META[lastStop.s].label).toLowerCase()})`}
              </div>
            </div>
            {tk && tk.stage !== 'closed' && (
              <div className="relative ml-auto flex flex-col items-start gap-1.5">
                <StageBadge stage={tk.stage} team={tk.team} />
                <div className="text-[12px] text-fg3">
                  Ticket {tk.id} · {tk.assignee ?? 'not assigned'}
                </div>
                <Link to={`/breakdowns?t=${tk.id}`} className="text-[12px] font-semibold text-brand hover:underline">
                  Open breakdown →
                </Link>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
            {[
              ['Job', m.wo, `${part?.name} · qty ${fmt(m.woQty)}`],
              ['Mould', md?.id, `${k.cav}/${k.cavTotal} cavities · ${fmt(md?.shotsSincePM ?? 0)} shots`],
              ['Operator', m.operator, `Shift ${shiftOf(w.t)} · since ${clock(shiftStartOf(w.t) + 120)}`],
              ['Material', part?.material, `Lot ${2609 + (h01(m.id) * 9) | 0}-${100 + Math.floor(h01(m.id + 'l') * 80)} · dried 4 h`],
              ['Next job', w.jobs.find((j) => j.machineId === m.id && j.start * 3600 > w.t)?.id ?? 'WO-48162', `${w.jobs.find((j) => j.machineId === m.id && j.start * 3600 > w.t)?.partName ?? 'Air vent'} · at ${clock(Math.round((w.jobs.find((j) => j.machineId === m.id && j.start * 3600 > w.t)?.start ?? 7.5) * 3600))}`],
            ].map(([l, v, s], i) => (
              <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, ease: EASE }} className="glass !rounded-[10px] p-3">
                <div className="overline">{l}</div>
                <div className="num mt-1 truncate text-[20px] font-semibold">{v}</div>
                <div className="truncate text-[12px] text-fg3">{s}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="glass relative h-[300px] overflow-hidden !rounded-[12px] xl:h-auto xl:min-h-[300px]">
          <Suspense fallback={<Loader label="Loading 3D machine" />}>
            <MachineViewer m={m} cycle={k.ct} zone={zone} onZone={(i) => (setZone(i), setTab('process'))} />
          </Suspense>
          <div className="pointer-events-none absolute left-3 top-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg3">Live 3D · drag to rotate · click a heater zone</div>
          <div className="pointer-events-none absolute bottom-3 left-3 flex gap-1.5">
            {[m.act.z1, m.act.z2, m.act.z3, m.act.z4, m.act.z5].map((z, i) => {
              const set = [m.set.z1, m.set.z2, m.set.z3, m.set.z4, m.set.z5][i];
              const bad = Math.abs(z - set) > 5;
              return (
                <span key={i} className={cx('num rounded px-1.5 py-0.5 text-[11px] font-semibold', bad ? 'bg-down/20 text-down-t' : 'bg-panel/80 text-fg2', zone === i && 'ring-1 ring-brand')}>
                  Z{i + 1} {Math.round(z)}°
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Tab>
          options={[
            { v: 'production', l: 'Production' },
            { v: 'process', l: 'Process' },
            { v: 'quality', l: 'Quality' },
            { v: 'energy', l: 'Energy' },
            { v: 'history', l: 'History' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <span className="text-[12px] text-fg3">
          {part?.customer} · {part?.name} ({part?.number}) · {md?.type === 'family' ? 'family' : 'multicavity'} mould
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE }}>
          {tab === 'production' && <Production m={m} onLog={() => setLogOpen(true)} />}
          {tab === 'process' && <Process m={m} zone={zone} setZone={setZone} />}
          {tab === 'quality' && <Quality m={m} />}
          {tab === 'energy' && <Energy m={m} />}
          {tab === 'history' && <History m={m} />}
        </motion.div>
      </AnimatePresence>
      <LogReason machineId={m.id} open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

function KpiRow({ m }: { m: M }) {
  const w = useWorld();
  const k = machineKpis(w, m);
  const md = w.mould[m.mouldId];
  const p = k.target ? (k.good / k.target) * 100 : 0;
  const dev = (m.cycleFactor - 1) * 100;
  const shotsLeft = Math.max(0, (md?.pmInterval ?? 0) - (md?.shotsSincePM ?? 0));
  return (
    <div className="glass grid grid-cols-2 gap-x-6 gap-y-4 !rounded-[12px] p-5 md:grid-cols-3 xl:grid-cols-5">
      <Kpi label="Parts · shift" value={<Ticker value={k.good} format={fmt} />} sub={<>Target to now {fmt(k.target)} · <b style={{ color: planText(p) }}>{p.toFixed(0)}%</b></>} bar={{ v: p, tone: planText(p) }} />
      <Kpi label="Cycle time" value={k.ct.toFixed(1)} unit="s" tone={dev > 5 ? 'down' : null} sub={`Std ${k.std.toFixed(1)} s · ${dev >= 0 ? '+' : ''}${dev.toFixed(0)}%`} />
      <Kpi label="OEE" value={k.oee.toFixed(1)} unit="%" sub={`A ${k.A.toFixed(0)} · P ${k.P.toFixed(0)} · Q ${k.Q.toFixed(0)}`} />
      <Kpi label="Reject" value={k.rej.toFixed(1)} unit="%" tone={k.rej > 3 ? 'down' : null} sub={`${fmt(m.bad)} parts · limit 3%`} />
      <Kpi label="Shots · shift" value={<Ticker value={m.shots} format={fmt} />} sub={<span style={{ color: shotsLeft < 5000 ? 'rgb(var(--idle-t))' : undefined }}>Mould due in {fmt(shotsLeft)} shots</span>} />
    </div>
  );
}

function Production({ m, onLog }: { m: M; onLog: () => void }) {
  const w = useWorld();
  const nav = useNavigate();
  const k = machineKpis(w, m);
  const md = w.mould[m.mouldId];
  const part = w.part[md?.positions[0].partId ?? ''];
  const s0 = shiftStartOf(w.t);
  const ct = m.cycleHist.slice(-80);
  const wts = m.weightHist.slice(-200);
  const nominal = part?.weight ?? 200;
  const tol = part?.tol ?? 1.5;
  const mean = wts.length ? wts.reduce((a, b) => a + b, 0) / wts.length : nominal;
  const sd = wts.length ? Math.sqrt(wts.reduce((a, b) => a + (b - mean) ** 2, 0) / wts.length) : 0.4;
  const cpk = sd ? Math.min(nominal + tol - mean, mean - (nominal - tol)) / (3 * sd) : 0;
  const outTol = wts.filter((x) => Math.abs(x - nominal) > tol).length;
  const stops = [...m.timeline].filter((s) => s.s !== 'RUN' && s.end - s.start >= 60).reverse();
  const parts = latestParts(w, m, 8);
  const sum = { run: m.runSec, idle: m.idleSec, down: m.downSec, mc: m.mcSec };
  const params = paramChips(m);
  return (
    <div className="flex flex-col gap-4">
      <KpiRow m={m} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Cycle time · recent shots" sub={`Standard ${k.std.toFixed(1)} s · alert at +5% (${(k.std * 1.05).toFixed(1)} s)`}>
          {ct.length > 2 ? (
            <LineChart data={ct} height={190} refs={[{ v: k.std, label: `${k.std.toFixed(1)} s std`, tone: 'rgb(var(--run-t))' }, { v: k.std * 1.05, label: `${(k.std * 1.05).toFixed(1)} s limit`, tone: 'rgb(var(--down-t))' }]} xLabels={['older', '', '', 'now']} />
          ) : (
            <div className="grid h-[190px] place-items-center text-[13px] text-fg3">Waiting for shots · machine {STATE_META[m.state].label.toLowerCase()}</div>
          )}
        </Panel>
        <Panel title={`Part weight · last ${wts.length} parts`} sub={`Nominal ${fmt1(nominal)} g ± ${tol} g · ${outTol} out of tolerance`}>
          <LineChart data={wts.length ? wts : [nominal]} dots height={160} band={[nominal - tol, nominal + tol]} refs={[{ v: nominal + tol, label: `${fmt1(nominal + tol)} g USL`, tone: 'rgb(var(--down-t))' }, { v: nominal - tol, label: `${fmt1(nominal - tol)} g LSL`, tone: 'rgb(var(--down-t))' }]} dotColor={(v) => (Math.abs(v - nominal) > tol ? 'rgb(var(--down))' : 'rgb(var(--fg2))')} />
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-fg2">
            <span>Mean <b className="num">{fmt1(mean)} g</b></span>
            <span>σ <b className="num">{sd.toFixed(2)} g</b></span>
            <span>Cpk <b className="num" style={{ color: cpk < 1.33 ? 'rgb(var(--idle-t))' : 'rgb(var(--run-t))' }}>{cpk.toFixed(2)}</b></span>
            {m.hot && <span className="font-semibold text-idle-t">Trending up since 10:50</span>}
          </div>
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {params.map((p) => (
          <div key={p.l} className={cx('glass !rounded-[8px] p-2.5', p.bad && '!border-down/50 !bg-down/10', p.warn && '!border-idle/50 !bg-idle/10')}>
            <div className="overline !text-[10px]">{p.l}</div>
            <div className="num text-[20px] font-semibold" style={{ color: p.bad ? 'rgb(var(--down-t))' : p.warn ? 'rgb(var(--idle-t))' : undefined }}>
              {p.v} <span className="text-[12px] text-fg3">{p.u}</span>
            </div>
            <div className="text-[11px] text-fg3">{p.lim}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="Status this shift" sub={`Run ${Math.round(sum.run / 60)} min · Idle ${Math.round(sum.idle / 60)} · Down ${Math.round(sum.down / 60)} · Mould change ${Math.round(sum.mc / 60)} · availability ${availability(m).toFixed(0)}%`}>
          <TimelineBar segs={m.timeline} t0={s0} t1={s0 + SHIFT_LEN} now={w.t} h={26} />
          <div className="num mt-1 flex justify-between text-[11px] text-fg3">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i}>{clock(s0 + i * 2 * 3600)}</span>
            ))}
          </div>
          <table className="mt-3 w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-fg3">
                <th className="pb-2 font-semibold">From</th>
                <th className="pb-2 text-right font-semibold">Min</th>
                <th className="pb-2 pl-4 font-semibold">Reason</th>
                <th className="pb-2 font-semibold">Logged by</th>
              </tr>
            </thead>
            <tbody>
              {stops.slice(0, 6).map((s, i) => {
                const missing = !s.reason || s.reason === 'No reason logged' || (s.s === 'DOWN' && s.stage === 'unassigned' && !m.reasonLogged);
                return (
                  <tr key={i} className="border-t border-line/50">
                    <td className="num py-2">{clock(s.start)}</td>
                    <td className="num py-2 text-right">{Math.max(1, Math.round((s.end - s.start) / 60))}</td>
                    <td className="py-2 pl-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: s.team ? TEAMS[s.team].color : `rgb(var(--${STATE_META[s.s].v}))` }} />
                        {s.s === 'MC' ? `Mould change · ${s.reason}` : missing ? 'Not logged' : s.reason}
                      </span>
                    </td>
                    <td className="py-2">{missing ? <button onClick={onLog} className="font-semibold text-brand hover:underline">Log reason →</button> : <span className="text-fg2">{s.team ? (s.team === 'mouldchange' ? 'Setup team' : s.ticketId ? w.ticket[s.ticketId]?.assignee ?? TEAMS[s.team].label : 'Supervisor') : 'Supervisor'}</span>}</td>
                  </tr>
                );
              })}
              {stops.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-fg3">No stops this shift · running since {clock(m.since)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
        <Panel title="Latest parts" right={<button onClick={() => nav(`/records?m=${m.id}`)} className="text-[12px] font-semibold text-brand hover:underline">Production records →</button>}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-fg3">
                <th className="pb-2 font-semibold">Serial</th>
                <th className="pb-2 font-semibold">Time</th>
                <th className="pb-2 text-right font-semibold">Weight</th>
                <th className="pb-2 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {parts.map((p) => (
                  <motion.tr key={p.serial} layout initial={{ opacity: 0, backgroundColor: 'rgba(242,106,33,0.15)' }} animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }} className="border-t border-line/50">
                    <td className="py-1.5 font-mono text-[12px]">{p.serial}</td>
                    <td className="num py-1.5">{clock(p.t, true)}</td>
                    <td className="num py-1.5 text-right" style={{ color: Math.abs(p.weight - p.nominal) > p.tol ? 'rgb(var(--down-t))' : undefined }}>
                      {fmt1(p.weight)} g
                    </td>
                    <td className="py-1.5 text-right">
                      <span className={cx('rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold', p.ok ? 'bg-run/15 text-run-t' : 'bg-down/15 text-down-t')}>{p.ok ? 'OK' : 'NOT OK'}</span>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {parts.length === 0 && <div className="py-6 text-center text-[13px] text-fg3">No parts yet this shift.</div>}
        </Panel>
      </div>
    </div>
  );
}

function paramChips(m: M) {
  const a = m.act;
  const s = m.set;
  const zones = [a.z1, a.z2, a.z3, a.z4, a.z5];
  const sets = [s.z1, s.z2, s.z3, s.z4, s.z5];
  const zBad = zones.findIndex((z, i) => z - sets[i] > 5 || sets[i] - z > 10);
  const run = m.state === 'RUN';
  return [
    { l: 'Barrel Z1–Z5', v: `${Math.round(Math.min(...zones))}–${Math.round(Math.max(...zones))}`, u: '°C', lim: zBad >= 0 ? `Z${zBad + 1} out of window` : `set ${Math.round(Math.min(...sets))}–${Math.round(Math.max(...sets))}`, bad: zBad >= 0 },
    { l: 'Mould temp', v: Math.round(a.mouldTemp), u: '°C', lim: `${Math.round(s.mouldTemp - 4)}–${Math.round(s.mouldTemp + 4)}` },
    { l: 'Inj. pressure', v: run ? fmt(a.injP) : '—', u: 'bar', lim: `${fmt(s.injP - 100)}–${fmt(s.injP + 100)}` },
    { l: 'Hold pressure', v: run ? fmt(a.holdP) : '—', u: 'bar', lim: `${fmt(s.holdP - 50)}–${fmt(s.holdP + 50)}` },
    { l: 'Inj. speed', v: run ? Math.round(a.injSpeed) : '—', u: 'mm/s', lim: '75–95' },
    { l: 'Cushion', v: run ? a.cushion.toFixed(1) : '—', u: 'mm', lim: '5–9', warn: run && a.cushion < 5.5 },
    { l: 'Cooling time', v: a.cooling.toFixed(1), u: 's', lim: `set ${s.cooling.toFixed(1)}`, warn: a.cooling > s.cooling * 1.03 },
    { l: 'Clamp force', v: run ? fmt(a.clamp) : '—', u: 'kN', lim: `${fmt(s.clamp - 200)}–${fmt(s.clamp + 200)}` },
  ];
}

function spark(seed: string, n: number, base: number, amp: number, trend = 0) {
  return Array.from({ length: n }, (_, i) => base + (h01(seed + i) - 0.5) * amp + (trend * i) / n);
}

function Process({ m, zone, setZone }: { m: M; zone: number | null; setZone: (z: number | null) => void }) {
  const w = useWorld();
  const k = machineKpis(w, m);
  const md = w.mould[m.mouldId];
  const part = w.part[md?.positions[0].partId ?? ''];
  const a = m.act;
  const s = m.set;
  const rows = [
    { l: 'Barrel zone 1', u: '°C', set: s.z1, act: a.z1, lo: s.z1 - 10, hi: s.z1 + 10, z: 0 },
    { l: 'Barrel zone 2', u: '°C', set: s.z2, act: a.z2, lo: s.z2 - 10, hi: s.z2 + 10, z: 1 },
    { l: 'Barrel zone 3', u: '°C', set: s.z3, act: a.z3, lo: s.z3 - 10, hi: s.z3 + 10, z: 2 },
    { l: 'Barrel zone 4', u: '°C', set: s.z4, act: a.z4, lo: s.z4 - 5, hi: s.z4 + 5, z: 3 },
    { l: 'Barrel zone 5 / nozzle', u: '°C', set: s.z5, act: a.z5, lo: s.z5 - 10, hi: s.z5 + 10, z: 4 },
    { l: 'Mould temp (fixed)', u: '°C', set: s.mouldTemp, act: a.mouldTemp, lo: s.mouldTemp - 4, hi: s.mouldTemp + 4 },
    { l: 'Injection pressure', u: 'bar', set: s.injP, act: a.injP, lo: s.injP - 100, hi: s.injP + 100 },
    { l: 'Hold pressure', u: 'bar', set: s.holdP, act: a.holdP, lo: s.holdP - 50, hi: s.holdP + 50 },
    { l: 'Injection speed', u: 'mm/s', set: s.injSpeed, act: a.injSpeed, lo: 75, hi: 95 },
    { l: 'Cushion', u: 'mm', set: s.cushion, act: a.cushion, lo: 5, hi: 9 },
    { l: 'Cooling time', u: 's', set: s.cooling, act: a.cooling, lo: s.cooling - 1, hi: s.cooling + 1 },
    { l: 'Cycle time', u: 's', set: k.std, act: k.ct, lo: k.std * 0.95, hi: k.std * 1.05 },
  ];
  const running = m.state === 'RUN';
  const out = rows.filter((r) => (r.act < r.lo || r.act > r.hi) && (running || r.z !== undefined));
  // X̄ chart (subgroups of 5)
  const wts = m.weightHist.slice(-200);
  const groups: number[] = [];
  for (let i = 0; i + 5 <= wts.length; i += 5) groups.push(wts.slice(i, i + 5).reduce((x, y) => x + y, 0) / 5);
  const nominal = part?.weight ?? 200;
  const cl = nominal;
  const sdg = (part?.tol ?? 1.5) / 3 / Math.sqrt(5) * 1.6;
  const ucl = cl + 3 * sdg;
  const lcl = cl - 3 * sdg;
  let rule2 = -1;
  for (let i = 0; i + 7 <= groups.length; i++) if (groups.slice(i, i + 7).every((g) => g > cl)) rule2 = i;
  const shotsLeft = Math.max(0, (md?.pmInterval ?? 0) - (md?.shotsSincePM ?? 0));
  const hrsLeft = shotsLeft / (3600 / Math.max(1, k.ct));
  const machineAlerts = w.alerts.filter((x) => x.machineId === m.id && x.status !== 'resolved');
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Process parameters · live, per shot" sub={`Shot #${fmt(m.shotCounter)} · ${clock(w.t, true)} · ${out.length} parameter${out.length === 1 ? '' : 's'} out of range`} bodyClass="!p-0">
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[720px] text-[13px]">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th className="!text-right">Set</th>
                  <th className="!text-right">Actual</th>
                  <th className="w-[220px]">Within limits</th>
                  <th>Last 60 shots</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const bad = (r.act < r.lo || r.act > r.hi) && (running || r.z !== undefined);
                  const near = !bad && (r.act < r.lo + (r.hi - r.lo) * 0.1 || r.act > r.hi - (r.hi - r.lo) * 0.1);
                  const span = (r.hi - r.lo) / 0.6;
                  const min = r.lo - span * 0.2;
                  const pos = Math.max(2, Math.min(98, ((r.act - min) / span) * 100));
                  const sel = r.z !== undefined && zone === r.z;
                  return (
                    <tr key={r.l} className={cx('row-click', bad && 'bg-down/[0.07]', sel && '!bg-brand/10')} onClick={() => setZone(r.z ?? null)}>
                      <td className={cx('font-medium', sel && 'text-brand')}>
                        {r.l} <span className="text-fg3">{r.u}</span>
                      </td>
                      <td className="num !text-right text-fg2">{r.set >= 100 ? fmt(r.set) : fmt1(r.set)}</td>
                      <td className="num !text-right text-[15px] font-semibold" style={{ color: bad ? 'rgb(var(--down-t))' : near ? 'rgb(var(--idle-t))' : undefined }}>
                        {running || r.z !== undefined || r.l.startsWith('Mould') || r.l.startsWith('Cool') ? (r.act >= 100 ? fmt(r.act) : fmt1(r.act)) : '—'}
                      </td>
                      <td>
                        <div className="relative h-2 rounded-full bg-line/60">
                          <div className="absolute inset-y-0 rounded-full bg-run/25" style={{ left: '20%', right: '20%' }} />
                          <motion.div className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-sm" animate={{ left: `${pos}%` }} transition={{ duration: 0.4, ease: EASE }} style={{ background: bad ? 'rgb(var(--down))' : 'rgb(var(--fg))' }} />
                        </div>
                        <div className="num mt-0.5 flex justify-between text-[10px] text-fg3">
                          <span>{r.lo >= 100 ? fmt(r.lo) : fmt1(r.lo)}</span>
                          <span>{r.hi >= 100 ? fmt(r.hi) : fmt1(r.hi)}</span>
                        </div>
                      </td>
                      <td>
                        <Sparkline data={spark(m.id + r.l, 30, r.set, (r.hi - r.lo) * 0.35, r.l === 'Barrel zone 4' && m.hot ? 8 : r.l === 'Cycle time' && m.cycleFactor > 1.05 ? k.ct - k.std : 0)} w={120} h={22} color={bad ? 'rgb(var(--down))' : 'rgb(var(--fg2))'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Part weight SPC · X̄ chart, subgroup of 5" sub={`UCL ${fmt1(ucl)} · CL ${fmt1(cl)} · LCL ${fmt1(lcl)} g`} right={rule2 >= 0 ? <span className="rounded bg-down/15 px-2 py-1 text-[12px] font-semibold text-down-t">Rule 2: 7 points above CL</span> : <span className="rounded bg-run/15 px-2 py-1 text-[12px] font-semibold text-run-t">In control</span>}>
          <LineChart data={groups.length ? groups : [cl]} height={170} refs={[{ v: ucl, label: 'UCL', tone: 'rgb(var(--down-t))' }, { v: cl, label: 'CL', tone: 'rgb(var(--fg3))', dash: false }, { v: lcl, label: 'LCL', tone: 'rgb(var(--down-t))' }]} highlightFrom={rule2 >= 0 ? rule2 : undefined} color="rgb(var(--fg))" />
        </Panel>
      </div>
      <div className="flex flex-col gap-4">
        <Panel title={`Mould ${md?.id} · ${md?.name}`} sub={`${md?.positions.length} cavities · ${md?.owner === 'customer' ? `customer-owned (${md.customer})` : 'own tool'}`}>
          <div className="flex items-center gap-4">
            <Ring v={((md?.shotsSincePM ?? 0) / (md?.pmInterval ?? 1)) * 100} size={88} stroke={8} color={shotsLeft < 5000 ? 'rgb(var(--idle))' : 'rgb(var(--run))'}>
              <span className="num text-[18px] font-bold">{Math.round(((md?.shotsSincePM ?? 0) / (md?.pmInterval ?? 1)) * 100)}%</span>
            </Ring>
            <div>
              <div className="overline">Shots since maintenance</div>
              <div className="num text-[22px] font-semibold">
                {fmt(md?.shotsSincePM ?? 0)} / {fmt(md?.pmInterval ?? 0)}
              </div>
              <div className="text-[12px]" style={{ color: shotsLeft < 5000 ? 'rgb(var(--idle-t))' : 'rgb(var(--fg3))' }}>
                Due in {fmt(shotsLeft)} shots · ≈ {hrsLeft.toFixed(0)} h at current rate
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
            <div><div className="overline">Part weight std</div><div className="num font-semibold">{fmt1(nominal)} g ± {part?.tol}</div></div>
            <div><div className="overline">Std cycle</div><div className="num font-semibold">{k.std.toFixed(1)} s</div></div>
            <div><div className="overline">Lifetime shots</div><div className="num font-semibold">{fmt(md?.lifetime ?? 0)}</div></div>
            <div><div className="overline">Material</div><div className="num font-semibold">{part?.material} · dried 4 h</div></div>
          </div>
        </Panel>
        <Panel title="Energy" sub="This shift">
          <div className="flex items-baseline gap-2">
            <span className="num text-[30px] font-bold">{fmt(m.kwh)}</span>
            <span className="text-fg3">kWh</span>
          </div>
          <div className="text-[12px] text-fg3">{(m.kwh / Math.max(1, k.good)).toFixed(3)} kWh / part · now {fmt1(m.kw)} kW</div>
        </Panel>
        <Panel title={`${machineAlerts.length} open alert${machineAlerts.length === 1 ? '' : 's'}`}>
          <div className="flex flex-col gap-2">
            {machineAlerts.length === 0 && <div className="text-[13px] text-fg3">All clear on this machine.</div>}
            {machineAlerts.map((x) => (
              <div key={x.id} className="flex gap-2 text-[13px]">
                <span className="w-1 shrink-0 rounded-full" style={{ background: x.severity === 'critical' ? 'rgb(var(--down))' : x.severity === 'warning' ? 'rgb(var(--idle))' : 'rgb(var(--mould))' }} />
                {x.title}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Quality({ m }: { m: M }) {
  const w = useWorld();
  const md = w.mould[m.mouldId];
  const recs = useMemo(() => latestParts(w, m, 300), [w.t, m]); // eslint-disable-line react-hooks/exhaustive-deps
  const cav = md?.positions.map((p, i) => {
    const code = p.code.length === 1 ? p.code : String.fromCharCode(65 + i);
    const r = recs.filter((x) => x.cavity === code);
    const bad = r.filter((x) => !x.ok).length;
    return { code: p.code, n: r.length, bad, pct: r.length ? (bad / r.length) * 100 : 0, blocked: md.blocked[i] };
  }) ?? [];
  const part = w.part[md?.positions[0].partId ?? ''];
  const nominal = part?.weight ?? 200;
  const tol = part?.tol ?? 1.5;
  const bins = Array.from({ length: 15 }, (_, i) => nominal - tol * 1.75 + (i * tol * 3.5) / 15);
  const hist = bins.map((b) => recs.filter((r) => r.weight >= b && r.weight < b + (tol * 3.5) / 15).length);
  const hmax = Math.max(1, ...hist);
  const bad = recs.filter((r) => !r.ok).slice(0, 10);
  const defects = new Map<string, number>();
  for (const r of recs) if (!r.ok) defects.set(r.reason, (defects.get(r.reason) ?? 0) + 1);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Panel title="Cavity-wise rejects" sub={`Last ${recs.length} parts`}>
        <div className="flex flex-col gap-3">
          {cav.map((c) => (
            <div key={c.code}>
              <div className="flex justify-between text-[13px]">
                <span className="font-semibold">Cavity {c.code} {c.blocked && <span className="text-fg3">(blocked)</span>}</span>
                <span className="num" style={{ color: c.pct > 3 ? 'rgb(var(--down-t))' : undefined }}>{c.bad} · {pct(c.pct)}</span>
              </div>
              <Bar v={c.pct * 10} tone={c.pct > 3 ? 'rgb(var(--down))' : 'rgb(var(--fg2))'} />
            </div>
          ))}
        </div>
        <div className="mt-4 overline">Defects</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...defects.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => (
            <span key={d} className="chip !h-7 !cursor-default">{d} · {n}</span>
          ))}
          {defects.size === 0 && <span className="text-[13px] text-fg3">No defects in this window.</span>}
        </div>
      </Panel>
      <Panel title="Weight distribution" sub={`${fmt1(nominal)} g ± ${tol} g · green band = tolerance`}>
        <div className="flex h-[200px] items-end gap-1">
          {hist.map((n, i) => {
            const inTol = Math.abs(bins[i] + (tol * 3.5) / 30 - nominal) <= tol;
            return <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${(n / hmax) * 100}%` }} transition={{ delay: i * 0.02, ease: EASE }} className="flex-1 rounded-t-[2px]" style={{ background: inTol ? 'rgb(var(--run) / 0.7)' : 'rgb(var(--down) / 0.8)' }} />;
          })}
        </div>
        <div className="num mt-1 flex justify-between text-[10px] text-fg3">
          <span>{fmt1(bins[0])} g</span>
          <span>{fmt1(nominal)} g</span>
          <span>{fmt1(bins[14])} g</span>
        </div>
      </Panel>
      <Panel title="Recent NOT OK parts">
        <div className="flex flex-col">
          {bad.map((r) => (
            <div key={r.serial} className="flex items-center justify-between border-b border-line/40 py-1.5 text-[12px]">
              <span className="font-mono">{r.serial}</span>
              <span className="text-fg2">{r.reason}</span>
              <span className="num text-down-t">{fmt1(r.weight)} g</span>
            </div>
          ))}
          {bad.length === 0 && <div className="py-6 text-center text-[13px] text-fg3">No NOT OK parts in the last {recs.length}.</div>}
        </div>
      </Panel>
    </div>
  );
}

function Energy({ m }: { m: M }) {
  const w = useWorld();
  const k = machineKpis(w, m);
  const unitMs = machinesOfUnit(w, w.unit[m.unitId]);
  const uk = unitMs.reduce((a, x) => a + x.kwh, 0);
  const ug = unitMs.reduce((a, x) => a + x.parts - x.bad, 0);
  const curve = spark(m.id + 'kw', 60, m.ratedKw * 0.55, m.ratedKw * 0.2);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="kWh this shift">
        <div className="num text-[40px] font-bold">{fmt(m.kwh)}</div>
        <div className="text-[13px] text-fg3">Idle / stopped energy {fmt(m.kwhIdle)} kWh · ₹{fmt(m.kwhIdle * 8.6)}</div>
      </Panel>
      <Panel title="kWh / good part">
        <div className="num text-[40px] font-bold">{(m.kwh / Math.max(1, k.good)).toFixed(3)}</div>
        <div className="text-[13px] text-fg3">Unit average {(uk / Math.max(1, ug)).toFixed(3)} · rated {m.ratedKw} kW</div>
      </Panel>
      <Panel title="Power now">
        <div className="num text-[40px] font-bold">{fmt1(m.kw)} <span className="text-[18px] text-fg3">kW</span></div>
        <Sparkline data={[...curve, m.kw]} w={300} h={50} color="rgb(var(--mould))" fill />
      </Panel>
    </div>
  );
}

function History({ m }: { m: M }) {
  const w = useWorld();
  const days = Array.from({ length: 14 }, (_, i) => 55 + h01(m.id + 'd' + i) * 30);
  const tickets = w.tickets.filter((t) => t.machineId === m.id).slice(0, 6);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="OEE · last 14 days" sub="Daily, shop-floor day 06:00 → 06:00">
        <LineChart data={[...days, machineKpis(w, m).oee]} height={180} refs={[{ v: 75, label: 'Target 75%', tone: 'rgb(var(--run-t))' }]} xLabels={['1 Oct', '8 Oct', 'today']} />
      </Panel>
      <Panel title="Breakdowns on this machine">
        <div className="flex flex-col gap-2 text-[13px]">
          {tickets.map((t) => (
            <Link key={t.id} to={`/breakdowns?t=${t.id}`} className="flex items-center justify-between rounded-md border border-line/50 p-2 transition hover:border-fg3">
              <span>
                <span className="num font-semibold">{t.id}</span> · {t.symptom}
              </span>
              <StageBadge stage={t.stage} team={t.team} />
            </Link>
          ))}
          {tickets.length === 0 && <div className="text-fg3">No breakdowns this week. Last PM 22 Sep · next by shots.</div>}
        </div>
      </Panel>
      <Panel title="Jobs & moulds run">
        {w.jobs.filter((j) => j.machineId === m.id).map((j) => (
          <div key={j.id} className="flex justify-between border-b border-line/40 py-1.5 text-[13px]">
            <span className="num font-semibold">{j.id}</span>
            <span className="text-fg2">{j.partName}</span>
            <span className="num text-fg3">{j.mouldId}</span>
          </div>
        ))}
      </Panel>
      <Panel title="Parameter change log">
        {[
          ['10:52', 'Cooling time 14.0 → 14.5 s', m.operator, 'within window'],
          ['08:31', 'Hold pressure 600 → 610 bar', 'Process eng.', 'approved'],
          ['06:14', 'Barrel Z4 230 → 230 °C (reset)', m.operator, 'shift start'],
        ].map(([t, c, by, n]) => (
          <div key={t} className="flex justify-between gap-2 border-b border-line/40 py-1.5 text-[13px]">
            <span className="num">{t}</span>
            <span className="flex-1 truncate">{c}</span>
            <span className="text-fg3">{by} · {n}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}


