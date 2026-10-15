import { DAY, DOWN_REASONS, IDLE_REASONS, SHIFT_LEN, TEAMS, TECHS, shiftOf, shiftStartOf } from './catalog';
import { clock, dur, fmt } from '../lib/format';
import { irange, pick, range, type Rng } from '../lib/rng';
import type { Alert, AlertType, MState, Machine, Mould, Order, Part, Segment, Severity, Stage, TeamId, Ticket, Toast, Truck, Unit, Org, ShiftSummary, Employee, Job, HeldIngest } from './types';

export const PLAN_FACTOR = 0.82; // PPC plans at 78% of standard capacity
export const START_T = 5 * 3600 + 42 * 60; // 11:42 shop-floor time

export interface ScriptEvent {
  at: number;
  run: (w: World) => void;
  done?: boolean;
}

export interface World {
  t: number;
  day: number; // day-of-month
  rng: Rng;
  orgs: Org[];
  units: Unit[];
  machines: Machine[];
  moulds: Mould[];
  parts: Part[];
  org: Record<string, Org>;
  unit: Record<string, Unit>;
  machine: Record<string, Machine>;
  mould: Record<string, Mould>;
  part: Record<string, Part>;
  tickets: Ticket[];
  ticket: Record<string, Ticket>;
  alerts: Alert[];
  trucks: Truck[];
  orders: Order[];
  prevShifts: Record<string, ShiftSummary[]>;
  employees: Employee[];
  jobs: Job[];
  held: HeldIngest[];
  script: ScriptEvent[];
  seq: { ticket: number; alert: number; truck: number; wo: number };
  toasts: Toast[];
  powerHist: Record<string, number[]>;
  alerted: Set<string>;
  warm: boolean;
  heroUnitId: string;
  shiftsCompleted: number;
}

// ---------- helpers ----------
export const activeCav = (w: World, m: Machine) => {
  const md = w.mould[m.mouldId];
  return md ? md.blocked.filter((b) => !b).length : 1;
};
export const totalCav = (w: World, m: Machine) => w.mould[m.mouldId]?.positions.length ?? 1;
export const stdOf = (w: World, m: Machine) => w.mould[m.mouldId]?.stdCycle ?? 30;
export const partOf = (w: World, m: Machine) => w.part[w.mould[m.mouldId]?.positions[0]?.partId ?? ''];
export const hourIdx = (t: number) => Math.min(7, Math.max(0, Math.floor((t - shiftStartOf(t)) / 3600)));

export function pushSeg(m: Machine, t: number, s: MState, extra: Partial<Segment> = {}) {
  const last = m.timeline[m.timeline.length - 1];
  if (last) last.end = t;
  if (last && last.s === s && last.stage === extra.stage && last.team === extra.team && last.reason === extra.reason && last.end - last.start >= 0) {
    return;
  }
  // drop zero-length
  if (last && last.end - last.start < 1) m.timeline.pop();
  m.timeline.push({ s, start: t, end: t, ...extra });
}

function setState(w: World, m: Machine, s: MState, reason = '', extra: Partial<Segment> = {}) {
  m.state = s;
  m.since = w.t;
  m.reason = reason;
  pushSeg(m, w.t, s, { reason, ...extra });
}

export function toast(w: World, t: Omit<Toast, 'id'>) {
  if (w.warm) return;
  w.toasts.push({ ...t, id: `T${Date.now()}${Math.random().toString(36).slice(2, 6)}` });
  if (w.toasts.length > 6) w.toasts.shift();
}

