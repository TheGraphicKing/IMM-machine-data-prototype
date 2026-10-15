import { AnimatePresence, motion } from 'framer-motion';
import { Clock, GripVertical } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSim, useWorld } from '../sim/store';
import { acceptFix, assignTeam, imOnIt, markFixed, needSpare, rejectFix } from '../sim/actions';
import { machineKpis, valuePerPart } from '../sim/kpi';
import { STAGE_META, TEAMS } from '../sim/catalog';
import { clock, cx, dur, fmt, inr } from '../lib/format';
import { Drawer, EASE, PhoneFrame, Segmented, StageBadge } from '../ui/primitives';
import { SupervisorApp, TechnicianApp } from '../ui/pwa';
import { notify } from '../shell/Toasts';
import type { Stage, Ticket } from '../sim/types';

const COLS: { stage: Stage; who: string; tv: string; cls: string }[] = [
  { stage: 'unassigned', who: 'Production supervisor', tv: 'red stripes', cls: 'pat-unassigned' },
  { stage: 'assigned', who: 'Assigned team', tv: 'team stripes', cls: 'pat-assigned' },
  { stage: 'working', who: 'Technician', tv: 'team solid', cls: 'pat-working' },
  { stage: 'spare', who: 'Technician → store', tv: 'team dotted', cls: 'pat-spare' },
  { stage: 'verify', who: 'Production supervisor', tv: 'green · verify fix', cls: 'pat-verify' },
];

