/**
 * Shopfloor TV · UI (United Industries) — data layer.
 * Turns the live simulator into the page models of the UI "Shopfloor TV v3" design.
 * Size rules from the design: key numbers ≥ 60 px, cell numbers ≥ 44 px, labels ≥ 24 px;
 * colour is never the only signal (every cell carries a number or a word). No part counts, no ₹.
 */
import type { World } from '../../sim/engine';
import { activeCav, partOf, stdOf } from '../../sim/engine';
import { aggMachines, availability, derive, downtimeByReason } from '../../sim/kpi';
import { SHIFT_LEN, shiftStartOf } from '../../sim/catalog';
import type { Machine, Segment, Stage, TeamId, Truck } from '../../sim/types';

/* ---------------- design tokens (verbatim from the UI v3 file) ---------------- */

export type Theme = ReturnType<typeof theme>;
export const theme = (dark: boolean) =>
  dark
    ? { dark, bg: '#0B0D10', panel: '#121519', panel2: '#1A1D22', line: '#22262C', tx: '#FFFFFF', mu: '#A3A9B1', hd: '#0B0D10', truck: '#15181C', g: '#34C77B', a: '#FFC233', r: '#FF6A5A', slot: '#16191D', runBg: '#123322', runFg: '#FFFFFF', offBg: '#1E2227', badBg: '#3A1612', warnBg: '#33290D', chipBg: '#1E2227' }
    : { dark, bg: '#F3F2EE', panel: '#FFFFFF', panel2: '#F6F5F1', line: '#E3E1DB', tx: '#15171A', mu: '#4A4F57', hd: '#15171A', truck: '#FFFFFF', g: '#14713E', a: '#8A6700', r: '#B02A1F', slot: '#F6F5F1', runBg: '#E3F4EA', runFg: '#15171A', offBg: '#ECEAE4', badBg: '#FBE3E0', warnBg: '#FFF4D6', chipBg: '#ECEAE4' };

export const FG = '#34C77B';
export const FA = '#FFC233';
export const FR = '#FF6A5A';
export const ORANGE = '#F26A21';
export const YELLOW = '#FFE14D';
export const MC_PURPLE = '#A855F7';
export const COND = "'Barlow Condensed', 'Barlow', sans-serif";
export const BAR = "'Barlow', sans-serif";

export const band = (v: number, T: number) => (v >= T ? 'g' : v >= T - 15 ? 'a' : 'r') as 'g' | 'a' | 'r';
export const fill = (v: number, T: number) => ({ g: FG, a: FA, r: FR })[band(v, T)];
export const txt = (v: number, T: number, th: Theme) => th[band(v, T)];

/** stop owner → short label + colour, as the UI legend uses them */
export const TEAM_TAG: Record<TeamId | 'none', { short: string; long: string; c: string }> = {
  maintenance: { short: 'MAINT', long: 'MAINTENANCE', c: '#F97316' },
  toolroom: { short: 'MOULD', long: 'TOOL ROOM', c: '#3B82F6' },
  store: { short: 'MAT', long: 'MATERIAL', c: '#0F9D8F' },
  utilities: { short: 'UTIL', long: 'UTILITIES', c: '#8B5E34' },
  mouldchange: { short: 'M/C', long: 'MOULD CHANGE', c: MC_PURPLE },
  planning: { short: 'NO PLAN', long: 'NO PLAN', c: '#5A5F67' },
  quality: { short: 'QUAL', long: 'QUALITY', c: '#BE185D' },
  production: { short: 'PROD', long: 'PRODUCTION', c: '#B07A00' },
  none: { short: 'STOP', long: 'NO TEAM YET', c: '#D8382B' },
};

export const STAGE_TV: Record<Stage, { l: string; tone: 'g' | 'a' | 'r' }> = {
  unassigned: { l: 'NOT ASSIGNED', tone: 'r' },
  assigned: { l: 'TEAM NOT ARRIVED', tone: 'r' },
  working: { l: 'TEAM WORKING', tone: 'a' },
  spare: { l: 'WAITING FOR SPARE', tone: 'r' },
  verify: { l: 'FIXED · VERIFY', tone: 'g' },
  closed: { l: 'CLOSED', tone: 'g' },
};

