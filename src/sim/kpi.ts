import { PLAN_FACTOR, activeCav, stdOf, totalCav, type World } from './engine';
import { SHIFT_LEN, TEAMS, shiftStartOf } from './catalog';
import type { Machine, TeamId, Unit } from './types';

export type ValueBasis = 'cm' | 'sp';

export interface Agg {
  machines: number;
  run: number;
  idle: number;
  mc: number;
  down: number;
  off: number;
  planParts: number; // PPC plan to now
  capParts: number; // capacity at standard to now
  shiftPlan: number; // full shift plan
  parts: number;
  good: number;
  bad: number;
  plannedSec: number;
  runSec: number;
  idleSec: number;
  downSec: number;
  mcSec: number;
  stdShotSec: number;
  kwh: number;
  kwhIdle: number;
  kw: number;
  overCycle: number; // machines > +5%
  mcDone: number;
}

export const emptyAgg = (): Agg => ({
  machines: 0,
  run: 0,
  idle: 0,
  mc: 0,
  down: 0,
  off: 0,
  planParts: 0,
  capParts: 0,
  shiftPlan: 0,
  parts: 0,
  good: 0,
  bad: 0,
  plannedSec: 0,
  runSec: 0,
  idleSec: 0,
  downSec: 0,
  mcSec: 0,
  stdShotSec: 0,
  kwh: 0,
  kwhIdle: 0,
  kw: 0,
  overCycle: 0,
  mcDone: 0,
});

export function aggMachines(w: World, ms: Machine[]): Agg {
  const a = emptyAgg();
  for (const m of ms) {
    const std = stdOf(w, m);
    const cav = totalCav(w, m);
    a.machines++;
    if (m.state === 'RUN') a.run++;
    else if (m.state === 'IDLE') a.idle++;
    else if (m.state === 'MC') a.mc++;
    else if (m.state === 'DOWN') a.down++;
    else a.off++;
    a.capParts += m.capParts;
    a.planParts += m.capParts * PLAN_FACTOR;
    if (m.state !== 'OFF') a.shiftPlan += (SHIFT_LEN / std) * cav * PLAN_FACTOR;
    a.parts += m.parts;
    a.bad += m.bad;
    a.good += m.parts - m.bad;
    a.plannedSec += m.plannedSec;
    a.runSec += m.runSec;
    a.idleSec += m.idleSec;
    a.downSec += m.downSec;
    a.mcSec += m.mcSec;
    a.stdShotSec += m.stdShotSec;
    a.kwh += m.kwh;
    a.kwhIdle += m.kwhIdle;
    a.kw += m.kw;
    if (m.state === 'RUN' && m.cycleFactor > 1.05) a.overCycle++;
    a.mcDone += m.mcDone;
  }
  return a;
}

export const machinesOfUnit = (w: World, u: Unit) => u.machineIds.map((id) => w.machine[id]);
export const machinesOfOrg = (w: World, orgId: string) => w.org[orgId].unitIds.flatMap((uid) => machinesOfUnit(w, w.unit[uid]));
export const aggUnit = (w: World, unitId: string) => aggMachines(w, machinesOfUnit(w, w.unit[unitId]));
export const aggOrg = (w: World, orgId: string) => aggMachines(w, machinesOfOrg(w, orgId));
export const aggAll = (w: World) => aggMachines(w, w.machines);

export function derive(a: Agg) {
  const A = a.plannedSec ? a.runSec / a.plannedSec : 0;
  const P = a.runSec ? Math.min(1, a.stdShotSec / a.runSec) : 0;
  const Q = a.parts ? a.good / a.parts : 1;
  const oee = A * P * Q * 100;
  const plan = a.planParts ? (a.good / a.planParts) * 100 : 0;
  const rej = a.parts ? (a.bad / a.parts) * 100 : 0;
  const cycleDev = a.stdShotSec ? (a.runSec / a.stdShotSec - 1) * 100 : 0;
  return { A: A * 100, P: P * 100, Q: Q * 100, oee, plan, rej, cycleDev, kwhPerPart: a.good ? a.kwh / a.good : 0 };
}