export function addAlert(w: World, a: { type: AlertType; severity: Severity; title: string; unitId: string; machineId?: string; notified: string; first: string; tone?: Alert['timeline'][0]['tone'] }) {
  const id = `AL-${String(++w.seq.alert).padStart(5, '0')}`;
  const al: Alert = {
    id,
    type: a.type,
    severity: a.severity,
    title: a.title,
    unitId: a.unitId,
    machineId: a.machineId,
    t: w.t,
    status: 'open',
    timeline: [{ t: w.t, tone: a.tone ?? (a.severity === 'critical' ? 'down' : a.severity === 'warning' ? 'idle' : 'mould'), msg: a.first }],
    notified: a.notified,
  };
  w.alerts.unshift(al);
  if (w.alerts.length > 160) w.alerts.length = 160;
  if (a.severity === 'critical' || (a.severity === 'warning' && a.unitId === w.heroUnitId)) {
    const u = w.unit[a.unitId];
    toast(w, {
      tone: a.severity === 'critical' ? 'down' : 'idle',
      title: a.title,
      body: `${u.name}${a.machineId ? ' · ' + w.machine[a.machineId].code : ''} · ${clock(w.t)}`,
      href: a.machineId ? `/machine/${a.machineId}` : `/alerts`,
    });
  }
  return al;
}

function resolveAlertsFor(w: World, machineId: string, type: AlertType, msg: string) {
  for (const a of w.alerts) {
    if (a.machineId === machineId && a.type === type && a.status !== 'resolved') {
      a.status = 'resolved';
      a.timeline.push({ t: w.t, tone: 'run', msg });
    }
  }
}

// ---------- tickets ----------
export function createTicket(w: World, m: Machine, reasonCode: string | null, hold = false): Ticket {
  const r = DOWN_REASONS.find((x) => x.code === reasonCode) ?? pick(w.rng, DOWN_REASONS);
  const u = w.unit[m.unitId];
  const id = `${u.code}-${2610 + (w.day % 10)}-${String(++w.seq.ticket).padStart(4, '0')}`;
  const tk: Ticket = {
    id,
    machineId: m.id,
    unitId: m.unitId,
    stage: 'unassigned',
    team: null,
    assignee: null,
    symptom: r.symptom,
    rootCause: `${r.code} ${r.name}`,
    action: '',
    spares: r.spare ? [{ code: r.spare[0], name: r.spare[1], bin: r.spare[2], stock: r.spare[3], qty: 1 }] : [],
    createdAt: w.t,
    stageAt: w.t,
    closedAt: null,
    history: [{ t: w.t, stage: 'unassigned', by: 'Machine signal', note: `Stopped (OPC) · ${r.symptom.toLowerCase()}` }],
    photos: 0,
    hold,
    plan: {
      assign: range(w.rng, 90, 420),
      arrive: range(w.rng, 120, 400),
      work: range(w.rng, 480, 1500),
      spare: w.rng() < 0.28 ? range(w.rng, 300, 800) : 0,
      verify: range(w.rng, 120, 280),
    },
  };
  (tk as Ticket & { _team: TeamId })._team = r.team;
  w.tickets.unshift(tk);
  w.ticket[id] = tk;
  if (w.tickets.length > 400) {
    const old = w.tickets.pop()!;
    delete w.ticket[old.id];
  }
  return tk;
}

const teamOfTicket = (tk: Ticket): TeamId => tk.team ?? (tk as Ticket & { _team?: TeamId })._team ?? 'maintenance';

export function goDown(w: World, m: Machine, reasonCode: string | null = null, hold = false) {
  if (m.state === 'DOWN') return w.ticket[m.ticketId ?? ''];
  if (m.ticketId) closeTicket(w, w.ticket[m.ticketId], 'System', true);
  const tk = createTicket(w, m, reasonCode, hold);
  m.ticketId = tk.id;
  m.team = null;
  m.reasonLogged = false;
  m.hold = hold;
  setState(w, m, 'DOWN', tk.symptom, { stage: 'unassigned', team: null, ticketId: tk.id });
  return tk;
}