/** machine maker badge colours (UI file, plus the other makes on the floor) */
export const BRAND_C: Record<string, string> = {
  ENGEL: '#B5121B',
  MILACRON: '#7A1F5C',
  JSW: '#0B4EA2',
  HAITIAN: '#00599C',
  TOSHIBA: '#E60012',
  'LS MTRON': '#1D3F99',
  WOOJIN: '#C8102E',
  ARBURG: '#00694B',
  SUMITOMO: '#00479D',
  WINDSOR: '#9B1B30',
  'CHEN HSONG': '#D71920',
  TOYO: '#E4002B',
};

/* ---------------- helpers ---------------- */

export const hm = (sec: number) => {
  const m = Math.max(0, Math.floor(sec / 60));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}′`;
};
export const mins = (sec: number) => `${Math.max(0, Math.round(sec / 60))}′`;
export const hhmm = (daySec: number) => {
  const t = (((daySec + 6 * 3600) % 86400) + 86400) % 86400;
  return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`;
};
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  // final avalanche so near-identical keys land far apart
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
};
export const delta = (d: number, unit = '') => (Math.round(d) === 0 ? `— 0${unit}` : `${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d))}${unit}`);
export const dcol = (s: string, th: Theme) => (s.startsWith('▲') ? th.g : s.startsWith('▼') ? th.r : th.mu);

/** seconds per state of a machine inside a window */
function stateSecs(m: Machine, a: number, b: number, now: number) {
  const out = { RUN: 0, IDLE: 0, MC: 0, DOWN: 0, OFF: 0 } as Record<Segment['s'], number>;
  let stop: Segment | null = null;
  let stopLen = 0;
  for (let i = 0; i < m.timeline.length; i++) {
    const s = m.timeline[i];
    const e = i === m.timeline.length - 1 ? now : s.end;
    const ov = Math.min(b, e) - Math.max(a, s.start);
    if (ov <= 0) continue;
    out[s.s] += ov;
    if ((s.s === 'DOWN' || s.s === 'IDLE' || s.s === 'MC') && ov > stopLen) {
      stop = s;
      stopLen = ov;
    }
  }
  return { secs: out, stop };
}

const teamOfSeg = (s: Segment): TeamId | 'none' => (s.s === 'MC' ? 'mouldchange' : s.s === 'DOWN' && (!s.team || s.stage === 'unassigned') ? 'none' : ((s.team as TeamId) ?? 'none'));

/* ---------------- NOW cell (status · team · stage · timer) ---------------- */

export interface NowCell {
  bg: string;
  fg: string;
  l: string;
  s: string;
  v: string;
  p: string; // compact (portrait)
}
export function nowCell(w: World, m: Machine, th: Theme): NowCell {
  const since = w.t - m.since;
  if (m.state === 'RUN') {
    const q = m.parts ? (m.bad / m.parts) * 100 : 0;
    if (q > 6) return { bg: TEAM_TAG.quality.c, fg: '#fff', l: 'QUALITY CHECK', s: `rejects ${q.toFixed(0)}% this shift`, v: '', p: 'QUALITY' };
    return { bg: th.runBg, fg: th.runFg, l: 'RUNNING', s: `since ${hhmm(m.since)}`, v: '●', p: 'RUNNING' };
  }
  if (m.state === 'OFF') return { bg: th.offBg, fg: th.mu, l: 'NO JOB PLANNED', s: 'planning', v: '—', p: 'NO PLAN' };
  if (m.state === 'MC') return { bg: MC_PURPLE, fg: '#fff', l: 'MOULD CHANGE', s: `next mould ${m.nextMouldId ?? ''}`.trim(), v: hm(since), p: 'MOULD CHANGE' };
  if (m.state === 'IDLE') {
    const tag = TEAM_TAG[m.team ?? 'production'];
    return { bg: tag.c, fg: '#fff', l: tag.long, s: (m.reason || 'idle').toUpperCase(), v: hm(since), p: 'IDLE' };
  }
  const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
  const stage = tk?.stage ?? 'unassigned';
  const none = stage === 'unassigned' || !tk?.team;
  const tag = TEAM_TAG[none ? 'none' : tk!.team!];
  return { bg: tag.c, fg: '#fff', l: none ? 'STOPPED' : tag.long, s: none ? `NOT ASSIGNED · ${(m.reasonLogged ? m.reason : 'no reason yet').toUpperCase()}` : STAGE_TV[stage].l, v: hm(since), p: STAGE_TV[stage].l };
}