/** Needed run rate to close the shift plan */
export function requiredRate(w: World, a: Agg) {
  const rem = shiftStartOf(w.t) + SHIFT_LEN - w.t;
  if (rem <= 0) return 0;
  return Math.max(0, (a.shiftPlan - a.good) / (rem / 3600));
}

export const shiftRemaining = (w: World) => shiftStartOf(w.t) + SHIFT_LEN - w.t;
export const shiftElapsed = (w: World) => w.t - shiftStartOf(w.t);

export function hourly(w: World, ms: Machine[]) {
  const out = new Array(8).fill(0);
  const bad = new Array(8).fill(0);
  let planH = 0;
  for (const m of ms) {
    for (let i = 0; i < 8; i++) {
      out[i] += m.hourly[i] - m.hourlyBad[i];
      bad[i] += m.hourlyBad[i];
    }
    if (m.state !== 'OFF') planH += (3600 / stdOf(w, m)) * totalCav(w, m) * PLAN_FACTOR;
  }
  return { out, bad, planH };
}

// ---------- money ----------
export function valuePerPart(w: World, m: Machine, basis: ValueBasis) {
  const md = w.mould[m.mouldId];
  const p = w.part[md?.positions[0].partId ?? ''];
  if (!p) return 40;
  return basis === 'cm' ? p.sell - p.material$ - p.conv : p.sell;
}
export const TARIFF = 8.6; // ₹ / kWh

export interface Money {
  capValue: number;
  planValue: number;
  downtime: number;
  idle: number;
  mouldChange: number;
  speed: number;
  rejects: number;
  actual: number;
  scrap: number;
  energy: number;
  lost: number; // incl cash costs
  byOwner: Record<string, number>;
}

export function moneyOf(w: World, ms: Machine[], basis: ValueBasis): Money {
  const r: Money = { capValue: 0, planValue: 0, downtime: 0, idle: 0, mouldChange: 0, speed: 0, rejects: 0, actual: 0, scrap: 0, energy: 0, lost: 0, byOwner: {} };
  const own = (k: string, v: number) => (r.byOwner[k] = (r.byOwner[k] ?? 0) + v);
  for (const m of ms) {
    if (m.plannedSec === 0) continue;
    const v = valuePerPart(w, m, basis);
    const p = w.part[w.mould[m.mouldId]?.positions[0].partId ?? ''];
    r.capValue += m.capParts * v;
    r.planValue += m.capParts * v * PLAN_FACTOR;
    // stopped value (capacity lost while not running) split across timeline segments by owner
    const stoppedVal = Math.max(0, m.capParts - m.runStdParts) * v;
    let stoppedSec = 0;
    for (const s of m.timeline) if (s.s !== 'RUN' && s.s !== 'OFF') stoppedSec += Math.max(0, s.end - s.start);
    if (stoppedSec > 0) {
      for (const s of m.timeline) {
        const d = Math.max(0, s.end - s.start);
        if (!d || s.s === 'RUN' || s.s === 'OFF') continue;
        const val = (d / stoppedSec) * stoppedVal;
        if (s.s === 'DOWN') {
          r.downtime += val;
          own(s.team && s.stage !== 'unassigned' ? s.team : 'unassigned', val);
        } else if (s.s === 'IDLE') {
          r.idle += val;
          own((s.team as string) ?? 'production', val);
        } else {
          r.mouldChange += val;
          own('mouldchange', val);
        }
      }
    } else if (stoppedVal > 0) {
      r.downtime += stoppedVal;
      own('unassigned', stoppedVal);
    }
    const speed = Math.max(0, m.runStdParts - m.parts) * v;
    r.speed += speed;
    own('speed', speed);
    r.rejects += m.bad * v;
    own('quality', m.bad * v);
    r.actual += (m.parts - m.bad) * v;
    r.scrap += m.bad * (p?.material$ ?? 20) * 0.7; // regrind recovers ~30%
    r.energy += m.kwhIdle * TARIFF;
  }
  // parts can exceed std-rate parts by rounding; keep the waterfall closed
  const residual = r.capValue - (r.downtime + r.idle + r.mouldChange + r.speed + r.rejects + r.actual);
  r.speed += residual;
  r.lost = r.capValue - r.actual + r.scrap + r.energy;
  return r;
}