export function setStage(w: World, tk: Ticket, stage: Stage, by: string, note = '', team?: TeamId) {
  const m = w.machine[tk.machineId];
  if (team) tk.team = team;
  if (stage === 'assigned' && !tk.team) tk.team = teamOfTicket(tk);
  tk.stage = stage;
  tk.stageAt = w.t;
  tk.history.push({ t: w.t, stage, by, note });
  if ((stage === 'working' || stage === 'assigned') && !tk.assignee) tk.assignee = TECHS[tk.team ?? 'maintenance'][0];
  if (stage === 'verify') {
    // machine signal restarts before production verifies
    if (m.state === 'DOWN') {
      m.team = tk.team;
      m.reasonLogged = true;
      setState(w, m, 'RUN', '', { stage: 'verify', ticketId: tk.id, team: tk.team });
      resolveAlertsFor(w, m.id, 'Machine stopped', `Machine running again · ${TEAMS[tk.team ?? 'maintenance'].label} submitted fix`);
    }
    return;
  }
  if (stage === 'closed') {
    tk.closedAt = w.t;
    if (m.ticketId === tk.id) {
      m.ticketId = null;
      m.team = null;
      m.hold = false;
      if (m.state === 'DOWN') setState(w, m, 'RUN');
      else pushSeg(m, w.t, 'RUN');
    }
    return;
  }
  if (m.state === 'DOWN' && m.ticketId === tk.id) {
    m.team = tk.team;
    if (stage !== 'unassigned') m.reasonLogged = true;
    pushSeg(m, w.t, 'DOWN', { stage, team: tk.team, ticketId: tk.id, reason: m.reason });
  }
}

export function closeTicket(w: World, tk: Ticket | undefined, by: string, silent = false) {
  if (!tk || tk.stage === 'closed') return;
  if (!tk.action) tk.action = 'Repaired and tested';
  setStage(w, tk, 'closed', by, silent ? 'Auto-closed' : 'Accepted & closed');
}

function progressTicket(w: World, _m: Machine, tk: Ticket) {
  if (tk.hold || tk.stage === 'closed') return;
  const age = w.t - tk.stageAt;
  const p = tk.plan;
  switch (tk.stage) {
    case 'unassigned':
      if (age > p.assign) setStage(w, tk, 'assigned', 'Supervisor', 'Assigned from PWA', teamOfTicket(tk));
      break;
    case 'assigned':
      if (age > p.arrive) setStage(w, tk, 'working', tk.assignee ?? 'Technician', "I'm on it");
      break;
    case 'working':
      if (p.spare > 0 && age > p.work * 0.4) {
        p.spare = -p.spare;
        setStage(w, tk, 'spare', tk.assignee ?? 'Technician', `Spare requested · ${tk.spares[0]?.name ?? 'part'}`);
      } else if (age > p.work) {
        tk.action = tk.action || 'Replaced and tested';
        setStage(w, tk, 'verify', tk.assignee ?? 'Technician', 'Submitted for verification');
      }
      break;
    case 'spare':
      if (age > -p.spare) setStage(w, tk, 'working', 'Stores', 'Spare issued · ready for pickup');
      break;
    case 'verify':
      if (age > p.verify) closeTicket(w, tk, 'Supervisor');
      break;
  }
}

// ---------- state changes ----------
export function goIdle(w: World, m: Machine, reason?: string, minutes?: number) {
  const r = reason ? IDLE_REASONS.find((x) => x.name === reason) ?? { name: reason, team: 'production' as TeamId } : pick(w.rng, IDLE_REASONS);
  m.nextAt = w.t + (minutes ? minutes * 60 : range(w.rng, 180, 720));
  m.team = r.team;
  m.reasonLogged = w.rng() < 0.7;
  setState(w, m, 'IDLE', r.name, { team: r.team });
}

export function goRun(w: World, m: Machine) {
  m.team = null;
  m.reason = '';
  setState(w, m, 'RUN');
}

export function goMC(w: World, m: Machine, toMouldId?: string, minutes?: number) {
  const cur = w.mould[m.mouldId];
  let next = toMouldId ? w.mould[toMouldId] : undefined;
  if (!next) {
    const cands = w.moulds.filter((x) => x.status === 'storage' && x.tonnage <= m.tonnage);
    next = cands.length ? pick(w.rng, cands) : undefined;
  }
  if (!next) {
    m.nextMCAt = w.t + 6 * 3600;
    return;
  }
  next.status = 'production';
  next.location = m.id;
  m.nextMouldId = next.id;
  const std = next.stdChangeMin;
  m.nextAt = w.t + (minutes ? minutes * 60 : std * 60 * range(w.rng, 0.85, 1.55));
  m.team = 'mouldchange';
  m.reasonLogged = true;
  setState(w, m, 'MC', `${cur?.id ?? ''} → ${next.id}`, { team: 'mouldchange' });
}