/* ---------------- machine basics ---------------- */

export function machineInfo(w: World, m: Machine) {
  const brand = m.make.toUpperCase();
  return { id: m.code, brand, bc: BRAND_C[brand] ?? '#4A4F57', ton: `${m.tonnage} T`, part: m.state === 'OFF' ? 'No job planned' : partOf(w, m)?.name ?? '—' };
}

/* ---------------- hourly OEE by machine (14g) ---------------- */

export interface HourBar {
  kind: 'future' | 'oee' | 'stop' | 'plan';
  v: number | null;
  tag: boolean; // mould change in this hour
  lab: string;
  c: string; // fill or team colour
  now: boolean;
}
export function hourBars(w: World, m: Machine): HourBar[] {
  const s0 = shiftStartOf(w.t);
  const std = stdOf(w, m);
  const cav = activeCav(w, m);
  return Array.from({ length: 8 }, (_, h) => {
    const a = s0 + h * 3600;
    const b = Math.min(a + 3600, w.t);
    const now = w.t >= a && w.t < a + 3600;
    if (b - a < 90) return { kind: 'future', v: null, tag: false, lab: '', c: 'transparent', now };
    const { secs, stop } = stateSecs(m, a, b, w.t);
    const el = b - a;
    const tag = secs.MC > 120;
    if (secs.OFF > el * 0.6) return { kind: 'plan', v: null, tag, lab: '', c: TEAM_TAG.planning.c, now };
    const good = (m.hourly[h] ?? 0) - (m.hourlyBad[h] ?? 0);
    const cap = (el / std) * cav;
    const oee = cap > 0 ? Math.min(99, (good / cap) * 100) : 0;
    if (secs.RUN < el * 0.25 && stop) {
      const team = teamOfSeg(stop);
      return { kind: 'stop', v: Math.round(oee), tag: tag && team !== 'mouldchange', lab: TEAM_TAG[team].short, c: TEAM_TAG[team].c, now };
    }
    return { kind: 'oee', v: Math.round(oee), tag, lab: '', c: '', now };
  });
}

/* ---------------- worst-first ranking (14b) ---------------- */

export interface RankRow {
  m: Machine;
  oee: number;
  aLoss: number;
  pLoss: number;
  qLoss: number;
  lastH: number | null;
  prevH: number | null;
}
export function ranking(w: World, ms: Machine[]) {
  const hi = Math.min(7, Math.floor((w.t - shiftStartOf(w.t)) / 3600));
  const rows: RankRow[] = [];
  let unplanned = 0;
  for (const m of ms) {
    if (m.state === 'OFF' && m.plannedSec < 600) {
      unplanned++;
      continue;
    }
    const d = derive(aggMachines(w, [m]));
    const A = d.A / 100,
      P = d.P / 100,
      Q = d.Q / 100;
    const bars = hourBars(w, m);
    const last = bars[Math.max(0, hi - 1)];
    const prev = bars[Math.max(0, hi - 2)];
    rows.push({
      m,
      oee: d.oee,
      aLoss: (1 - A) * 100,
      pLoss: A * (1 - P) * 100,
      qLoss: A * P * (1 - Q) * 100,
      lastH: hi >= 1 ? (last.v ?? 0) : null,
      prevH: hi >= 2 ? (prev.v ?? 0) : null,
    });
  }
  rows.sort((a, b) => a.oee - b.oee);
  return { rows, unplanned };
}

/* ---------------- OEE summary (14a) ---------------- */

