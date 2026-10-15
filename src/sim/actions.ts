import { useSim } from './store';
import { DOWN_REASONS, IDLE_REASONS, TECHS, TEAMS } from './catalog';
import { closeTicket, goDown, goIdle, goRun, newTruck, pushSeg, setStage, toast, type World } from './engine';
import type { Alert, Machine, TeamId, Ticket } from './types';
import { clock } from '../lib/format';

const act = (fn: (w: World) => void) => useSim.getState().act(fn);
const me = () => {
  const r = useSim.getState().role;
  return r === 'technician' ? 'S. Pillai' : r === 'supervisor' ? 'R. Tomar' : r === 'planthead' ? 'I. Qureshi' : r === 'ceo' ? 'V. Rao' : 'N. Sethi';
};

export function assignTeam(ticketId: string, team: TeamId, symptom?: string, photos = 1) {
  act((w) => {
    const tk = w.ticket[ticketId];
    if (!tk) return;
    if (symptom) tk.symptom = symptom;
    tk.photos += photos;
    tk.assignee = TECHS[team][0];
    const m = w.machine[tk.machineId];
    if (symptom) m.reason = symptom;
    setStage(w, tk, 'assigned', me(), `${symptom ?? tk.symptom}${photos ? ' · photo attached' : ''}`, team);
    m.reasonLogged = true;
    toast(w, { tone: 'info', title: `${m.code} sent to ${TEAMS[team].label}`, body: `${tk.assignee} notified (app, SMS) · TV shows “assigned”` });
  });
}
export function imOnIt(ticketId: string) {
  act((w) => {
    const tk = w.ticket[ticketId];
    if (!tk) return;
    setStage(w, tk, 'working', tk.assignee ?? me(), "I'm on it");
    toast(w, { tone: 'info', title: `${w.machine[tk.machineId].code} · team working`, body: `${tk.assignee} arrived · repair clock started` });
  });
}
export function needSpare(ticketId: string, spare?: string) {
  act((w) => {
    const tk = w.ticket[ticketId];
    if (!tk) return;
    setStage(w, tk, 'spare', tk.assignee ?? me(), `Spare requested · ${spare ?? tk.spares[0]?.name ?? 'part'}`);
    toast(w, { tone: 'idle', title: `Store request raised · ${spare ?? tk.spares[0]?.name ?? 'spare'}`, body: `TV now shows “waiting for spare” for ${w.machine[tk.machineId].code}` });
  });
}
export function spareReady(ticketId: string) {
  act((w) => {
    const tk = w.ticket[ticketId];
    if (!tk) return;
    setStage(w, tk, 'working', 'Stores', `Spare ready · bin ${tk.spares[0]?.bin ?? 'B-14'}`);
  });
}
export function transferTeam(ticketId: string, team: TeamId, why: string) {
  act((w) => {
    const tk = w.ticket[ticketId];
    if (!tk) return;
    const from = tk.team;
    tk.history.push({ t: w.t, stage: 'transfer', by: tk.assignee ?? me(), note: `${from ? TEAMS[from].label : ''} → ${TEAMS[team].label} · ${why}` });
    tk.assignee = TECHS[team][0];
    setStage(w, tk, 'assigned', tk.assignee, 'Transferred', team);
    toast(w, { tone: 'info', title: `Transferred to ${TEAMS[team].label}`, body: why });
  });
}
export function markFixed(ticketId: string, rootCause: string, action: string, spares: Ticket['spares']) {
  act((w) => {
    const tk = w.ticket[ticketId];
    if (!tk) return;
    tk.rootCause = rootCause;
    tk.action = action;
    tk.spares = spares;
    tk.photos += 1;
    setStage(w, tk, 'verify', tk.assignee ?? me(), 'Submitted for verification');
    toast(w, { tone: 'run', title: `${w.machine[tk.machineId].code} running · verify fix`, body: `Root cause ${rootCause}` });
  });
}
export function acceptFix(ticketId: string) {
  act((w) => {
    const tk = w.ticket[ticketId];
    if (!tk) return;
    const m = w.machine[tk.machineId];
    for (const s of tk.spares) s.stock = Math.max(0, s.stock - s.qty);
    closeTicket(w, tk, me());
    toast(w, { tone: 'run', title: `${m.code} ticket ${tk.id} closed`, body: `Downtime booked to ${tk.team ? TEAMS[tk.team].label : 'team'} · ${tk.rootCause}` });
  });
}
export function rejectFix(ticketId: string, why: string) {
  act((w) => {
    const tk = w.ticket[ticketId];
    if (!tk) return;
    const m = w.machine[tk.machineId];
    tk.history.push({ t: w.t, stage: 'rejected', by: me(), note: why });
    // machine stops again; ticket back to team working
    m.state = 'DOWN';
    m.since = w.t;
    m.ticketId = tk.id;
    tk.stage = 'working';
    tk.stageAt = w.t;
    pushSeg(m, w.t, 'DOWN', { stage: 'working', team: tk.team, ticketId: tk.id, reason: m.reason });
    toast(w, { tone: 'down', title: `Fix rejected on ${m.code}`, body: why });
  });
}