function finishMC(w: World, m: Machine) {
  const old = w.mould[m.mouldId];
  if (old) {
    old.status = 'storage';
    old.location = `Rack R-${String(irange(w.rng, 1, 24)).padStart(2, '0')}`;
  }
  if (m.nextMouldId) m.mouldId = m.nextMouldId;
  m.nextMouldId = null;
  m.mcDone += 1;
  m.wo = `WO-${++w.seq.wo}`;
  m.woQty = Math.round(irange(w.rng, 6, 24)) * 1000;
  m.nextMCAt = w.t + range(w.rng, 5, 16) * 3600;
  m.cycleFactor = 1 + (1 - w.unit[m.unitId].health) * 0.08 + Math.abs(w.rng() - 0.5) * 0.025 + (w.rng() < 0.12 ? 0.05 : 0);
  m.set = mkSet(w, m);
  goRun(w, m);
}

export function mkSet(w: World, m: Machine) {
  const md = w.mould[m.mouldId];
  const base = md ? 210 + (md.stdCycle % 7) * 3 : 220;
  return {
    z1: base,
    z2: base + 5,
    z3: base + 10,
    z4: base + 10,
    z5: base + 15,
    nozzle: base + 15,
    mouldTemp: 40 + (m.tonnage % 9),
    injP: 900 + m.tonnage * 0.7,
    holdP: 480 + m.tonnage * 0.35,
    injSpeed: 85,
    cushion: 7,
    cooling: Math.round((md?.stdCycle ?? 30) * 0.48),
    clamp: m.tonnage * 9.4,
  };
}