export function unitHourOee(w: World, ms: Machine[], h: number) {
  let good = 0,
    cap = 0;
  const s0 = shiftStartOf(w.t);
  const a = s0 + h * 3600;
  const b = Math.min(a + 3600, w.t);
  if (b - a < 90) return null;
  let run = 0,
    planned = 0,
    shots = 0,
    parts = 0,
    bad = 0;
  for (const m of ms) {
    const { secs } = stateSecs(m, a, b, w.t);
    const std = stdOf(w, m);
    const cav = activeCav(w, m);
    const p = secs.RUN + secs.IDLE + secs.DOWN + secs.MC;
    planned += p;
    run += secs.RUN;
    const g = (m.hourly[h] ?? 0) - (m.hourlyBad[h] ?? 0);
    good += g;
    parts += m.hourly[h] ?? 0;
    bad += m.hourlyBad[h] ?? 0;
    cap += (p / std) * cav;
    shots += ((m.hourly[h] ?? 0) / cav) * std; // std-time of shots made
  }
  const A = planned ? run / planned : 0;
  const P = run ? Math.min(1, shots / run) : 0;
  const Q = parts ? good / parts : 1;
  return { oee: cap ? Math.min(99, (good / cap) * 100) : A * P * Q * 100, A: A * 100, P: P * 100, Q: Q * 100, kwh: 0 };
}

export function summary(w: World, unitId: string, ms: Machine[]) {
  const s0 = shiftStartOf(w.t);
  const hi = Math.min(7, Math.floor((w.t - s0) / 3600));
  const u = w.unit[unitId];
  const cur = unitHourOee(w, ms, hi) ?? { oee: 0, A: 0, P: 0, Q: 0, kwh: 0 };
  const prev = hi > 0 ? unitHourOee(w, ms, hi - 1) : null;
  const shift = derive(aggMachines(w, ms));
  // month to date: shifts closed so far this month at this unit's character, plus today's running shift
  const base = 62 + u.health * 12;
  const mtd = { oee: base + 1.5, A: 80 + u.health * 6, P: 85 + u.health * 4, Q: 96.6 + u.health * 0.8 };
  const prevMonth = { oee: base - 0.4, A: mtd.A - 1, P: mtd.P - 2, Q: mtd.Q + 0.6 };
  const kwh = ms.reduce((a, m) => a + m.kwh, 0);
  const kg = ms.reduce((a, m) => a + m.parts * ((partOf(w, m)?.weight ?? 150) / 1000), 0);
  // energy this hour: share of the shift's kWh by hourly parts
  const hourParts = ms.reduce((a, m) => a + (m.hourly[hi] ?? 0), 0);
  const shiftParts = ms.reduce((a, m) => a + m.parts, 0) || 1;
  const hourKwh = kwh * (hourParts / shiftParts);
  const hourKg = ms.reduce((a, m) => a + (m.hourly[hi] ?? 0) * ((partOf(w, m)?.weight ?? 150) / 1000), 0);
  const secH = hourKg ? hourKwh / hourKg : 0;
  const secShift = kg ? kwh / kg : 0;
  return {
    hour: { ...cur, label: `THIS HOUR · ${hhmm(s0 + hi * 3600)}–${hhmm(s0 + (hi + 1) * 3600)}`, short: `THIS HOUR · ${hhmm(s0 + hi * 3600).slice(0, 2)}–${hhmm(s0 + (hi + 1) * 3600).slice(0, 2)}`, vs: prev ? `vs ${hhmm(s0 + (hi - 1) * 3600).slice(0, 2)}–${hhmm(s0 + hi * 3600).slice(0, 2)}` : 'first hour', prev, kwhL: `${Math.round(hourKwh)} kWh so far`, sec: secH, secD: secH - secShift },
    month: { ...mtd, label: 'OCTOBER · MONTH TO DATE', short: 'OCTOBER · TO DATE', vs: 'vs September', prev: prevMonth, kwhL: `${(kwh * 62 / 1000 + 140).toFixed(0)} MWh`, sec: secShift * 0.97, secD: -0.03 },
    shift,
  };
}

/** last 12 hours of unit OEE. Current shift hours are computed live; earlier hours come from the
 *  closed shift's figure with an hourly pattern (the simulator keeps shift totals, not hourly history). */
