import { AnimatePresence, motion } from 'framer-motion';
import { Bell, FileText, Gauge, Home, IndianRupee, Map as MapIcon, ScanLine, User } from 'lucide-react';
import { useState } from 'react';
import { useWorld } from '../sim/store';
import { aggMachines, derive, machineKpis, machinesOfUnit } from '../sim/kpi';
import { useMoney } from './Money';
import { ackAlert } from '../sim/actions';
import { latestParts } from '../sim/records';
import { clock, cx, fmt, fmt1, inr, pct } from '../lib/format';
import { EASE, PhoneFrame, PlanChip, StateMix, StatePill, planText } from '../ui/primitives';
import { SupervisorApp, TabBar, TechnicianApp } from '../ui/pwa';

export default function MobilePreview() {
  const w = useWorld();
  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="num text-[30px] font-bold leading-9">Mobile apps · one PWA for Android & iOS</h1>
        <div className="text-[13px] text-fg3">Role-based tabs · push notifications · offline queue for floor actions · 56 px targets on floor flows. Every phone below is live and clickable.</div>
      </div>
      <div className="flex gap-8 overflow-x-auto pb-4">
        <PhoneFrame time={clock(w.t)} label="Owner / CEO · money first">
          <CEOApp />
        </PhoneFrame>
        <PhoneFrame time={clock(w.t)} label="Plant head · unit, alerts, records">
          <UnitApp />
        </PhoneFrame>
        <PhoneFrame time={clock(w.t)} label="Supervisor · stops, assign, verify">
          <SupervisorApp />
        </PhoneFrame>
        <PhoneFrame time={clock(w.t)} label="Technician · my jobs">
          <TechnicianApp />
        </PhoneFrame>
      </div>
    </div>
  );
}