// ---------- per tick ----------
function stepMachine(w: World, m: Machine, dt: number) {
  const u = w.unit[m.unitId];
  const h = hourIdx(w.t);
  const md = w.mould[m.mouldId];
  const std = md?.stdCycle ?? 30;
  const cavT = md?.positions.length ?? 1;
  if (m.state !== 'OFF') {
    m.plannedSec += dt;
    m.capParts += (dt / std) * cavT;
  }
  const kwFactor = m.state === 'RUN' ? 0.62 : m.state === 'IDLE' ? 0.34 : m.state === 'MC' ? 0.22 : m.state === 'DOWN' ? 0.14 : 0.02;
  m.kw = m.ratedKw * kwFactor * (0.94 + w.rng() * 0.12);
  const e = (m.kw * dt) / 3600;
  m.kwh += e;
  if (m.state !== 'RUN') m.kwhIdle += e;
  // decays
  if (m.rejSpike > 0 && !m.hero) m.rejSpike = Math.max(0, m.rejSpike - dt * 0.000004);

  switch (m.state) {
    case 'RUN': {
      m.runSec += dt;
      m.runStdParts += (dt / std) * cavT;
      const ct = std * m.cycleFactor;
      const shots = dt / ct;
      const cav = activeCav(w, m);
      const parts = shots * cav;
      const rej = Math.min(0.3, m.rejBase + m.rejSpike);
      m.shots += shots;
      m.stdShotSec += shots * std;
      m.parts += parts;
      m.bad += parts * rej;
      m.hourly[h] += parts;
      m.hourlyBad[h] += parts * rej;
      if (md) {
        md.shotsSincePM += shots;
        md.lifetime += shots;
      }
      const before = Math.floor(m.shotCounter);
      m.shotCounter += shots;
      const n = Math.min(4, Math.floor(m.shotCounter) - before);
      if (!w.warm || w.t > START_T - 3 * 3600) {
        for (let i = 0; i < n; i++) {
          m.cycleHist.push(+(ct * (1 + (w.rng() - 0.5) * 0.018)).toFixed(2));
          if (m.cycleHist.length > 120) m.cycleHist.shift();
          const p = w.part[md?.positions[0].partId ?? ''];
          const nominal = p?.weight ?? 200;
          const tol = p?.tol ?? 1.5;
          const drift = m.hot ? tol * 0.35 : 0;
          const wgt = nominal + drift + (w.rng() + w.rng() + w.rng() - 1.5) * tol * 0.45 + (w.rng() < rej * 0.6 ? (w.rng() < 0.5 ? -1 : 1) * tol * 1.6 : 0);
          m.weightHist.push(+wgt.toFixed(1));
          if (m.weightHist.length > 200) m.weightHist.shift();
        }
      }
      // random transitions
      if (!(m.hero && w.t > 4.5 * 3600 && w.t < START_T + 600)) {
        const downRate = (1 / (2.6 * 3600)) * (1.75 - u.health);
        const idleRate = (1 / (1.6 * 3600)) * (1.6 - u.health);
        if (w.rng() < dt * downRate) goDown(w, m);
        else if (w.rng() < dt * idleRate) goIdle(w, m);
        else if (w.t >= m.nextMCAt && w.t - shiftStartOf(w.t) < SHIFT_LEN - 1800) goMC(w, m);
      }
      break;
    }
    case 'IDLE':
      m.idleSec += dt;
      if (w.t >= m.nextAt) goRun(w, m);
      break;
    case 'MC':
      m.mcSec += dt;
      if (w.t >= m.nextAt) finishMC(w, m);
      break;
    case 'DOWN': {
      m.downSec += dt;
      const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
      if (tk) progressTicket(w, m, tk);
      else goRun(w, m);
      break;
    }
    case 'OFF':
      break;
  }
  // verify-stage tickets progress while machine runs
  if (m.state === 'RUN' && m.ticketId) {
    const tk = w.ticket[m.ticketId];
    if (tk) progressTicket(w, m, tk);
  }

  // live process parameters (noise + drift)
  const s = m.set;
  const a = m.act;
  const run = m.state === 'RUN';
  const jitter = (v: number, k: number) => v + (w.rng() - 0.5) * k;
  a.z1 = jitter(s.z1, 2);
  a.z2 = jitter(s.z2, 2);
  a.z3 = m.hero && m.state === 'DOWN' && m.reason.toLowerCase().includes('heater') ? Math.max(120, a.z3 - dt * 0.4) : jitter(s.z3, 2);
  a.z4 = m.hot ? jitter(s.z4 + 8, 1.5) : jitter(s.z4, 2);
  a.z5 = jitter(s.z5, 2);
  a.nozzle = jitter(s.nozzle, 2);
  a.mouldTemp = jitter(s.mouldTemp, 1.2);
  a.injP = run ? jitter(s.injP + (m.cycleFactor - 1) * 300, 24) : 0;
  a.holdP = run ? jitter(s.holdP, 14) : 0;
  a.injSpeed = run ? jitter(s.injSpeed, 3) : 0;
  a.cushion = run ? jitter(s.cushion - (m.rejSpike > 0.01 ? 1.4 : 0), 0.5) : 0;
  a.cooling = jitter(s.cooling * (m.cycleFactor > 1.05 ? 1.04 : 1), 0.2);
  a.clamp = run ? jitter(s.clamp, 40) : 0;

  // extend open segment
  const last = m.timeline[m.timeline.length - 1];
  if (last) last.end = w.t;

  // ---- alert rules ----
  if (!w.warm || w.t > START_T - 2400) checkAlerts(w, m, u);
}