export function trend12(w: World, unitId: string, ms: Machine[]) {
  const s0 = shiftStartOf(w.t);
  const hi = Math.min(7, Math.floor((w.t - s0) / 3600));
  const prevShift = w.prevShifts[unitId]?.[0]?.oee ?? 60;
  const out: { hr: string; v: number; shift: 'prev' | 'cur'; now: boolean; kwh: number; sec: number }[] = [];
  for (let k = 11; k >= 0; k--) {
    const rel = hi - k; // hour index relative to current shift start
    const label = hhmm(s0 + rel * 3600).slice(0, 2);
    if (rel >= 0) {
      const r = unitHourOee(w, ms, rel);
      const v = Math.round(r?.oee ?? 0);
      const kwh = Math.round(ms.reduce((a, m) => a + m.kw, 0) * (rel === hi ? (w.t - (s0 + rel * 3600)) / 3600 : 1) * (0.92 + hash(unitId + rel) * 0.1));
      out.push({ hr: label, v, shift: 'cur', now: rel === hi, kwh, sec: 0.78 + (1 - v / 100) * 0.25 });
    } else {
      const v = Math.round(Math.max(35, Math.min(92, prevShift + (hash(unitId + 'h' + rel) - 0.5) * 16)));
      out.push({ hr: label, v, shift: 'prev', now: false, kwh: Math.round(500 + hash(unitId + 'k' + rel) * 80), sec: 0.82 + (1 - v / 100) * 0.12 });
    }
  }
  return out;
}

/** top losses now: machines costing the most OEE points this shift, with team, stage and timer */
export function topLosses(w: World, ms: Machine[], n = 3) {
  const totalPlanned = ms.reduce((a, m) => a + m.plannedSec, 0) || 1;
  return ms
    .filter((m) => m.state !== 'OFF')
    .map((m) => {
      const lostSec = m.downSec + m.idleSec + m.mcSec + Math.max(0, m.runSec - m.stdShotSec);
      const pts = (lostSec / totalPlanned) * 100;
      const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
      let team: TeamId | 'none' = 'production';
      let t = '';
      let stage: { l: string; tone: 'g' | 'a' | 'r' } = { l: 'RUNNING', tone: 'g' };
      let timer = '';
      if (m.state === 'DOWN') {
        team = tk?.team && tk.stage !== 'unassigned' ? tk.team : 'none';
        t = m.reasonLogged ? m.reason : tk?.symptom || 'Stopped · no reason yet';
        stage = STAGE_TV[tk?.stage ?? 'unassigned'];
        timer = hm(w.t - m.since);
      } else if (m.state === 'MC') {
        team = 'mouldchange';
        t = `Mould change to ${m.nextMouldId ?? 'next mould'}`;
        stage = { l: 'IN PROGRESS', tone: 'a' };
        timer = hm(w.t - m.since);
      } else if (m.state === 'IDLE') {
        team = m.team ?? 'production';
        t = m.reason || 'Idle';
        stage = { l: 'IDLE', tone: 'a' };
        timer = hm(w.t - m.since);
      } else {
        const std = stdOf(w, m);
        if (m.cycleFactor > 1.04) {
          team = 'production';
          t = `Slow cycle ${(std * m.cycleFactor).toFixed(1)} s vs ${std.toFixed(1)} s`;
          stage = { l: 'NOT ASSIGNED', tone: 'r' };
          timer = 'all shift';
        } else {
          // running now: name the stop that cost it most this shift
          const by = new Map<string, { sec: number; team: TeamId | 'none'; label: string }>();
          for (const sg of m.timeline) {
            if (sg.s === 'RUN' || sg.s === 'OFF') continue;
            const tm = teamOfSeg(sg);
            const label = sg.s === 'MC' ? 'Mould change' : sg.reason || 'Stop, no reason';
            const cur = by.get(label) ?? { sec: 0, team: tm, label };
            cur.sec += sg.end - sg.start;
            by.set(label, cur);
          }
          const top = [...by.values()].sort((a, b) => b.sec - a.sec)[0];
          t = top ? `${top.label} earlier · ${hm(top.sec)}` : 'Short stops';
          team = top?.team ?? 'production';
          stage = { l: 'RUNNING NOW', tone: 'g' };
          timer = '';
        }
      }
      return { m, pts, team, t, stage, timer };
    })
    .sort((a, b) => b.pts - a.pts)
    .slice(0, n);
}

/* ---------------- reasons & availability ---------------- */

