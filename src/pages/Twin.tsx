import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Flame, Gauge, Tag, Truck, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Stage from '../three/Stage';
import Factory, { type FactoryOpts } from '../three/Factory';
import { useWorld } from '../sim/store';
import { aggMachines, derive, machineKpis, machinesOfUnit } from '../sim/kpi';
import { clock, cx, dur, fmt, pct, timer } from '../lib/format';
import { EASE, LiveDot, StageBadge, StatePill, TimelineBar, planText } from '../ui/primitives';
import MachineTile from '../ui/MachineTile';
import { SHIFT_LEN, shiftStartOf } from '../sim/catalog';

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const r = () => setM(window.innerWidth < 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  return m;
}

export default function Twin() {
  const { unitId = 'MN1' } = useParams();
  const w = useWorld();
  const nav = useNavigate();
  const u = w.unit[unitId] ?? w.unit.MN1;
  const ms = machinesOfUnit(w, u);
  const [opts, setOpts] = useState<FactoryOpts>({ heat: false, people: false, trucks: true, labels: true });
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const mobile = useIsMobile();
  const A = aggMachines(w, ms);
  const D = derive(A);
  const m = sel ? w.machine[sel] : null;

  const toggles: [keyof FactoryOpts, string, typeof Flame][] = [
    ['heat', 'Heatmap · OEE', Flame],
    ['people', 'Show people', Users],
    ['trucks', 'Show trucks', Truck],
    ['labels', 'Labels', Tag],
  ];

  if (mobile)
    return (
      <div className="flex flex-col gap-3 p-4">
        <h1 className="num text-[26px] font-bold">{u.name} · digital twin</h1>
        <div className="text-[13px] text-fg3">The 3D floor is built for larger screens. Here is the same live floor as tiles.</div>
        <div className="grid grid-cols-2 gap-2">
          {ms.map((x, i) => (
            <MachineTile key={x.id} w={w} m={x} i={i} compact />
          ))}
        </div>
      </div>
    );

  return (
    <div className="relative h-[calc(100vh-56px)] w-full overflow-hidden">
      <Stage className="absolute inset-0" camera={{ position: [34, 44, 58], fov: 36, near: 0.5, far: 400 }} hero>
        <Factory w={w} ms={ms} opts={opts} selected={sel} onSelect={setSel} hover={hover} setHover={setHover} />
      </Stage>

      {/* header overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-start justify-between gap-3 p-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass pointer-events-auto !rounded-[12px] px-4 py-3">
          <div className="flex items-center gap-2 text-[12px] text-fg3">
            <LiveDot label="Digital twin · live" />
            <span>· {w.org[u.orgId].name}</span>
          </div>
          <div className="num text-[26px] font-bold leading-8">{u.name}</div>
          <div className="mt-1 flex gap-4 text-[13px]">
            <span>Plan <b className="num" style={{ color: planText(D.plan) }}>{pct(D.plan)}</b></span>
            <span>OEE <b className="num">{pct(D.oee)}</b></span>
            <span className="text-run-t"><b className="num">{A.run}</b> running</span>
            <span className="text-idle-t"><b className="num">{A.idle}</b> idle</span>
            <span className="text-mould-t"><b className="num">{A.mc}</b> mould change</span>
            <span className="text-down-t"><b className="num">{A.down}</b> down</span>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass pointer-events-auto flex flex-wrap gap-1.5 !rounded-[12px] p-2">
          {toggles.map(([k, l, I]) => (
            <button key={k} onClick={() => setOpts((o) => ({ ...o, [k]: !o[k] }))} className={cx('chip !h-8', opts[k] && 'chip-on')} aria-pressed={opts[k]}>
              <I size={13} />
              {l}
            </button>
          ))}
          <select className="input !h-8 !w-auto !text-[12px]" value={u.id} onChange={(e) => (setSel(null), nav(`/twin/${e.target.value}`))} aria-label="Unit">
            {w.units.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
          <Link to={`/unit/${u.id}`} className="btn btn-ghost !h-8"><Gauge size={13} />Dashboard</Link>
        </motion.div>
      </div>

      {/* legend */}
      <div className="glass pointer-events-none absolute bottom-4 left-4 z-30 flex flex-wrap gap-3 !rounded-[10px] px-3 py-2 text-[11px] text-fg2">
        {[
          ['run', 'Running'],
          ['idle', 'Idle'],
          ['mould', 'Mould change'],
          ['down', 'Down'],
        ].map(([v, l]) => (
          <span key={v} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `rgb(var(--${v}))`, boxShadow: `0 0 8px rgb(var(--${v}))` }} />
            {l}
          </span>
        ))}
        {opts.heat && <span>· floor = OEE (≥75 green · 60–75 amber · &lt;60 red)</span>}
        <span className="text-fg3">· drag to orbit · scroll to zoom · click a machine</span>
      </div>

      {/* machine slide-in */}
      <AnimatePresence>
        {m && (
          <motion.aside initial={{ x: 420, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 420, opacity: 0 }} transition={{ duration: 0.45, ease: EASE, delay: 0.25 }} className="glass-strong absolute bottom-4 right-4 top-24 z-30 flex w-[380px] flex-col gap-3 overflow-y-auto !rounded-[14px] p-4 shadow-[var(--shadow)]">
            <MachinePanel id={m.id} onClose={() => setSel(null)} />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

function MachinePanel({ id, onClose }: { id: string; onClose: () => void }) {
  const w = useWorld();
  const nav = useNavigate();
  const m = w.machine[id];
  const k = machineKpis(w, m);
  const md = w.mould[m.mouldId];
  const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
  const s0 = shiftStartOf(w.t);
  const p = k.target ? (k.good / k.target) * 100 : 0;
  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <div className="num text-[32px] font-bold leading-9">{m.code}</div>
          <div className="text-[12px] text-fg3">{m.make} {m.tonnage} T · {m.hall}</div>
        </div>
        <button className="btn btn-ghost !h-8 !w-8 !p-0" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </div>
      <StatePill s={m.state} size="md" label={`${m.state === 'MC' ? 'MOULD CHANGE' : m.state === 'RUN' ? 'RUNNING' : m.state} · ${m.state === 'DOWN' ? timer(w.t - m.since) : dur(w.t - m.since)}`} />
      {m.state !== 'RUN' && <div className="text-[13px] text-fg2">{m.reasonLogged ? m.reason : 'No reason logged'}</div>}
      {tk && tk.stage !== 'closed' && <StageBadge stage={tk.stage} team={tk.team} />}
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="rounded-[8px] bg-panel2/70 p-2.5"><div className="overline">Parts</div><div className="num text-[20px] font-bold">{fmt(k.good)}</div><div style={{ color: planText(p) }}>{p.toFixed(0)}% of target</div></div>
        <div className="rounded-[8px] bg-panel2/70 p-2.5"><div className="overline">Cycle</div><div className="num text-[20px] font-bold" style={{ color: m.cycleFactor > 1.05 ? 'rgb(var(--down-t))' : undefined }}>{k.ct.toFixed(1)} s</div><div className="text-fg3">std {k.std.toFixed(1)} s</div></div>
        <div className="rounded-[8px] bg-panel2/70 p-2.5"><div className="overline">OEE</div><div className="num text-[20px] font-bold">{k.oee.toFixed(1)}%</div><div className="text-fg3">A {k.A.toFixed(0)} · P {k.P.toFixed(0)} · Q {k.Q.toFixed(0)}</div></div>
        <div className="rounded-[8px] bg-panel2/70 p-2.5"><div className="overline">Reject</div><div className="num text-[20px] font-bold" style={{ color: k.rej > 3 ? 'rgb(var(--down-t))' : undefined }}>{k.rej.toFixed(1)}%</div><div className="text-fg3">{fmt(m.bad)} parts</div></div>
      </div>
      <div className="text-[12px] text-fg2">
        <b>{m.wo}</b> · {w.part[md.positions[0].partId]?.name} · {md.id} ({md.positions.length} cav) · {m.operator}
      </div>
      <div>
        <TimelineBar segs={m.timeline} t0={s0} t1={s0 + SHIFT_LEN} now={w.t} h={16} />
        <div className="num mt-1 flex justify-between text-[10px] text-fg3"><span>{clock(s0)}</span><span>{clock(s0 + SHIFT_LEN)}</span></div>
      </div>
      <button className="btn btn-primary !h-10" onClick={() => nav(`/machine/${m.id}`)}>Open machine dashboard <ArrowRight size={14} /></button>
      {tk && tk.stage !== 'closed' && <button className="btn btn-ghost" onClick={() => nav(`/breakdowns?t=${tk.id}`)}>Open breakdown ticket</button>}
    </>
  );
}