function checkAlerts(w: World, m: Machine, u: Unit) {
  const key = (k: string) => `${m.id}:${k}:${m.since}`;
  if (m.state === 'DOWN' && w.t - m.since > 900 && !w.alerted.has(key('down15'))) {
    w.alerted.add(key('down15'));
    const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
    addAlert(w, {
      type: 'Machine stopped',
      severity: 'critical',
      title: `${m.code} stopped 15 min · ${m.reasonLogged ? m.reason.toLowerCase() : 'no reason logged'}`,
      unitId: u.id,
      machineId: m.id,
      notified: `Supervisor (app, SMS) · ${tk?.team ? TEAMS[tk.team].label : 'Maintenance'} (app) · Unit head (escalation at 30 min)`,
      first: `Machine stopped · OPC status = fault at ${clock(m.since)}`,
    });
  }
  if (m.state === 'DOWN' && w.t - m.since > 1800 && !w.alerted.has(key('down30'))) {
    w.alerted.add(key('down30'));
    for (const a of w.alerts)
      if (a.machineId === m.id && a.type === 'Machine stopped' && a.status !== 'resolved') {
        a.escalated = true;
        a.timeline.push({ t: w.t, tone: 'down', msg: `Escalated to unit head ${u.head} after 30 min` });
      }
  }
  if (m.state === 'RUN') resolveAlertsFor(w, m.id, 'Machine stopped', 'Machine running again');
  const cf = `${m.id}:cycle:${m.mouldId}`;
  if (m.state === 'RUN' && m.cycleFactor > 1.05 && !w.alerted.has(cf)) {
    w.alerted.add(cf);
    const std = stdOf(w, m);
    addAlert(w, {
      type: 'Cycle time drift',
      severity: 'warning',
      title: `Cycle time ${(std * m.cycleFactor).toFixed(1)} s, +${((m.cycleFactor - 1) * 100).toFixed(0)}% over standard ${std.toFixed(1)} s`,
      unitId: u.id,
      machineId: m.id,
      notified: 'Supervisor, Process engineer (app)',
      first: 'Average of last 20 shots above +5% of standard',
    });
  }
  const rk = `${m.id}:rej:${Math.floor(w.t / 3600)}`;
  if (m.state === 'RUN' && m.rejBase + m.rejSpike > 0.045 && !w.alerted.has(`${m.id}:rejany`) && !w.alerted.has(rk)) {
    w.alerted.add(rk);
    w.alerted.add(`${m.id}:rejany`);
    addAlert(w, {
      type: 'Reject rate',
      severity: 'critical',
      title: `Reject rate ${((m.rejBase + m.rejSpike) * 100).toFixed(1)}% in last hour (limit 3%)`,
      unitId: u.id,
      machineId: m.id,
      notified: 'Quality, Supervisor (app, email)',
      first: 'Last 60 min reject rate above 3.0%',
    });
  }
  const md = w.mould[m.mouldId];
  if (md && md.pmInterval - md.shotsSincePM < 5000 && !w.alerted.has(`${md.id}:pm`)) {
    w.alerted.add(`${md.id}:pm`);
    addAlert(w, {
      type: 'Mould maintenance',
      severity: 'info',
      title: `Mould ${md.id} maintenance due in ${fmt(Math.max(0, md.pmInterval - md.shotsSincePM))} shots`,
      unitId: u.id,
      machineId: m.id,
      notified: 'Tool room (app, email)',
      first: 'Remaining shots ≤ 5,000',
      tone: 'mould',
    });
  }
  if (m.hot && !w.alerted.has(`${m.id}:hot`)) {
    w.alerted.add(`${m.id}:hot`);
    addAlert(w, {
      type: 'Process param',
      severity: 'warning',
      title: `Barrel zone 4 at ${Math.round(m.set.z4 + 8)} °C, above ${Math.round(m.set.z4 + 5)} °C limit`,
      unitId: u.id,
      machineId: m.id,
      notified: 'Process engineer (app)',
      first: 'Outside limit for 10 shots',
    });
  }
}

// ---------- trucks ----------
const PLATE_ST: Record<string, string[]> = {
  HR: ['55', '38', '26', '29'],
  TN: ['01', '09', '22', '70'],
  MH: ['12', '14', '04', '43'],
  WB: ['02', '19', '41'],
  JH: ['05', '01'],
  UK: ['06', '04'],
  DL: ['1M', '1L', '3C'],
  RJ: ['14', '27'],
  KA: ['01', '51'],
};
export function plate(r: Rng, st: string) {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const s = st in PLATE_ST ? st : 'HR';
  const two = L[Math.floor(r() * L.length)] + L[Math.floor(r() * L.length)];
  return `${s} ${pick(r, PLATE_ST[s])} ${r() < 0.2 ? two[0] : two} ${irange(r, 1000, 9999)}`;
}