export function reasons(w: World, ms: Machine[]) {
  const r = downtimeByReason(w, ms);
  return { ...r, list: r.list.slice(0, 8) };
}
export function availRank(ms: Machine[]) {
  return ms
    .filter((m) => m.plannedSec > 600)
    .map((m) => ({ m, a: availability(m), down: m.downSec, idle: m.idleSec, mc: m.mcSec }))
    .sort((a, b) => a.a - b.a);
}

/* ---------------- trucks (14e) ---------------- */

export interface TruckCard {
  k: Truck;
  wait: number; // seconds inside
  lane: 'out' | 'dock' | 'in' | 'left';
  why: string;
  bad: boolean;
  meta: string;
}
export function trucks(w: World, unitId: string, amberMin: number, redMin: number) {
  const all = w.trucks.filter((k) => k.unitId === unitId);
  const cards: TruckCard[] = all.map((k) => {
    const wait = (k.out ?? w.t) - k.gateIn;
    const h = hash(k.id);
    let lane: TruckCard['lane'];
    let why: string;
    let bad = false;
    if (k.phase === 3) {
      lane = 'left';
      why = '';
    } else if (k.phase === 0) {
      lane = k.dir === 'OUT' ? 'out' : 'in';
      if (k.delayed) (why = 'WAITING: DOCS / CUSTOMER HOLD'), (bad = true);
      else if (k.dir === 'OUT') why = h < 0.4 ? 'WAITING: PARTS NOT PACKED' : h < 0.7 ? 'WAITING: QC RELEASE' : 'WAITING: DOCK BUSY';
      else why = h < 0.5 ? 'WAITING: NO STORE MANPOWER' : 'WAITING: DOCK BUSY';
      if (!bad) bad = !why.includes('DOCK BUSY') && wait / 60 >= amberMin;
    } else {
      lane = 'dock';
      why = k.phase === 1 ? `${k.dir === 'OUT' ? 'LOADING' : 'UNLOADING'} SINCE ${hhmm(k.phaseAt - 900)}` : k.dir === 'OUT' ? 'INVOICE PENDING' : 'GRN PENDING';
      bad = k.phase === 2 && wait / 60 >= redMin;
    }
    const dock = /dock (\d)/i.exec(k.status)?.[1];
    const meta = `${k.transporter} · ${k.doc}${dock ? ` · dock ${dock}` : ''} · in ${hhmm(k.gateIn)}`;
    return { k, wait, lane, why, bad, meta };
  });
  const inside = cards.filter((c) => c.lane !== 'left').sort((a, b) => b.wait - a.wait);
  const left = cards
    .filter((c) => c.lane === 'left' && w.t - (c.k.out ?? 0) < 2 * 3600)
    .sort((a, b) => (b.k.out ?? 0) - (a.k.out ?? 0));
  const leftToday = cards.filter((c) => c.lane === 'left' && (c.k.out ?? 0) >= 0);
  const over = (m: number) => inside.filter((c) => c.wait / 60 >= m);
  const avg = leftToday.length ? leftToday.reduce((a, c) => a + c.wait, 0) / leftToday.length : 0;
  return {
    inside,
    out: inside.filter((c) => c.lane === 'out'),
    dock: inside.filter((c) => c.lane === 'dock'),
    in: inside.filter((c) => c.lane === 'in'),
    left,
    overRed: over(redMin),
    overAmber: over(amberMin).filter((c) => c.wait / 60 < redMin),
    avgMin: avg / 60,
    leftToday: leftToday.length,
    leftOut: leftToday.filter((c) => c.k.dir === 'OUT').length,
  };
}
export const waitTone = (sec: number, amberMin: number, redMin: number) => (sec / 60 >= redMin ? 'r' : sec / 60 >= amberMin ? 'a' : 'g') as 'g' | 'a' | 'r';

export const shiftHours = (w: World) => {
  const s0 = shiftStartOf(w.t);
  const hi = Math.min(7, Math.floor((w.t - s0) / 3600));
  return Array.from({ length: 8 }, (_, i) => ({ l: hhmm(s0 + i * 3600), s: hhmm(s0 + i * 3600).slice(0, 2), state: i === hi ? 'now' : i > hi ? 'future' : 'past' }));
};
export const SHIFT_SPAN = SHIFT_LEN;