export default function Breakdowns() {
  const w = useWorld();
  const [sp, setSp] = useSearchParams();
  const role = useSim((s) => s.role);
  const view = sp.get('view') === 'phones' || sp.get('view') === 'tech' ? 'phones' : 'board';
  const [unit, setUnit] = useState('MN1');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const openId = sp.get('t');
  const open = w.tickets.filter((t) => t.stage !== 'closed' && (unit === 'all' || t.unitId === unit));
  const closedToday = w.tickets.filter((t) => t.stage === 'closed' && (unit === 'all' || t.unitId === unit) && t.closedAt !== null);
  const resp = closedToday.map((t) => (t.history.find((h) => h.stage === 'working')?.t ?? t.stageAt) - t.createdAt).filter((x) => x > 0);
  const mttr = closedToday.map((t) => (t.closedAt ?? 0) - t.createdAt).filter((x) => x > 0);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const withReason = open.filter((t) => t.stage !== 'unassigned').length + closedToday.length;
  const totalStops = open.length + closedToday.length;

  const onDrop = (stage: Stage) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/plain') || drag;
    setDrag(null);
    if (!id) return;
    const tk = w.ticket[id];
    if (!tk || tk.stage === stage) return;
    const team = tk.team ?? (tk as Ticket & { _team?: Ticket['team'] })._team ?? 'maintenance';
    if (stage === 'assigned') assignTeam(id, team ?? 'maintenance', tk.symptom, 0);
    else if (stage === 'working') {
      if (tk.stage === 'unassigned') assignTeam(id, team ?? 'maintenance', tk.symptom, 0);
      if (tk.stage === 'verify') rejectFix(id, 'Rejected from board');
      else imOnIt(id);
    } else if (stage === 'spare') {
      if (tk.stage === 'unassigned') return notify({ tone: 'idle', title: 'Assign a team first', body: 'A spare is requested by the technician working on it' });
      needSpare(id);
    } else if (stage === 'verify') {
      if (tk.stage === 'unassigned') return notify({ tone: 'idle', title: 'Assign a team first', body: 'Only the team can submit a fix' });
      markFixed(id, tk.rootCause, tk.action || 'Repaired and tested', tk.spares);
    } else if (stage === 'unassigned') notify({ tone: 'idle', title: 'Can’t move back to “not assigned”', body: 'Use Transfer to hand the ticket to another team' });
  };

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="num text-[30px] font-bold leading-9">Breakdowns</h1>
          <div className="text-[13px] text-fg3">Every stop has an owner and a root cause · drag a card to move it through the lifecycle</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input !h-9 !w-auto !text-[13px]" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
            <option value="all">All units</option>
            {w.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <Segmented<'board' | 'phones'> options={[{ v: 'board', l: 'Board' }, { v: 'phones', l: 'Supervisor & technician apps' }]} value={view} onChange={(v) => setSp(v === 'phones' ? { view: 'phones' } : {})} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Open tickets', open.length, `${open.filter((t) => t.stage === 'unassigned').length} not assigned`],
          ['Avg response', resp.length ? dur(avg(resp)) : '—', 'stop → team arrived'],
          ['MTTR today', mttr.length ? dur(avg(mttr)) : '—', `${closedToday.length} closed`],
          ['Stops with reason', totalStops ? `${Math.round((withReason / totalStops) * 100)}%` : '—', 'target ≥ 90% in 15 min'],
          ['Repeat failures', w.tickets.filter((t) => t.unitId === unit && t.symptom.includes('Heater')).length > 1 ? 1 : 0, 'same root cause · 7 days'],
        ].map(([l, v, s], i) => (
          <motion.div key={l as string} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass !rounded-[10px] p-4">
            <div className="overline">{l}</div>
            <div className="num mt-1 text-[28px] font-bold">{v}</div>
            <div className="text-[12px] text-fg3">{s}</div>
          </motion.div>
        ))}
      </div>

      {view === 'board' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 2xl:grid-cols-5">
          {COLS.map((c) => {
            const cards = open.filter((t) => t.stage === c.stage).sort((a, b) => a.createdAt - b.createdAt);
            return (
              <div
                key={c.stage}
                onDragOver={(e) => (e.preventDefault(), setOver(c.stage))}
                onDragLeave={() => setOver(null)}
                onDrop={onDrop(c.stage)}
                className={cx('glass flex min-h-[420px] flex-col gap-2.5 !rounded-[12px] p-3 transition', over === c.stage && '!border-brand ring-2 ring-brand/30')}
              >
                <div className="flex items-center gap-2 px-1">
                  <span className={cx('h-3 w-6 rounded-[2px]', c.cls)} style={{ ['--team' as string]: '#F97316' }} />
                  <span className="num text-[16px] font-semibold">{STAGE_META[c.stage].label}</span>
                  <span className="num ml-auto rounded-full bg-panel3 px-2 text-[12px] font-semibold">{cards.length}</span>
                </div>
                <div className="px-1 text-[11px] text-fg3">
                  {c.who} · TV: {c.tv}
                </div>
                <AnimatePresence initial={false}>
                  {cards.map((tk) => (
                    <TicketCard key={tk.id} tk={tk} onDrag={setDrag} onOpen={() => setSp({ t: tk.id })} />
                  ))}
                </AnimatePresence>
                {cards.length === 0 && <div className="grid flex-1 place-items-center rounded-[10px] border border-dashed border-line2 py-8 text-[12px] text-fg4">Drop here</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="glass !rounded-[12px] p-4 text-[13px] text-fg2">
            Built for the floor: one-handed use, <b>56 px buttons</b>, photo first, almost no typing. Both phones run on the same live tickets as the board and the TV: assign on the left, accept and fix on the right, then verify on the left.
            {role === 'technician' && <span className="ml-1 font-semibold text-brand">You are viewing as the maintenance technician.</span>}
          </div>
          <div className="flex flex-wrap justify-center gap-10">
            <PhoneFrame time={clock(w.t)} label="Production supervisor · R. Tomar">
              <SupervisorApp unitId={unit === 'all' ? 'MN1' : unit} />
            </PhoneFrame>
            <PhoneFrame time={clock(w.t)} label="Maintenance technician · S. Pillai">
              <TechnicianApp unitId={unit === 'all' ? 'MN1' : unit} />
            </PhoneFrame>
            <PhoneFrame time={clock(w.t)} label="Tool room technician · V. Shetty">
              <TechnicianApp unitId={unit === 'all' ? 'MN1' : unit} team="toolroom" />
            </PhoneFrame>
          </div>
        </div>
      )}

      <div className="glass grid grid-cols-1 gap-3 !rounded-[12px] p-4 text-[12px] text-fg2 md:grid-cols-3">
        <div><b className="text-fg">↺ Transfer</b> · the team can hand off with a reason (e.g. maintenance finds a mould fault → tool room). It returns to stage 2 for the new team; the clock keeps running and both teams show in the history.</div>
        <div><b className="text-fg">✕ Fix rejected</b> · if production rejects the fix (still flashing, wrong weight…), the ticket reopens to the same team at stage 3 with the reason and photo attached.</div>
        <div><b className="text-fg">⚙ Machine signal</b> · run/stop comes from OPC. If the machine starts before the team submits, the TV shows “Running · fix not submitted” until the job is closed.</div>
      </div>

      <TicketDrawer id={openId} onClose={() => setSp(view === 'phones' ? { view: 'phones' } : {})} />
    </div>
  );
}

function TicketCard({ tk, onDrag, onOpen }: { tk: Ticket; onDrag: (id: string | null) => void; onOpen: () => void }) {
  const w = useWorld();
  const modules = useSim((s) => s.modules);
  const basis = useSim((s) => s.basis);
  const m = w.machine[tk.machineId];
  const k = machineKpis(w, m);
  const downSec = (tk.stage === 'verify' ? tk.stageAt : w.t) - tk.createdAt;
  const rupees = (downSec / k.std) * k.cavTotal * valuePerPart(w, m, basis);
  const sla = tk.stage === 'unassigned' && w.t - tk.createdAt > 600;
  const c = tk.team ? TEAMS[tk.team].color : '#D8382B';
  return (
    <motion.div
      layout
      layoutId={`tk-${tk.id}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cx('relative cursor-grab overflow-hidden rounded-[10px] border bg-panel p-3 active:cursor-grabbing', sla ? 'border-down/60 shadow-[0_0_0_1px_rgb(var(--down)/0.3),0_0_24px_rgb(var(--down)/0.2)]' : 'border-line/70')}
      onClick={onOpen}
    >
      <div
        draggable
        onDragStart={(e: DragEvent) => {
          e.dataTransfer.setData('text/plain', tk.id);
          onDrag(tk.id);
        }}
        onDragEnd={() => onDrag(null)}
        className="absolute inset-0"
        aria-hidden
      />
      <div className="pointer-events-none relative flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <GripVertical size={14} className="text-fg4" />
            <span className="num text-[18px] font-bold">{m.code}</span>
            <span className="text-[11px] text-fg3">{w.unit[m.unitId].name}</span>
          </span>
          <span className={cx('num flex items-center gap-1 text-[13px] font-semibold', sla ? 'text-down-t' : 'text-fg2')}>
            <Clock size={12} />
            {dur(w.t - tk.stageAt)}
          </span>
        </div>
        <div className="text-[13px] font-semibold">{tk.symptom}</div>
        <div className="text-[11px] text-fg3">
          {m.tonnage} T · {m.hall} · {tk.id}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold" style={{ color: c }}>
            {tk.team ? `${TEAMS[tk.team].label} · ${tk.assignee}` : sla ? 'SLA breach · assign now' : 'Not assigned'}
          </span>
        </div>
        <div className="flex justify-between border-t border-line/50 pt-1.5 text-[11px] text-fg3">
          <span>Down {dur(downSec)}</span>
          {modules.money && <span className="num font-semibold text-down-t">{inr(rupees)} so far</span>}
        </div>
      </div>
    </motion.div>
  );
}

function TicketDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const w = useWorld();
  const nav = useNavigate();
  const tk = id ? w.ticket[id] : undefined;
  return (
    <Drawer open={!!tk} onClose={onClose} title={tk ? `Ticket ${tk.id}` : ''} width={520}>
      {tk && (
        <div className="flex flex-col gap-4 p-5 text-[13px]">
          <div>
            <div className="num text-[28px] font-bold">{w.machine[tk.machineId].code} · {w.unit[tk.unitId].name}</div>
            <div className="text-fg3">{tk.symptom} · opened {clock(tk.createdAt)} · {fmt((w.t - tk.createdAt) / 60)} min ago</div>
            <div className="mt-2"><StageBadge stage={tk.stage} team={tk.team} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[8px] bg-panel2/70 p-3"><div className="overline">Assignee</div><div className="font-semibold">{tk.assignee ?? '—'}</div></div>
            <div className="rounded-[8px] bg-panel2/70 p-3"><div className="overline">Root cause</div><div className="font-semibold">{tk.stage === 'unassigned' ? '—' : tk.rootCause}</div></div>
          </div>
          <div>
            <div className="overline mb-2">History</div>
            <div className="relative flex flex-col gap-2 pl-4">
              <div className="absolute bottom-1 left-[5px] top-1 w-px bg-line" />
              {tk.history.map((h, i) => (
                <div key={i} className="relative flex gap-3">
                  <span className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-panel" style={{ background: h.stage === 'rejected' ? 'rgb(var(--down))' : h.stage === 'closed' ? 'rgb(var(--run))' : tk.team ? TEAMS[tk.team].color : 'rgb(var(--down))' }} />
                  <span className="num w-11 shrink-0 font-semibold text-fg2">{clock(h.t)}</span>
                  <span>
                    <b>{h.by}</b> · {h.note || STAGE_META[h.stage as Stage]?.label || h.stage}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {tk.stage === 'unassigned' && <button className="btn btn-primary" onClick={() => assignTeam(tk.id, (tk as Ticket & { _team?: Ticket['team'] })._team ?? 'maintenance', tk.symptom)}>Assign {TEAMS[(tk as Ticket & { _team?: Ticket['team'] })._team ?? 'maintenance'].label}</button>}
            {tk.stage === 'assigned' && <button className="btn btn-primary" onClick={() => imOnIt(tk.id)}>Team arrived (I’m on it)</button>}
            {(tk.stage === 'working' || tk.stage === 'spare') && <button className="btn btn-primary" onClick={() => markFixed(tk.id, tk.rootCause, tk.action || 'Repaired and tested', tk.spares)}>Mark fixed</button>}
            {tk.stage === 'working' && <button className="btn btn-ghost" onClick={() => needSpare(tk.id)}>Need spare</button>}
            {tk.stage === 'verify' && <button className="btn btn-primary" onClick={() => acceptFix(tk.id)}>Accept & close</button>}
            {tk.stage === 'verify' && <button className="btn btn-danger" onClick={() => rejectFix(tk.id, 'Still flashing')}>Reject fix</button>}
            <button className="btn btn-ghost" onClick={() => nav(`/machine/${tk.machineId}`)}>Open machine</button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