export function CEOApp() {
  const w = useWorld();
  const M = useMoney();
  const [tab, setTab] = useState(0);
  const a = M.all;
  const steps = [
    ['Value at std', a.capValue, 'rgb(var(--fg2))'],
    ['Downtime', -(a.downtime + a.idle), 'rgb(var(--down))'],
    ['Mould change', -a.mouldChange, '#8C7DB5'],
    ['Speed', -a.speed, 'rgb(var(--idle))'],
    ['Rejects', -a.rejects, '#A86A84'],
    ['Actual', a.actual, 'rgb(var(--run))'],
  ] as const;
  let x = 0;
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: EASE }} className="flex flex-col gap-3 p-4">
            {tab === 0 && (
              <>
                <div className="rounded-[16px] bg-panel p-4 text-fg">
                  <div className="text-[10px] font-semibold tracking-[0.1em] text-fg3">LOST TODAY · TO {clock(w.t)}</div>
                  <div className="num text-[40px] font-bold leading-[44px] text-down-t">{inr(a.lost)}</div>
                  <div className="text-[12px] text-fg3">
                    {pct((a.lost / a.capValue) * 100)} of value · {a.lost > M.yday ? `${inr(a.lost - M.yday)} more` : `${inr(M.yday - a.lost)} less`} than yesterday · MTD {inr(M.mtd)}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {steps.map(([l, v, c], i) => {
                    let left = 0;
                    const wd = (Math.abs(v) / a.capValue) * 100;
                    if (i === 0 || i === 5) {
                      left = 0;
                      x = wd;
                    } else {
                      left = x - wd;
                      x = left;
                    }
                    return (
                      <div key={l} className="grid grid-cols-[84px_minmax(0,1fr)_62px] items-center gap-2 text-[11px]">
                        <span className="text-fg2">{l}</span>
                        <span className="relative h-4">
                          <motion.span className="absolute h-full rounded-[2px]" style={{ left: `${left}%`, background: c }} initial={{ width: 0 }} animate={{ width: `${Math.max(1, wd)}%` }} transition={{ delay: i * 0.15, duration: 0.5, ease: EASE }} />
                        </span>
                        <span className="num text-right font-semibold" style={{ color: v < 0 ? 'rgb(var(--down-t))' : undefined }}>{v < 0 ? '−' : ''}{inr(Math.abs(v))}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="overline mt-1">Top leaks now</div>
                {M.leaks.slice(0, 3).map(({ m, v }) => (
                  <div key={m.id} className="flex items-center justify-between rounded-[10px] border border-line/70 p-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{w.unit[m.unitId].name} · {m.code}</div>
                      <div className="truncate text-[10px] font-bold" style={{ color: v.color }}>{v.owner}</div>
                    </div>
                    <span className="num text-[16px] font-bold text-down-t">{inr(v.value)}</span>
                  </div>
                ))}
                <div className="overline mt-1">By organisation</div>
                {M.byOrg.map(({ o, m, plan }) => (
                  <div key={o.id} className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold">{o.name}</span>
                    <span className="num text-[12px]" style={{ color: planText(plan) }}>{pct(plan)} plan</span>
                    <span className="num font-bold">{inr(m.lost)}</span>
                  </div>
                ))}
              </>
            )}
            {tab === 1 && (
              <>
                <div className="num text-[22px] font-bold">Units · live</div>
                {w.units.map((u) => {
                  const ag = aggMachines(w, machinesOfUnit(w, u));
                  const d = derive(ag);
                  return (
                    <div key={u.id} className="rounded-[12px] border border-line/70 p-3" style={{ borderTop: `3px solid rgb(var(--${d.plan >= 95 ? 'run' : d.plan >= 88 ? 'idle' : 'down'}))` }}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{u.name}</span>
                        <PlanChip p={d.plan} />
                      </div>
                      <div className="num mt-1 text-[22px] font-bold" style={{ color: planText(d.plan) }}>{pct(d.plan)}</div>
                      <StateMix run={ag.run} idle={ag.idle} mc={ag.mc} down={ag.down} off={ag.off} h={6} />
                    </div>
                  );
                })}
              </>
            )}
            {tab === 2 && (
              <>
                <div className="num text-[22px] font-bold leading-7">We have lost <span className="text-down-t">{inr(a.lost)}</span> so far today.</div>
                {M.leaks.slice(0, 3).map(({ m, v }, i) => (
                  <div key={m.id} className="flex gap-2 text-[13px]">
                    <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-bold text-ink">{i + 1}</span>
                    <span>{m.code} at {w.unit[m.unitId].name}: {v.cause} · {inr(v.value)} · {v.owner.toLowerCase()}</span>
                  </div>
                ))}
                <div className="rounded-[12px] border border-brand/50 bg-brand/10 p-3 text-[13px]">
                  <div className="overline !text-brand">One decision for today</div>
                  Approve a ₹1.8 L preventive heater check on all 450 T machines.
                </div>
              </>
            )}
            {tab === 3 && (
              <div className="flex flex-col items-center gap-2 pt-8 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-panel3 text-[20px] font-bold">VR</div>
                <div className="num text-[22px] font-bold">Vikram Rao</div>
                <div className="text-[13px] text-fg3">Managing Director · Apex Polymers Group</div>
                <div className="mt-3 w-full rounded-[10px] border border-line/70 p-3 text-left text-[13px]">Morning briefing · WhatsApp + email at 08:00 ✓</div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar items={[{ l: 'Money', icon: IndianRupee }, { l: 'Map', icon: MapIcon }, { l: 'Briefing', icon: FileText }, { l: 'Me', icon: User }]} active={tab} onTab={setTab} />
    </div>
  );
}

export function UnitApp() {
  const w = useWorld();
  const [tab, setTab] = useState(0);
  const u = w.unit.MN1;
  const ms = machinesOfUnit(w, u);
  const A = aggMachines(w, ms);
  const D = derive(A);
  const alerts = w.alerts.filter((a) => a.unitId === 'MN1' && a.status === 'open').sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
  const [scanned, setScanned] = useState<string | null>(null);
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: EASE }} className="flex flex-col gap-3 p-4">
            {tab === 0 && (
              <>
                <div className="num text-[22px] font-bold">{u.name}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] border border-line/70 p-3">
                    <div className="overline">Plan</div>
                    <div className="num text-[26px] font-bold" style={{ color: planText(D.plan) }}>{pct(D.plan)}</div>
                  </div>
                  <div className="rounded-[12px] border border-line/70 p-3">
                    <div className="overline">OEE</div>
                    <div className="num text-[26px] font-bold">{pct(D.oee)}</div>
                  </div>
                </div>
                <StateMix run={A.run} idle={A.idle} mc={A.mc} down={A.down} />
                {ms.filter((m) => m.state !== 'RUN').concat(ms.filter((m) => m.state === 'RUN').slice(0, 4)).map((m) => {
                  const k = machineKpis(w, m);
                  return (
                    <div key={m.id} className="flex items-center justify-between rounded-[10px] border border-line/70 p-2.5" style={{ borderLeft: `3px solid rgb(var(--${m.state === 'RUN' ? 'run' : m.state === 'IDLE' ? 'idle' : m.state === 'MC' ? 'mould' : 'down'}))` }}>
                      <div>
                        <div className="num text-[16px] font-bold">{m.code}</div>
                        <div className="text-[11px] text-fg3">{m.state === 'RUN' ? `${k.ct.toFixed(1)} s · ${m.operator}` : m.reasonLogged ? m.reason : 'no reason logged'}</div>
                      </div>
                      <StatePill s={m.state} />
                    </div>
                  );
                })}
              </>
            )}
            {tab === 1 && (
              <>
                <div className="num text-[22px] font-bold">Alerts · swipe to acknowledge</div>
                <AnimatePresence initial={false}>
                  {alerts.slice(0, 8).map((a) => (
                    <motion.div key={a.id} layout exit={{ x: 300, opacity: 0 }} className="relative overflow-hidden rounded-[12px]">
                      <div className="absolute inset-0 flex items-center bg-run/80 px-4 text-[12px] font-bold text-ink">ACK ✓</div>
                      <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.9 }} onDragEnd={(_, info) => info.offset.x > 90 && ackAlert(a.id)} className="relative cursor-grab bg-panel p-3" style={{ borderLeft: `4px solid rgb(var(--${a.severity === 'critical' ? 'down' : a.severity === 'warning' ? 'idle' : 'mould'}))` }}>
                        <div className="text-[11px] font-semibold text-fg3">{a.machineId ? w.machine[a.machineId].code : 'UNIT'} · {clock(a.t)}</div>
                        <div className="text-[13px] font-semibold leading-[18px]">{a.title}</div>
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {alerts.length === 0 && <div className="py-8 text-center text-[13px] text-fg3">All clear</div>}
              </>
            )}
            {tab === 2 && (
              <>
                <div className="num text-[22px] font-bold">Records</div>
                <button className="flex h-14 items-center justify-center gap-2 rounded-[12px] bg-brand text-[15px] font-bold text-ink" onClick={() => setScanned(latestParts(w, ms[4], 1)[0]?.serial ?? null)}>
                  <ScanLine size={18} />Scan serial
                </button>
                {scanned && (() => {
                  const r = latestParts(w, ms[4], 3).find((x) => x.serial === scanned) ?? latestParts(w, ms[4], 1)[0];
                  return r ? (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[12px] border border-line/70 p-3 text-[13px]">
                      <div className="font-mono font-semibold">{r.serial}</div>
                      <div className="text-fg3">{w.machine[r.machineId].code} · {clock(r.t, true)} · cavity {r.cavity}</div>
                      <div className="num mt-1 text-[22px] font-bold">{fmt1(r.weight)} g <span className={cx('text-[12px]', r.ok ? 'text-run-t' : 'text-down-t')}>{r.ok ? 'OK' : 'NOT OK'}</span></div>
                    </motion.div>
                  ) : null;
                })()}
                {latestParts(w, ms[4], 6).map((r) => (
                  <div key={r.serial} className="flex justify-between border-b border-line/50 py-1.5 text-[12px]">
                    <span className="font-mono">{r.serial}</span>
                    <span className="num">{fmt1(r.weight)} g</span>
                    <span className={r.ok ? 'text-run-t' : 'text-down-t'}>{r.ok ? 'OK' : 'NOT OK'}</span>
                  </div>
                ))}
              </>
            )}
            {tab === 3 && (
              <div className="flex flex-col items-center gap-2 pt-8 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-panel3 text-[20px] font-bold">IQ</div>
                <div className="num text-[22px] font-bold">Imran Qureshi</div>
                <div className="text-[13px] text-fg3">Plant head · Manesar U1</div>
                <div className="num mt-3 text-[13px]">{fmt(A.good)} good parts this shift</div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar items={[{ l: 'Unit', icon: Gauge }, { l: 'Alerts', icon: Bell }, { l: 'Records', icon: Home }, { l: 'Me', icon: User }]} active={tab} onTab={setTab} />
    </div>
  );
}
