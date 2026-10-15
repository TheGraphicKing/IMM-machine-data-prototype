import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorld } from '../sim/store';
import { TARIFF, aggMachines, machinesOfUnit } from '../sim/kpi';
import { cx, fmt, fmt1, inr } from '../lib/format';
import { EASE, Panel, Sparkline } from '../ui/primitives';
import { notify } from '../shell/Toasts';

const CONTRACT = 1450; // kVA

export default function Energy() {
  const w = useWorld();
  const nav = useNavigate();
  const u = w.unit.MN1;
  const ms = machinesOfUnit(w, u);
  const A = aggMachines(w, ms);
  const utilKw = 210 + Math.sin(w.t / 300) * 18; // chillers, compressors, dryers
  const kwNow = A.kw + utilKw;
  const kva = kwNow / 0.93;
  const peak = Math.max(kva, ...((w.powerHist[u.id] ?? []).map((x) => (x + utilKw) / 0.93)));
  const hist = (w.powerHist[u.id] ?? []).map((x) => x + utilKw);
  const perPart = A.good ? A.kwh / A.good : 0;
  const rows = ms.map((m) => ({ m, kpp: (m.kwh || 0) / Math.max(1, m.parts - m.bad) })).sort((a, b) => b.kpp - a.kpp);
  const maxK = Math.max(...rows.map((r) => r.kpp), 0.0001);
  const gaugePct = Math.min(1, kva / CONTRACT);
  const angle = -120 + gaugePct * 240;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <div>
        <div className="text-[13px] text-fg3">Manesar U1 · Energy & utilities</div>
        <h1 className="num text-[30px] font-bold leading-9">₹ of power per part, peaks avoided</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Power now', `${fmt(kwNow)} kW`, `${fmt(A.kw)} machines · ${fmt(utilKw)} utilities`],
          ['Energy this shift', `${fmt(A.kwh)} kWh`, inr(A.kwh * TARIFF)],
          ['kWh / good part', perPart.toFixed(3), 'best run 0.141'],
          ['Idle energy', `${fmt(A.kwhIdle)} kWh`, `${inr(A.kwhIdle * TARIFF)} while not running`, true],
          ['Power factor', '0.93', 'target ≥ 0.95 · capacitor bank 2 off', true],
        ].map(([l, v, s, warn], i) => (
          <motion.div key={l as string} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass !rounded-[10px] p-4">
            <div className="overline">{l}</div>
            <div className="num mt-1 text-[26px] font-bold" style={{ color: warn ? 'rgb(var(--idle-t))' : undefined }}>{v}</div>
            <div className="text-[12px] text-fg3">{s}</div>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Live power flow" sub="Grid → transformer → halls and utilities · line thickness = load">
          <PowerFlow w={w} kw={A.kw} util={utilKw} />
        </Panel>
        <Panel title="Peak demand vs contract" sub={`Contract demand ${fmt(CONTRACT)} kVA · ToD peak 18:00–22:00`}>
          <div className="flex flex-col items-center">
            <svg viewBox="0 0 220 140" className="w-full max-w-[340px]">
              <path d="M 30 120 A 80 80 0 1 1 190 120" fill="none" stroke="rgb(var(--line))" strokeWidth="16" strokeLinecap="round" />
              <motion.path d="M 30 120 A 80 80 0 1 1 190 120" fill="none" stroke={gaugePct > 0.9 ? 'rgb(var(--down))' : gaugePct > 0.8 ? 'rgb(var(--idle))' : 'rgb(var(--run))'} strokeWidth="16" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: gaugePct }} transition={{ duration: 1, ease: EASE }} />
              <path d="M 160 52 A 80 80 0 0 1 190 120" fill="none" stroke="rgb(var(--down))" strokeWidth="3" strokeDasharray="3 3" />
              <motion.line x1="110" y1="120" x2="110" y2="58" stroke="rgb(var(--fg))" strokeWidth="3" strokeLinecap="round" style={{ originX: '110px', originY: '120px' }} animate={{ rotate: angle }} transition={{ duration: 1, ease: EASE }} />
              <circle cx="110" cy="120" r="6" fill="rgb(var(--fg))" />
            </svg>
            <div className="num -mt-4 text-[36px] font-bold">{fmt(kva)} <span className="text-[16px] text-fg3">kVA</span></div>
            <div className="text-[12px] text-fg3">{(gaugePct * 100).toFixed(0)}% of contract · peak today {fmt(peak)} kVA</div>
          </div>
          <div className="mt-3">
            <Sparkline data={hist.length > 2 ? hist : [kwNow, kwNow]} w={460} h={60} color="rgb(var(--mould))" fill className="w-full" />
            <div className="flex justify-between text-[10px] text-fg3"><span>last 2 h</span><span>now</span></div>
          </div>
          <button className="btn btn-ghost mt-3 w-full" onClick={() => notify({ tone: 'run', title: 'Load shedding plan armed', body: 'Dryer D-3 and compressor C-2 stagger if demand > 1,350 kVA' })}>Arm peak load shedding</button>
        </Panel>
      </div>
      <Panel title="kWh per good part by machine" sub="vs unit average · click a machine for its energy tab">
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
          {rows.map((r, i) => (
            <button key={r.m.id} onClick={() => nav(`/machine/${r.m.id}`)} className="grid grid-cols-[70px_minmax(0,1fr)_70px] items-center gap-3 text-left text-[13px]">
              <span className="num font-semibold">{r.m.code}</span>
              <div className="relative h-2.5 rounded-full bg-line/50">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(r.kpp / maxK) * 100}%` }} transition={{ delay: i * 0.02, duration: 0.5, ease: EASE }} className={cx('h-full rounded-full', r.kpp > perPart * 1.3 ? 'bg-idle' : 'bg-fg2')} />
                <div className="absolute -top-1 bottom-[-4px] w-px bg-brand" style={{ left: `${(perPart / maxK) * 100}%` }} />
              </div>
              <span className="num text-right">{r.kpp > 5 ? '—' : fmt1(r.kpp * 1000)} Wh</span>
            </button>
          ))}
        </div>
        <div className="mt-3 text-[12px] text-fg3">Orange line = unit average {fmt1(perPart * 1000)} Wh / part. Machines over +30% are amber: check heater bands and idle time.</div>
      </Panel>
    </div>
  );
}

function PowerFlow({ w, kw, util }: { w: ReturnType<typeof useWorld>; kw: number; util: number }) {
  const halls = w.unit.MN1.halls.map((h) => ({ h, kw: w.unit.MN1.machineIds.map((id) => w.machine[id]).filter((m) => m.hall === h).reduce((a, m) => a + m.kw, 0) }));
  const nodes = [...halls.map((x) => ({ l: x.h, kw: x.kw })), { l: 'Chillers', kw: util * 0.45 }, { l: 'Compressors', kw: util * 0.35 }, { l: 'Dryers', kw: util * 0.2 }];
  const total = kw + util;
  return (
    <div className="relative h-[280px]">
      <svg viewBox="0 0 600 280" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="flow" x1="0" x2="1">
            <stop offset="0" stopColor="#FE4B1E" stopOpacity="0.2" />
            <stop offset="1" stopColor="#FE4B1E" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d="M 70 140 L 210 140" stroke="url(#flow)" strokeWidth={Math.max(3, total / 60)} fill="none" />
        <path d="M 70 140 L 210 140" stroke="#fff" strokeWidth={2} fill="none" strokeDasharray="4 18" className="[animation:dash_1.2s_linear_infinite]" opacity={0.7} />
        {nodes.map((n, i) => {
          const y = 30 + i * (220 / (nodes.length - 1));
          const d = `M 250 140 C 330 140, 340 ${y}, 430 ${y}`;
          return (
            <g key={n.l}>
              <path d={d} stroke="rgb(var(--line2))" strokeWidth={Math.max(2, n.kw / 25)} fill="none" opacity={0.7} />
              <path d={d} stroke="#FE4B1E" strokeWidth={2} fill="none" strokeDasharray="3 14" className="[animation:dash_1s_linear_infinite]" />
            </g>
          );
        })}
      </svg>
      <style>{`@keyframes dash { to { stroke-dashoffset: -44; } }`}</style>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-brand/60 bg-brand/10"><Zap size={22} className="text-brand" /></div>
        <div className="mt-1 text-[11px] font-semibold">Grid 11 kV</div>
      </div>
      <div className="absolute left-[35%] top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-line2 bg-panel2 px-3 py-2 text-center">
        <div className="overline">Transformer</div>
        <div className="num text-[22px] font-bold">{fmt(total)} kW</div>
      </div>
      {nodes.map((n, i) => (
        <div key={n.l} className="absolute right-0 flex w-[160px] items-center justify-between rounded-[8px] border border-line/70 bg-panel/80 px-2.5 py-1.5 text-[12px]" style={{ top: `calc(${((30 + i * (220 / (nodes.length - 1))) / 280) * 100}% - 15px)` }}>
          <span className="font-semibold">{n.l}</span>
          <span className="num">{fmt(n.kw)} kW</span>
        </div>
      ))}
    </div>
  );
}
