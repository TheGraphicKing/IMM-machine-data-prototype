import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Bell, Camera, Check, Home, ListChecks, Mic, Minus, Package, Plus, Repeat, User, Video, Wrench, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useWorld } from '../sim/store';
import { DOWN_REASONS, SYMPTOMS, TEAMS, TICKET_TEAMS } from '../sim/catalog';
import { acceptFix, assignTeam, imOnIt, markFixed, needSpare, rejectFix, transferTeam } from '../sim/actions';
import { machineKpis } from '../sim/kpi';
import { clock, cx, dur, timer } from '../lib/format';
import { EASE, stageLabel } from './primitives';
import type { TeamId, Ticket } from '../sim/types';

const slide = { initial: { x: 40, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -40, opacity: 0 }, transition: { duration: 0.28, ease: EASE } };

function Header({ title, sub, onBack, right }: { title: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-line/60 px-4 pb-3 pt-1">
      {onBack && (
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full hover:bg-panel3" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="num truncate text-[20px] font-bold leading-6">{title}</div>
        {sub && <div className="truncate text-[12px] text-fg3">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function TabBar({ items, active, onTab }: { items: { l: string; icon: typeof Home }[]; active: number; onTab?: (i: number) => void }) {
  return (
    <div className="flex h-14 shrink-0 items-stretch border-t border-line/60 bg-panel/80">
      {items.map((it, i) => (
        <button key={it.l} onClick={() => onTab?.(i)} className={cx('flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold', i === active ? 'text-brand' : 'text-fg3')}>
          <it.icon size={18} />
          {it.l}
        </button>
      ))}
    </div>
  );
}

function PatternChip({ tk }: { tk: Ticket }) {
  const c = tk.team ? TEAMS[tk.team].color : '#B9533F';
  const cls = tk.stage === 'unassigned' ? 'pat-unassigned' : tk.stage === 'assigned' ? 'pat-assigned' : tk.stage === 'spare' ? 'pat-spare' : tk.stage === 'verify' ? 'pat-verify' : 'pat-working';
  return <span className={cx('h-full w-1.5 shrink-0 rounded-l-[10px]', cls)} style={{ ['--team' as string]: c }} />;
}

const Big = ({ children, onClick, tone = 'primary', className, disabled }: { children: ReactNode; onClick?: () => void; tone?: 'primary' | 'ghost' | 'danger' | 'ok'; className?: string; disabled?: boolean }) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    disabled={disabled}
    onClick={onClick}
    className={cx(
      'flex h-14 items-center justify-center gap-2 rounded-[12px] px-4 text-[15px] font-bold transition',
      tone === 'primary' && 'bg-brand text-ink',
      tone === 'ghost' && 'border border-line2 bg-panel2 text-fg',
      tone === 'danger' && 'border border-down/60 text-down-t',
      tone === 'ok' && 'bg-run text-ink',
      disabled && 'opacity-40',
      className,
    )}
  >
    {children}
  </motion.button>
);

// ---------------- Supervisor ----------------
export function SupervisorApp({ unitId = 'MN1' }: { unitId?: string }) {
  const w = useWorld();
  const [screen, setScreen] = useState<{ k: 'list' } | { k: 'assign'; id: string } | { k: 'verify'; id: string }>({ k: 'list' });
  const [tab, setTab] = useState<'assign' | 'team' | 'verify'>('assign');
  const open = w.tickets.filter((t) => t.unitId === unitId && t.stage !== 'closed');
  const toAssign = open.filter((t) => t.stage === 'unassigned');
  const withTeam = open.filter((t) => ['assigned', 'working', 'spare'].includes(t.stage));
  const verify = open.filter((t) => t.stage === 'verify');
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {screen.k === 'list' && (
            <motion.div key="list" {...slide}>
              <Header title="Stopped machines" sub={`${w.unit[unitId].name} · Shift A · R. Tomar`} />
              <div className="flex gap-1.5 px-4 py-3">
                {([
                  ['assign', `To assign · ${toAssign.length}`],
                  ['team', `With team · ${withTeam.length}`],
                  ['verify', `Verify · ${verify.length}`],
                ] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={cx('h-9 flex-1 rounded-full text-[12px] font-semibold', tab === k ? 'bg-fg text-bg' : 'border border-line2 text-fg2')}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2.5 px-4 pb-4">
                {(tab === 'assign' ? toAssign : tab === 'team' ? withTeam : verify).map((tk) => {
                  const m = w.machine[tk.machineId];
                  return (
                    <motion.div layout key={tk.id} className="flex overflow-hidden rounded-[12px] border border-line/70 bg-panel">
                      <PatternChip tk={tk} />
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <div className="flex items-center justify-between">
                          <span className="num text-[22px] font-bold">{m.code}</span>
                          <span className="num text-[20px] font-bold text-down-t">{timer(w.t - tk.createdAt)}</span>
                        </div>
                        <div className="text-[12px] text-fg3">
                          {m.hall} · {m.tonnage} T · {m.mouldId} · stopped {clock(tk.createdAt)}
                        </div>
                        {tab !== 'assign' && <div className="text-[12px] font-semibold" style={{ color: tk.team ? TEAMS[tk.team].color : undefined }}>{stageLabel(tk.stage, tk.team)} · {tk.assignee}</div>}
                        {tab === 'assign' && <Big onClick={() => setScreen({ k: 'assign', id: tk.id })}>Assign team + photo →</Big>}
                        {tab === 'verify' && <Big tone="ok" onClick={() => setScreen({ k: 'verify', id: tk.id })}>Verify fix →</Big>}
                      </div>
                    </motion.div>
                  );
                })}
                {(tab === 'assign' ? toAssign : tab === 'team' ? withTeam : verify).length === 0 && (
                  <div className="py-10 text-center text-[13px] text-fg3">{tab === 'assign' ? 'Nothing to assign · every stop has a team' : tab === 'verify' ? 'No fixes waiting for verification' : 'No machines with a team right now'}</div>
                )}
              </div>
            </motion.div>
          )}
          {screen.k === 'assign' && <AssignScreen key="assign" id={screen.id} onDone={() => (setScreen({ k: 'list' }), setTab('team'))} onBack={() => setScreen({ k: 'list' })} />}
          {screen.k === 'verify' && <VerifyScreen key="verify" id={screen.id} onDone={() => setScreen({ k: 'list' })} />}
        </AnimatePresence>
      </div>
      <TabBar items={[{ l: 'Stops', icon: AlertTriangle }, { l: 'Unit', icon: Home }, { l: 'Alerts', icon: Bell }, { l: 'Me', icon: User }]} active={0} />
    </div>
  );
}

function AssignScreen({ id, onDone, onBack }: { id: string; onDone: () => void; onBack: () => void }) {
  const w = useWorld();
  const tk = w.ticket[id];
  const m = w.machine[tk.machineId];
  const [team, setTeam] = useState<TeamId>('maintenance');
  const [sym, setSym] = useState<string>(SYMPTOMS[0]);
  const [photos, setPhotos] = useState(1);
  return (
    <motion.div {...slide}>
      <Header title={`${m.code} · assign`} sub={`Stopped ${dur(w.t - tk.createdAt)} · ${m.mouldId}`} onBack={onBack} />
      <div className="flex flex-col gap-4 p-4">
        <div>
          <div className="overline mb-2">1 · Who should fix it?</div>
          <div className="grid grid-cols-2 gap-2">
            {TICKET_TEAMS.map((t) => (
              <button key={t} onClick={() => setTeam(t)} className={cx('flex h-14 items-center gap-2 rounded-[12px] border px-3 text-left text-[13px] font-semibold transition', team === t ? 'bg-brand/10' : 'border-line2')} style={{ borderColor: team === t ? TEAMS[t].color : undefined }}>
                <span className="h-4 w-4 shrink-0 rounded-[3px]" style={{ background: TEAMS[t].color }} />
                {TEAMS[t].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="overline mb-2">2 · What do you see? <span className="normal-case tracking-normal">(optional)</span></div>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOMS.slice(0, 6).map((s) => (
              <button key={s} onClick={() => setSym(s)} className={cx('h-10 rounded-full px-3 text-[13px] font-semibold', sym === s ? 'bg-fg text-bg' : 'border border-line2')}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="overline mb-2">3 · Photo / video</div>
          <div className="flex gap-2">
            {Array.from({ length: photos }).map((_, i) => (
              <div key={i} className="grid h-16 w-16 place-items-center rounded-[10px] bg-[repeating-linear-gradient(45deg,rgb(var(--panel3))_0_6px,rgb(var(--panel2))_6px_12px)] text-[10px] text-fg3">
                {i === 1 ? <Video size={16} /> : 'photo'}
              </div>
            ))}
            <button onClick={() => setPhotos((p) => Math.min(3, p + 1))} className="grid h-16 w-16 place-items-center rounded-[10px] border border-dashed border-line2 text-fg2">
              <Camera size={18} />
            </button>
          </div>
        </div>
        <Big onClick={() => (assignTeam(id, team, sym, photos), onDone())}>Send to {TEAMS[team].label}</Big>
      </div>
    </motion.div>
  );
}

function VerifyScreen({ id, onDone }: { id: string; onDone: () => void }) {
  const w = useWorld();
  const tk = w.ticket[id];
  const m = w.machine[tk.machineId];
  const [rejecting, setRejecting] = useState(false);
  const k = machineKpis(w, m);
  const part = w.part[w.mould[m.mouldId].positions[0].partId];
  if (!tk || tk.stage !== 'verify')
    return (
      <motion.div {...slide} className="p-6 text-center">
        <div className="num text-[22px] font-bold">Ticket closed</div>
        <Big className="mt-4 w-full" tone="ghost" onClick={onDone}>Back to stops</Big>
      </motion.div>
    );
  return (
    <motion.div {...slide}>
      <Header title={`${m.code} · verify fix`} sub={`${tk.team ? TEAMS[tk.team].label : ''} · ${tk.assignee} · ticket #${tk.id}`} onBack={onDone} />
      <div className="flex flex-col gap-3 p-4 text-[13px]">
        <div className="flex items-center justify-between rounded-[12px] bg-run/12 p-3">
          <div>
            <div className="overline">Machine signal · live</div>
            <div className="font-semibold text-run-t">Running since {clock(m.since)} · {dur(w.t - m.since)}</div>
          </div>
          <Check className="text-run-t" />
        </div>
        <Row l="Downtime" v={`${clock(tk.createdAt)} → ${clock(tk.stageAt)} · ${Math.round((tk.stageAt - tk.createdAt) / 60)} min`} />
        <Row l="Root cause" v={tk.rootCause} />
        <Row l="Action" v={tk.action || 'Replaced and tested'} />
        <Row l="Spares used" v={tk.spares.map((s) => `${s.name} × ${s.qty}`).join(', ') || 'None'} />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-20 rounded-[10px] bg-[repeating-linear-gradient(45deg,rgb(var(--down)/0.25)_0_6px,transparent_6px_12px)] p-2 text-[11px] text-fg3">Before · from you</div>
          <div className="h-20 rounded-[10px] bg-[repeating-linear-gradient(45deg,rgb(var(--run)/0.25)_0_6px,transparent_6px_12px)] p-2 text-[11px] text-fg3">After · from team</div>
        </div>
        <div className="text-fg2">
          First 20 parts after restart: <b className="text-run-t">all OK</b> · avg weight {part?.weight.toFixed(1)} g · cycle {k.ct.toFixed(1)} s
        </div>
        {rejecting ? (
          <div className="flex flex-col gap-2">
            <div className="overline">Why reject?</div>
            {['Still flashing', 'Weight out of tolerance', 'Leak not fixed'].map((r) => (
              <Big key={r} tone="danger" onClick={() => (rejectFix(id, r), onDone())}>{r}</Big>
            ))}
            <Big tone="ghost" onClick={() => setRejecting(false)}>Cancel</Big>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Big tone="danger" onClick={() => setRejecting(true)}>Reject</Big>
            <Big tone="ok" onClick={() => (acceptFix(id), onDone())}>Accept & close</Big>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const Row = ({ l, v }: { l: string; v: ReactNode }) => (
  <div className="flex justify-between gap-3 border-b border-line/50 pb-2">
    <span className="text-fg3">{l}</span>
    <span className="text-right font-semibold">{v}</span>
  </div>
);

// ---------------- Technician ----------------
export function TechnicianApp({ unitId = 'MN1', team = 'maintenance' as TeamId }: { unitId?: string; team?: TeamId }) {
  const w = useWorld();
  const [screen, setScreen] = useState<{ k: 'jobs' } | { k: 'work'; id: string } | { k: 'close'; id: string }>({ k: 'jobs' });
  const [sheet, setSheet] = useState<null | 'transfer' | 'spare'>(null);
  const jobs = w.tickets.filter((t) => t.unitId === unitId && (t.team === team || (t.stage === 'verify' && t.team === team)) && t.stage !== 'closed').sort((a, b) => a.createdAt - b.createdAt);
  return (
    <div className="relative flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {screen.k === 'jobs' && (
            <motion.div key="jobs" {...slide}>
              <Header title={`My jobs · ${jobs.length}`} sub={`${TEAMS[team].label} · ${w.unit[unitId].name}`} right={<span className="rounded-full bg-run/15 px-2.5 py-1 text-[11px] font-semibold text-run-t">On shift</span>} />
              <div className="flex flex-col gap-2.5 p-4">
                {jobs.map((tk) => {
                  const m = w.machine[tk.machineId];
                  const mine = tk.stage === 'working' || tk.stage === 'spare';
                  return (
                    <motion.div layout key={tk.id} className="flex overflow-hidden rounded-[12px] border border-line/70 bg-panel">
                      <PatternChip tk={tk} />
                      <div className="flex flex-1 flex-col gap-1.5 p-3">
                        <div className="flex items-center justify-between">
                          <span className="num text-[22px] font-bold">{m.code}</span>
                          <span className="num text-[18px] font-bold">{tk.stage === 'verify' ? '—' : dur(w.t - tk.createdAt)}</span>
                        </div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: tk.stage === 'verify' ? 'rgb(var(--run-t))' : TEAMS[team].color }}>
                          {tk.stage === 'assigned' ? `NEW · ASSIGNED ${clock(tk.stageAt)} · not accepted` : mine ? `YOU ARE WORKING · since ${clock(tk.history.find((h) => h.stage === 'working')?.t ?? tk.stageAt)}` : 'SUBMITTED · waiting for production to verify'}
                        </div>
                        <div className="text-[12px] text-fg3">
                          {tk.symptom} · {m.make} {m.tonnage} T · {m.hall}
                        </div>
                        {tk.stage === 'assigned' && <Big onClick={() => (imOnIt(tk.id), setScreen({ k: 'work', id: tk.id }))}>I’m on it</Big>}
                        {mine && <Big tone="ghost" onClick={() => setScreen({ k: 'work', id: tk.id })}>Continue →</Big>}
                      </div>
                    </motion.div>
                  );
                })}
                {jobs.length === 0 && <div className="py-10 text-center text-[13px] text-fg3">No open jobs for {TEAMS[team].label}. Nice.</div>}
              </div>
            </motion.div>
          )}
          {screen.k === 'work' && <WorkScreen key="work" id={screen.id} onBack={() => setScreen({ k: 'jobs' })} onFix={() => setScreen({ k: 'close', id: screen.id })} onSheet={setSheet} />}
          {screen.k === 'close' && <CloseScreen key="close" id={screen.id} onBack={() => setScreen({ k: 'work', id: screen.id })} onDone={() => setScreen({ k: 'jobs' })} />}
        </AnimatePresence>
      </div>
      <TabBar items={[{ l: 'Jobs', icon: Wrench }, { l: 'History', icon: ListChecks }, { l: 'Spares', icon: Package }, { l: 'Me', icon: User }]} active={0} />
      <AnimatePresence>
        {sheet && screen.k === 'work' && (
          <>
            <motion.div className="absolute inset-0 z-10 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(null)} />
            <motion.div className="absolute inset-x-0 bottom-0 z-20 rounded-t-[20px] border-t border-line2 bg-panel p-4" initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} transition={{ duration: 0.3, ease: EASE }}>
              {sheet === 'transfer' ? <TransferSheet id={screen.id} onDone={() => (setSheet(null), setScreen({ k: 'jobs' }))} /> : <SpareSheet id={screen.id} onDone={() => setSheet(null)} />}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function WorkScreen({ id, onBack, onFix, onSheet }: { id: string; onBack: () => void; onFix: () => void; onSheet: (s: 'transfer' | 'spare') => void }) {
  const w = useWorld();
  const tk = w.ticket[id];
  const m = w.machine[tk.machineId];
  const started = tk.history.find((h) => h.stage === 'working')?.t ?? tk.stageAt;
  const last = w.tickets.filter((t) => t.machineId === m.id && t.id !== id).slice(0, 3);
  return (
    <motion.div {...slide}>
      <Header title={m.code} sub={`Ticket #${tk.id}`} onBack={onBack} />
      <div className="flex flex-col gap-3 p-4 text-[13px]">
        <div className="rounded-[14px] p-4 text-center" style={{ background: `${TEAMS[tk.team ?? 'maintenance'].color}22` }}>
          <div className="num text-[52px] font-bold leading-none">{timer(w.t - started)}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: TEAMS[tk.team ?? 'maintenance'].color }}>
            {tk.stage === 'spare' ? 'WAITING FOR SPARE' : `${TEAMS[tk.team ?? 'maintenance'].label.toUpperCase()} WORKING`} · you since {clock(started)}
          </div>
        </div>
        <div className="rounded-[12px] border border-line/70 p-3">
          <div className="overline">From production · R. Tomar {clock(tk.createdAt)}</div>
          <div className="mt-1 font-semibold">{tk.symptom}</div>
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: Math.max(1, tk.photos) }).map((_, i) => (
              <div key={i} className="h-12 w-12 rounded-md bg-[repeating-linear-gradient(45deg,rgb(var(--panel3))_0_5px,rgb(var(--panel2))_5px_10px)]" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[12px] border border-line/70 p-3">
            <div className="overline">Machine</div>
            <div className="font-semibold">{m.make} {m.tonnage} T · {m.hall}</div>
            <div className={cx('text-[12px] font-semibold', m.state === 'DOWN' ? 'text-down-t' : 'text-run-t')}>{m.state === 'DOWN' ? 'Stopped (OPC)' : 'Running (OPC)'}</div>
          </div>
          <div className="rounded-[12px] border border-line/70 p-3">
            <div className="overline">Zone 3 actual / set</div>
            <div className="num text-[20px] font-bold" style={{ color: m.act.z3 < m.set.z3 - 10 ? 'rgb(var(--down-t))' : undefined }}>
              {Math.round(m.act.z3)} / {Math.round(m.set.z3)} °C
            </div>
          </div>
        </div>
        <div className="text-[12px] text-fg3">Last 3 jobs on this machine: {last.map((t) => `${t.symptom} · ${clock(t.createdAt)}`).join(' · ') || 'Heater band · 14 Sep'}</div>
        {tk.stage === 'spare' && <div className="rounded-[10px] bg-idle/15 p-2.5 text-[12px] font-semibold text-idle-t">Spare request sent · {tk.spares[0]?.name ?? 'part'} · store: ready for pickup, bin {tk.spares[0]?.bin ?? 'B-14'}</div>}
        <div className="grid grid-cols-2 gap-2">
          <Big tone="ghost" onClick={() => onSheet('spare')}><Package size={16} />Need spare</Big>
          <Big tone="ghost" onClick={() => onSheet('transfer')}><Repeat size={16} />Transfer team</Big>
        </div>
        <Big onClick={onFix}>Mark fixed →</Big>
      </div>
    </motion.div>
  );
}

function CloseScreen({ id, onBack, onDone }: { id: string; onBack: () => void; onDone: () => void }) {
  const w = useWorld();
  const tk = w.ticket[id];
  const m = w.machine[tk.machineId];
  const team = tk.team ?? 'maintenance';
  const causes = DOWN_REASONS.filter((r) => r.team === team);
  const [cause, setCause] = useState(causes.find((c) => tk.rootCause.startsWith(c.code)) ?? causes[0] ?? DOWN_REASONS[0]);
  const [spares, setSpares] = useState(tk.spares.length ? tk.spares.map((s) => ({ ...s })) : cause.spare ? [{ code: cause.spare[0], name: cause.spare[1], bin: cause.spare[2], stock: cause.spare[3], qty: 1 }] : []);
  return (
    <motion.div {...slide}>
      <Header title={`${m.code} · close job`} sub={`Downtime ${dur(w.t - tk.createdAt)} · ${TEAMS[team].label}`} onBack={onBack} />
      <div className="flex flex-col gap-3 p-4 text-[13px]">
        <div>
          <div className="overline mb-1.5">Root cause *</div>
          <div className="flex flex-col gap-1.5">
            {causes.map((c) => (
              <button key={c.code} onClick={() => (setCause(c), c.spare && !spares.find((s) => s.code === c.spare![0]) && setSpares((s) => [...s, { code: c.spare![0], name: c.spare![1], bin: c.spare![2], stock: c.spare![3], qty: 1 }]))} className={cx('flex h-12 items-center justify-between rounded-[10px] border px-3 text-left', cause.code === c.code ? 'border-brand bg-brand/10' : 'border-line2')}>
                <span className="font-semibold">{c.name}</span>
                <span className="num text-[11px] text-fg3">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="overline mb-1.5">Spares used</div>
          {spares.map((s, i) => (
            <div key={s.code} className="flex items-center gap-2 border-b border-line/50 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="num text-[11px] text-fg3">{s.code} · stock {s.stock} · bin {s.bin}</div>
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-full border border-line2" onClick={() => setSpares((x) => x.map((y, j) => (j === i ? { ...y, qty: Math.max(0, y.qty - 1) } : y)))} aria-label="Less"><Minus size={14} /></button>
              <span className="num w-5 text-center text-[16px] font-bold">{s.qty}</span>
              <button className="grid h-10 w-10 place-items-center rounded-full border border-line2" onClick={() => setSpares((x) => x.map((y, j) => (j === i ? { ...y, qty: y.qty + 1 } : y)))} aria-label="More"><Plus size={14} /></button>
            </div>
          ))}
          {spares.length === 0 && <div className="text-fg3">No spares · add with search or scan</div>}
        </div>
        <div className="flex items-center gap-2">
          <div className="grid h-14 w-14 place-items-center rounded-[10px] bg-[repeating-linear-gradient(45deg,rgb(var(--run)/0.25)_0_5px,transparent_5px_10px)] text-[10px]">after</div>
          <div className={cx('flex-1 rounded-[10px] p-2.5 text-[12px] font-semibold', m.state === 'DOWN' ? 'bg-idle/15 text-idle-t' : 'bg-run/15 text-run-t')}>
            Machine signal: {m.state === 'DOWN' ? 'restart pending on submit' : `running since ${clock(m.since)} ✓`}
          </div>
        </div>
        <Big onClick={() => (markFixed(id, `${cause.code} ${cause.name}`, `Replaced ${spares.filter((s) => s.qty).map((s) => s.name.toLowerCase()).join(' + ') || 'and adjusted'}`, spares.filter((s) => s.qty > 0)), onDone())}>Submit for verification</Big>
      </div>
    </motion.div>
  );
}

function TransferSheet({ id, onDone }: { id: string; onDone: () => void }) {
  const w = useWorld();
  const tk = w.ticket[id];
  const [to, setTo] = useState<TeamId>('toolroom');
  const [why, setWhy] = useState('Mould-side fault');
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex items-center justify-between">
        <div className="num text-[20px] font-bold">Transfer {w.machine[tk.machineId].code}</div>
        <span className="text-fg3">from {tk.team ? TEAMS[tk.team].label : ''}</span>
      </div>
      <div className="overline">To</div>
      <div className="grid grid-cols-2 gap-2">
        {(['toolroom', 'utilities', 'store', 'quality'] as TeamId[]).map((t) => (
          <button key={t} onClick={() => setTo(t)} className={cx('flex h-12 items-center gap-2 rounded-[10px] border px-3 font-semibold', to === t && 'bg-brand/10')} style={{ borderColor: to === t ? TEAMS[t].color : undefined }}>
            <span className="h-3.5 w-3.5 rounded-[3px]" style={{ background: TEAMS[t].color }} />
            {TEAMS[t].label}
          </button>
        ))}
      </div>
      <div className="overline">Why</div>
      <div className="flex flex-wrap gap-1.5">
        {['Mould-side fault', 'Needs mould removal', 'Not a machine issue'].map((x) => (
          <button key={x} onClick={() => setWhy(x)} className={cx('h-10 rounded-full px-3 font-semibold', why === x ? 'bg-fg text-bg' : 'border border-line2')}>
            {x}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-[10px] border border-line/70 p-2 text-[12px] text-fg2">
        <Mic size={14} className="text-brand" />“Leak is from the mould cooling line, not the machine manifold.” · 0:08
      </div>
      <Big onClick={() => (transferTeam(id, to, why), onDone())}>Transfer to {TEAMS[to].label}</Big>
    </div>
  );
}

function SpareSheet({ id, onDone }: { id: string; onDone: () => void }) {
  const w = useWorld();
  const tk = w.ticket[id];
  const opts = DOWN_REASONS.filter((r) => r.spare).map((r) => r.spare!);
  const [pick, setPick] = useState(0);
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex items-center justify-between">
        <div className="num text-[20px] font-bold">Need spare · {w.machine[tk.machineId].code}</div>
        <button onClick={onDone} aria-label="Close"><X size={18} /></button>
      </div>
      {opts.slice(0, 4).map((o, i) => (
        <button key={o[0]} onClick={() => setPick(i)} className={cx('flex h-14 items-center justify-between rounded-[10px] border px-3 text-left', pick === i ? 'border-brand bg-brand/10' : 'border-line2')}>
          <span>
            <span className="block font-semibold">{o[1]}</span>
            <span className="num text-[11px] text-fg3">{o[0]} · stock {o[3]} · bin {o[2]}</span>
          </span>
          {pick === i && <Check size={16} className="text-brand" />}
        </button>
      ))}
      <Big onClick={() => (needSpare(id, opts[pick][1]), onDone())}>Request from store</Big>
    </div>
  );
}


