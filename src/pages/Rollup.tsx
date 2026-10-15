import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Layers3, MonitorPlay } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stage from '../three/Stage';
import IndiaMap, { INDIA, proj, type MapPoint } from '../three/IndiaMap';
import { useWorld } from '../sim/store';
import { aggMachines, derive, machinesOfOrg, machinesOfUnit } from '../sim/kpi';
import { clock, cx, dur, fmt, pct } from '../lib/format';
import { EASE, LiveDot, PlanChip, Segmented, StateMix, StatePill, planText } from '../ui/primitives';
import { notify } from '../shell/Toasts';

type Metric = 'plan' | 'oee' | 'rej' | 'down' | 'mc';
const statusHex = (v: 'run' | 'idle' | 'down') => ({ run: '#7DB08F', idle: '#D6B56E', down: '#E0826B' })[v];

export default function Rollup() {
  const w = useWorld();
  const nav = useNavigate();
  const [metric, setMetric] = useState<Metric>('plan');
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  const stats = w.units.map((u) => {
    const a = aggMachines(w, machinesOfUnit(w, u));
    return { u, a, d: derive(a) };
  });
  const maxGood = Math.max(...stats.map((s) => s.a.good));
  const points: MapPoint[] = stats.map(({ u, a, d }) => {
    const tone = metric === 'plan' ? (d.plan >= 95 ? 'run' : d.plan >= 88 ? 'idle' : 'down') : metric === 'oee' ? (d.oee >= 75 ? 'run' : d.oee >= 65 ? 'idle' : 'down') : metric === 'rej' ? (d.rej > 3 ? 'down' : d.rej > 2.2 ? 'idle' : 'run') : metric === 'down' ? (a.down >= 3 ? 'down' : a.down >= 1 ? 'idle' : 'run') : a.mc > 1 ? 'idle' : 'run';
    const height = metric === 'plan' ? a.good / maxGood : metric === 'oee' ? d.oee / 100 : metric === 'rej' ? d.rej / 5 : metric === 'down' ? a.down / 6 : (a.mcDone + a.mc) / 6;
    const val = metric === 'plan' ? pct(d.plan) + ' of plan' : metric === 'oee' ? pct(d.oee) + ' OEE' : metric === 'rej' ? pct(d.rej) + ' reject' : metric === 'down' ? `${a.down} down` : `${a.mcDone} done · ${a.mc} running`;
    return { id: u.id, lng: u.lng, lat: u.lat, height: Math.max(0.05, height), color: statusHex(tone), label: u.name, sub: `${val} · ${fmt(a.good)} parts`, pulse: tone === 'down' };
  });
  const s = stats.find((x) => x.u.id === sel);

  return (
    <div className="relative flex h-[calc(100vh-56px)] w-full overflow-hidden">
      {/* left rail */}
      <motion.aside initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4, ease: EASE }} className="relative z-20 hidden w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line/60 p-4 lg:flex">
        <div>
          <div className="eyebrow">Corporate roll-up · India</div>
          <h1 className="num text-[20px] font-bold leading-8">Where do we need help?</h1>
          <div className="mt-1 text-[12px] text-fg3"><LiveDot label={`Live · ${clock(w.t)}`} /></div>
        </div>
        {w.orgs.map((o) => {
          const a = aggMachines(w, machinesOfOrg(w, o.id));
          const d = derive(a);
          return (
            <div key={o.id} className="glass !rounded-[10px] p-3">
              <div className="flex items-center justify-between">
                <span className="num text-[14px] font-bold uppercase tracking-[0.04em]">{o.name}</span>
                <PlanChip p={d.plan} />
              </div>
              <div className="mt-1 flex gap-3 text-[12px] text-fg3">
                <span>Plan <b className="num" style={{ color: planText(d.plan) }}>{pct(d.plan)}</b></span>
                <span>OEE <b className="num text-fg">{pct(d.oee)}</b></span>
                <span>Down <b className="num text-down-t">{a.down}</b></span>
              </div>
              <div className="mt-2 flex flex-col">
                {o.unitIds.map((uid) => {
                  const st = stats.find((x) => x.u.id === uid)!;
                  return (
                    <button key={uid} onClick={() => setSel(uid)} className={cx('flex items-center justify-between rounded px-1.5 py-1 text-[12px] transition hover:bg-panel3/60', sel === uid && 'bg-brand/10')}>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: points.find((p) => p.id === uid)?.color }} />
                        {w.unit[uid].name}
                      </span>
                      <span className="num font-semibold" style={{ color: planText(st.d.plan) }}>{pct(st.d.plan)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </motion.aside>

      {/* map */}
      <div data-tour="rollup-map" className="relative min-w-0 flex-1">
        {mobile ? (
          <FlatMap points={points} onSelect={setSel} />
        ) : (
          <Stage className="absolute inset-0" camera={{ position: [0, 30, 27], fov: 40 }} hero>
            <IndiaMap points={points} selected={sel} onSelect={setSel} hover={hover} setHover={setHover} />
          </Stage>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="glass pointer-events-auto !rounded-[10px] p-1.5">
            <Segmented<Metric> size="sm" options={[{ v: 'plan', l: 'Output vs plan' }, { v: 'oee', l: 'OEE' }, { v: 'rej', l: 'Rejection' }, { v: 'down', l: 'Machines down' }, { v: 'mc', l: 'Mould changes' }]} value={metric} onChange={setMetric} />
          </div>
          <div className="glass pointer-events-auto flex gap-3 !rounded-[10px] px-3 py-2 text-[11px] text-fg2">
            <span>Pillar height = {metric === 'plan' ? 'output' : metric === 'oee' ? 'OEE' : metric === 'rej' ? 'reject %' : metric === 'down' ? 'machines down' : 'mould changes'}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-run" />on track</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-idle" />at risk</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-down" />behind</span>
            <span className="text-fg3">· arcs = flows to customer plants</span>
          </div>
        </div>
      </div>

      {/* preview */}
      <AnimatePresence>
        {s && (
          <motion.aside initial={{ x: 380, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 380, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="absolute bottom-4 right-4 top-20 z-30 flex w-[360px] flex-col gap-3 overflow-y-auto rounded-[14px] border border-line bg-panel/95 p-4 text-fg shadow-[var(--shadow)] backdrop-blur">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg3">{w.org[s.u.orgId].name} · {s.u.city}</div>
                <div className="num text-[20px] font-bold">{s.u.name}</div>
              </div>
              <button onClick={() => setSel(null)} className="text-fg3 hover:text-fg" aria-label="Close">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Plan', pct(s.d.plan), planText(s.d.plan)],
                ['OEE', pct(s.d.oee), '#fff'],
                ['Reject', pct(s.d.rej), s.d.rej > 3 ? 'rgb(var(--down-t))' : 'rgb(var(--fg))'],
              ].map(([l, v, c]) => (
                <div key={l} className="rounded-[8px] bg-panel2 p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fg3">{l}</div>
                  <div className="num text-[18px] font-bold" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="text-[12px] text-fg2">
              Mould changes {s.a.mcDone} / {s.a.mcDone + s.a.mc + 2} · avg change 36 min vs 30 std
            </div>
            <StateMix run={s.a.run} idle={s.a.idle} mc={s.a.mc} down={s.a.down} off={s.a.off} h={8} />
            <div className="text-[12px] text-fg3">{s.a.run} running · {s.a.idle} idle · {s.a.mc} mould change · {s.a.down} down</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fg3">Stopped now</div>
            {machinesOfUnit(w, s.u)
              .filter((m) => m.state === 'DOWN' || m.state === 'IDLE')
              .map((m) => (
                <button key={m.id} onClick={() => nav(`/machine/${m.id}`)} className="flex items-center justify-between rounded-[8px] bg-panel2 px-2.5 py-2 text-left text-[12px] hover:bg-panel3">
                  <span>
                    <b className="num text-[14px]">{m.code}</b> · {m.reasonLogged ? m.reason : 'no reason logged'}
                  </span>
                  <StatePill s={m.state} since={w.t - m.since} />
                </button>
              ))}
            <div className="mt-auto flex flex-col gap-2">
              <button className="btn btn-primary !bg-brand !text-ink" onClick={() => nav(`/unit/${s.u.id}`)}>Open unit dashboard <ArrowRight size={14} /></button>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn !border !border-line !text-fg hover:!border-line2" onClick={() => nav(`/twin/${s.u.id}`)}><Layers3 size={14} />Digital twin</button>
                <button className="btn !border !border-line !text-fg hover:!border-line2" onClick={() => notify({ tone: 'run', title: `Sent to shopfloor TV`, body: `${s.u.name} · Hall A display · within 15 s` })}><MonitorPlay size={14} />Send to TV</button>
              </div>
              <div className="text-[11px] text-fg4">Down for {dur(w.t - Math.min(...machinesOfUnit(w, s.u).filter((m) => m.state === 'DOWN').map((m) => m.since), w.t))} longest · data live</div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 2D fallback for phones */
function FlatMap({ points, onSelect }: { points: MapPoint[]; onSelect: (id: string) => void }) {
  const xs = INDIA.map(([a, b]) => proj(a, b));
  const minX = Math.min(...xs.map((p) => p[0]));
  const minZ = Math.min(...xs.map((p) => p[1]));
  const d = xs.map(([x, z], i) => `${i ? 'L' : 'M'}${(x - minX) * 10},${(z - minZ) * 10}`).join(' ') + 'Z';
  return (
    <div className="flex h-full items-center justify-center p-4 pt-20">
      <svg viewBox="0 0 300 300" className="h-full max-h-[70vh] w-full">
        <path d={d} fill="rgb(var(--panel2))" stroke="rgb(var(--mould))" strokeOpacity={0.5} />
        {points.map((p) => {
          const [x, z] = proj(p.lng, p.lat);
          return (
            <g key={p.id} onClick={() => onSelect(p.id)} className="cursor-pointer">
              <circle cx={(x - minX) * 10} cy={(z - minZ) * 10} r={4 + p.height * 6} fill={p.color} opacity={0.85} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