function stepTrucks(w: World, dt: number) {
  for (const k of w.trucks) {
    if (k.phase === 3) continue;
    if (k.delayed) continue;
    if (w.t >= k.phaseAt) {
      const r = w.rng;
      if (k.phase === 0) {
        k.phase = 1;
        k.status = k.dir === 'OUT' ? `Loading · dock ${irange(r, 1, 4)}` : `Unloading · dock ${irange(r, 1, 3)}`;
        k.phaseAt = w.t + range(r, 600, 1500);
      } else if (k.phase === 1) {
        k.phase = 2;
        k.status = k.dir === 'OUT' ? 'Invoice pending' : 'GRN pending';
        k.phaseAt = w.t + range(r, 240, 900);
      } else if (k.phase === 2) {
        k.phase = 3;
        k.out = w.t;
        k.status = 'Left';
      }
    }
    const waited = w.t - k.gateIn;
    if (k.phase < 3 && waited > 3600 && !w.alerted.has(`${k.id}:60`)) {
      w.alerted.add(`${k.id}:60`);
      if (!w.warm)
        addAlert(w, {
          type: 'Truck waiting',
          severity: 'warning',
          title: `Truck ${k.plate} waiting ${Math.round(waited / 60)} min · ${k.status.toLowerCase()}`,
          unitId: k.unitId,
          notified: 'Dispatch, Unit head (app)',
          first: 'Waiting beyond 60 min red limit',
        });
    }
  }
  // arrivals
  for (const u of w.units) {
    const rate = (u.id === w.heroUnitId ? 1 / 1500 : 1 / 3000) * dt;
    if (w.rng() < rate) newTruck(w, u);
  }
  // trim
  const left = w.trucks.filter((k) => k.phase === 3);
  if (left.length > 140) {
    const drop = new Set(left.slice(0, left.length - 140).map((k) => k.id));
    w.trucks = w.trucks.filter((k) => !drop.has(k.id));
  }
}

export function newTruck(w: World, u: Unit, opts: Partial<Truck> = {}) {
  const r = w.rng;
  const out = r() < 0.65;
  const cust = pick(r, ['Orion Motors', 'Nova Appliances', 'Kestrel Two-Wheelers']);
  const sup = pick(r, ['Reliance Polymers (PP)', 'Haldia Petrochemicals', 'GAIL (HDPE)', 'Supreme Petrochem (GPPS)']);
  const stCode: Record<string, string> = { TN: 'TN', MH: 'MH', HR: 'HR', UK: 'UK', WB: 'WB', JH: 'JH' };
  const k: Truck = {
    id: `TR-${++w.seq.truck}`,
    unitId: u.id,
    plate: plate(r, r() < 0.75 ? stCode[u.state] ?? 'HR' : pick(r, ['DL', 'RJ', 'KA', 'MH'])),
    transporter: pick(r, ['VRL Logistics', 'Safexpress', 'Om Logistics', 'TCI Freight', 'Gati', 'Delhivery', 'Rivigo']),
    dir: out ? 'OUT' : 'IN',
    party: out ? `${cust}, ${u.city}` : sup,
    partyShort: out ? cust.split(' ')[0] : sup.split(' ')[0],
    doc: out ? `INV ${2610}-${irange(r, 400, 999)}` : `DC ${irange(r, 1000, 99999)}`,
    gateIn: w.t,
    status: out ? 'Waiting for loading' : 'Waiting to unload',
    phase: 0,
    phaseAt: w.t + range(r, 300, 2400),
    dueOut: 0,
    out: null,
    ...opts,
  };
  w.trucks.push(k);
  return k;
}