/** Log a reason for a stop. Ticket-type reasons route to the team, planned ones just close as a reason. */
export function logReason(machineId: string, reason: { name: string; team: TeamId; code: string }) {
  act((w) => {
    const m = w.machine[machineId];
    if (!m) return;
    m.reason = reason.name;
    m.reasonLogged = true;
    if (m.state === 'DOWN' && m.ticketId) {
      const tk = w.ticket[m.ticketId];
      tk.rootCause = `${reason.code} ${reason.name}`;
      if (tk.stage === 'unassigned') setStage(w, tk, 'assigned', me(), `Reason logged · ${reason.name}`, reason.team);
      else pushSeg(m, w.t, 'DOWN', { stage: tk.stage, team: tk.team, ticketId: tk.id, reason: reason.name });
    } else if (m.state === 'IDLE') {
      m.team = reason.team;
      pushSeg(m, w.t, 'IDLE', { team: reason.team, reason: reason.name });
    } else {
      // reason for the most recent stop segment without reason
      for (let i = m.timeline.length - 1; i >= 0; i--) {
        const s = m.timeline[i];
        if (s.s !== 'RUN' && (!s.reason || s.stage === 'unassigned' || s.reason === 'No reason logged')) {
          s.reason = reason.name;
          s.team = reason.team;
          if (s.s === 'DOWN') s.stage = 'closed';
          break;
        }
      }
    }
    toast(w, { tone: 'info', title: `Reason logged on ${m.code}`, body: `${reason.name} · ${TEAMS[reason.team].label} · ${clock(w.t)}` });
  });
}

// ---------- alerts ----------
export function ackAlert(id: string) {
  act((w) => {
    const a = w.alerts.find((x) => x.id === id);
    if (!a || a.status !== 'open') return;
    a.status = 'ack';
    a.ackBy = me();
    a.timeline.push({ t: w.t, tone: 'mould', msg: `Acknowledged by ${me()}` });
  });
}
export function resolveAlert(id: string) {
  act((w) => {
    const a = w.alerts.find((x) => x.id === id);
    if (!a) return;
    a.status = 'resolved';
    a.timeline.push({ t: w.t, tone: 'run', msg: `Resolved by ${me()}` });
  });
}
export function escalateAlert(id: string) {
  act((w) => {
    const a = w.alerts.find((x) => x.id === id);
    if (!a) return;
    a.escalated = true;
    a.timeline.push({ t: w.t, tone: 'down', msg: `Escalated manually by ${me()} to unit head ${w.unit[a.unitId].head}` });
    toast(w, { tone: 'idle', title: 'Escalated', body: `${w.unit[a.unitId].head} notified (app, SMS, WhatsApp)` });
  });
}
export function snoozeAlert(id: string, min: number) {
  act((w) => {
    const a = w.alerts.find((x) => x.id === id);
    if (!a) return;
    a.status = 'ack';
    a.ackBy = `${me()} (snoozed ${min} min)`;
    a.timeline.push({ t: w.t, tone: 'muted', msg: `Snoozed ${min} min by ${me()} · reason: known issue` });
  });
}
export const alertMachine = (w: World, a: Alert): Machine | undefined => (a.machineId ? w.machine[a.machineId] : undefined);

// ---------- demo controls ----------
const hero = (w: World, n: number) => w.machine[`${w.heroUnitId}-${String(n).padStart(2, '0')}`];

export function demoBreak(n = 7, code = 'MM-04') {
  act((w) => {
    const m = hero(w, n);
    if (m.state === 'DOWN') return;
    const tk = goDown(w, m, code, true);
    const r = DOWN_REASONS.find((x) => x.code === code);
    m.reason = r?.name === 'Heater band failure' ? 'Heater zone 3 fault' : r?.name ?? tk.symptom;
    tk.symptom = r?.symptom ?? tk.symptom;
    if (code === 'MM-04') m.act.z3 = 180;
    toast(w, { tone: 'down', title: `${m.code} stopped · ${m.reason}`, body: `${w.unit[m.unitId].name} · ${m.tonnage} T · not assigned`, href: `/machine/${m.id}` });
  });
}
export function demoRejects(n = 12) {
  act((w) => {
    const m = hero(w, n);
    if (m.state !== 'RUN') {
      if (m.ticketId) closeTicket(w, w.ticket[m.ticketId], 'Demo');
      goRun(w, m);
    }
    m.rejSpike = 0.055;
    w.alerted.delete(`${m.id}:rejany`);
  });
}
export function demoTruckDelay() {
  act((w) => {
    const u = w.unit[w.heroUnitId];
    const k = newTruck(w, u, { dir: 'OUT', party: 'Orion Motors, Manesar', partyShort: 'Orion', status: 'Waiting for loading', delayed: true });
    k.gateIn = w.t - 72 * 60;
    toast(w, { tone: 'idle', title: `Truck ${k.plate} waiting 72 min`, body: 'Waiting for loading · Orion Motors · over 60 min limit', href: '/dispatch' });
  });
}
export function demoFixAll() {
  act((w) => {
    for (const m of w.machines) {
      if (m.state === 'DOWN' && m.ticketId) {
        const tk = w.ticket[m.ticketId];
        tk.action = tk.action || 'Repaired and tested';
        closeTicket(w, tk, 'Demo');
      } else if (m.state === 'IDLE') goRun(w, m);
      else if (m.state === 'RUN' && m.ticketId) closeTicket(w, w.ticket[m.ticketId], 'Demo');
      m.rejSpike = 0;
      m.hold = false;
    }
    for (const k of w.trucks) k.delayed = false;
    toast(w, { tone: 'run', title: 'All machines running', body: 'Every open ticket closed · trucks released' });
  });
}
export function demoIdle(n = 4) {
  act((w) => goIdle(w, hero(w, n), IDLE_REASONS[0].name, 10));
}