export const OWNER_META: Record<string, { label: string; color: string }> = {
  maintenance: { label: 'Maintenance', color: TEAMS.maintenance.color },
  quality: { label: 'Quality / rejects', color: TEAMS.quality.color },
  toolroom: { label: 'Tool room', color: TEAMS.toolroom.color },
  unassigned: { label: 'Not assigned', color: '#D8382B' },
  store: { label: 'Material store', color: TEAMS.store.color },
  speed: { label: 'Process / speed', color: '#E5B000' },
  utilities: { label: 'Utilities', color: TEAMS.utilities.color },
  mouldchange: { label: 'Mould change', color: TEAMS.mouldchange.color },
  production: { label: 'Production · no operator', color: '#9AA0A8' },
  planning: { label: 'Planning · no job', color: TEAMS.planning.color },
};

// ---------- downtime pareto ----------
export function downtimeByReason(_w: World, ms: Machine[]) {
  const map = new Map<string, { label: string; team: TeamId | 'unassigned'; sec: number }>();
  let noReason = 0;
  for (const m of ms) {
    for (const s of m.timeline) {
      if (s.s !== 'DOWN' && s.s !== 'IDLE' && s.s !== 'MC') continue;
      const d = s.end - s.start;
      if (d < 60) continue;
      let label = s.reason || 'No reason logged';
      let team: TeamId | 'unassigned' = (s.team as TeamId) ?? 'unassigned';
      if (s.s === 'DOWN' && (s.stage === 'unassigned' || !s.team)) {
        label = 'Not assigned / no reason';
        team = 'unassigned';
      }
      if (s.s === 'MC') {
        label = 'Mould change';
        team = 'mouldchange';
      }
      if (label === 'Not assigned / no reason') noReason++;
      const cur = map.get(label) ?? { label, team, sec: 0 };
      cur.sec += d;
      map.set(label, cur);
    }
  }
  const list = [...map.values()].sort((a, b) => b.sec - a.sec);
  return { list, total: list.reduce((a, b) => a + b.sec, 0), noReason };
}

/** Availability per machine this shift */
export function availability(m: Machine) {
  return m.plannedSec ? (m.runSec / m.plannedSec) * 100 : 0;
}
export function machineKpis(w: World, m: Machine) {
  const a = derive(aggMachines(w, [m]));
  const std = stdOf(w, m);
  const ct = std * m.cycleFactor;
  const target = m.capParts * PLAN_FACTOR;
  return { ...a, std, ct, target, good: m.parts - m.bad, cav: activeCav(w, m), cavTotal: totalCav(w, m) };
}

// ---------- dispatch at risk ----------
export function orderRisk(w: World, o: World['orders'][0]) {
  const remSec = Math.max(0, o.due - w.t);
  let rate = 0;
  for (const id of o.machineIds) {
    const m = w.machine[id];
    if (m.state === 'RUN') rate += (activeCav(w, m) / (stdOf(w, m) * m.cycleFactor)) * (1 - m.rejBase - m.rejSpike) * 0.86;
  }
  const projected = o.stock + rate * remSec;
  const short = Math.max(0, o.qty - projected);
  const p = w.part[o.partId];
  return { projected, short, value: short * (p?.sell ?? 100), part: p };
}