// ---------- shift rollover ----------
function closeShift(w: World, endT: number) {
  for (const u of w.units) {
    const ms = u.machineIds.map((id) => w.machine[id]);
    let planned = 0,
      good = 0,
      parts = 0,
      bad = 0,
      run = 0,
      plannedSec = 0,
      stdShots = 0;
    for (const m of ms) {
      const std = stdOf(w, m);
      planned += m.capParts * PLAN_FACTOR;
      parts += m.parts;
      bad += m.bad;
      good += m.parts - m.bad;
      run += m.runSec;
      plannedSec += m.plannedSec;
      stdShots += m.stdShotSec;
      void std;
    }
    const A = plannedSec ? run / plannedSec : 0;
    const P = run ? Math.min(1, stdShots / run) : 0;
    const Q = parts ? good / parts : 0;
    const label = `Shift ${shiftOf(endT - 1)} · ${clock(endT - 1).slice(0, 2) < '06' ? 'last night' : 'today'}`;
    const arr = w.prevShifts[u.id] ?? [];
    arr.unshift({ label, out: Math.round(good), plan: Math.round(planned), oee: A * P * Q * 100, rej: parts ? (bad / parts) * 100 : 0 });
    w.prevShifts[u.id] = arr.slice(0, 6);
  }
  for (const m of w.machines) {
    m.plannedSec = m.runSec = m.idleSec = m.downSec = m.mcSec = 0;
    m.capParts = m.runStdParts = m.stdShotSec = 0;
    m.shots = m.parts = m.bad = 0;
    m.kwh = m.kwhIdle = 0;
    m.mcDone = 0;
    m.hourly = new Array(8).fill(0);
    m.hourlyBad = new Array(8).fill(0);
    const last = m.timeline[m.timeline.length - 1];
    m.timeline = [{ ...(last ?? { s: m.state }), start: endT, end: endT }];
  }
  w.shiftsCompleted += 1;
  toast(w, { tone: 'info', title: `Shift ${shiftOf(endT)} started`, body: `${SHIFT_WINDOW(shiftOf(endT))} · handover summary saved` });
}
const SHIFT_WINDOW = (s: 'A' | 'B' | 'C') => ({ A: '06:00–14:00', B: '14:00–22:00', C: '22:00–06:00' })[s];

export function step(w: World, dt: number) {
  const prevShiftStart = shiftStartOf(w.t);
  let nt = w.t + dt;
  if (nt >= DAY) {
    // finish day: close shift C at 06:00
    w.t = DAY;
    for (const m of w.machines) stepMachine(w, m, DAY - (nt - dt));
    closeShift(w, DAY);
    nt -= DAY;
    w.t = 0;
    w.day += 1;
    for (const m of w.machines) for (const s of m.timeline) (s.start = 0), (s.end = 0);
    for (const k of w.trucks) k.gateIn -= DAY;
    for (const tk of w.tickets) (tk.stageAt -= DAY), (tk.createdAt -= DAY);
    for (const m of w.machines) (m.since -= DAY), (m.nextAt -= DAY), (m.nextMCAt -= DAY);
    for (const a of w.alerts) a.t -= DAY;
    for (const o of w.orders) o.due = (o.due - DAY + DAY) % DAY;
    w.t = nt;
    return;
  }
  const boundary = shiftStartOf(nt);
  if (boundary !== prevShiftStart) {
    // advance to boundary, close, then continue
    const d1 = boundary - w.t;
    w.t = boundary;
    for (const m of w.machines) stepMachine(w, m, d1);
    closeShift(w, boundary);
    dt -= d1;
  }
  w.t += dt;
  for (const m of w.machines) stepMachine(w, m, dt);
  stepTrucks(w, dt);
  for (const ev of w.script) {
    if (!ev.done && w.t >= ev.at) {
      ev.done = true;
      ev.run(w);
    }
  }
  // power history per unit (sampled ~ every 30 sim s)
  if (Math.floor(w.t / 30) !== Math.floor((w.t - dt) / 30)) {
    for (const u of w.units) {
      const arr = (w.powerHist[u.id] ??= []);
      let kw = 0;
      for (const id of u.machineIds) kw += w.machine[id].kw;
      arr.push(kw);
      if (arr.length > 240) arr.shift();
    }
  }
}

export const describeStop = (w: World, m: Machine) => {
  const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
  if (m.state === 'DOWN') {
    const st = tk?.stage ?? 'unassigned';
    const team = tk?.team ? TEAMS[tk.team].label : '';
    const base = m.reasonLogged ? m.reason : 'No reason logged';
    return { base, stage: st, team, text: `${base} · ${dur(w.t - m.since)}` };
  }
  return { base: m.reason, stage: undefined, team: '', text: m.reason ? `${m.reason} · ${dur(w.t - m.since)}` : '' };
};
