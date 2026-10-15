import { activeCav, stdOf, type World } from './engine';
import { shiftOf, shiftStartOf } from './catalog';
import type { Machine } from './types';

export interface PartRec {
  serial: string;
  t: number;
  machineId: string;
  shot: number;
  cavity: string;
  mouldId: string;
  partId: string;
  weight: number;
  nominal: number;
  tol: number;
  ok: boolean;
  reason: string;
  auto: boolean;
  shift: 'A' | 'B' | 'C';
  manual?: boolean;
}

/** fast deterministic hash -> [0,1) */
export function h01(s: string) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  x ^= x >>> 13;
  x = Math.imul(x, 0x5bd1e995);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

const VISUAL = ['Sink mark', 'Silver streak', 'Black dot', 'Weld line', 'Scratch & damage', 'Warpage'];

export function recordFor(w: World, m: Machine, shot: number, cavIdx: number, t: number): PartRec {
  const md = w.mould[m.mouldId];
  const pos = md?.positions[cavIdx] ?? md?.positions[0];
  const p = w.part[pos?.partId ?? ''];
  const u = w.unit[m.unitId];
  const cavCode = pos?.code.length === 1 ? pos.code : String.fromCharCode(65 + cavIdx);
  const serial = `${u.code}-${m.code.slice(4)}-${shot}${cavCode}`;
  const r1 = h01(serial);
  const r2 = h01(serial + 'w');
  const r3 = h01(serial + 'r');
  const nominal = p?.weight ?? 200;
  const tol = p?.tol ?? 1.5;
  const rej = Math.min(0.3, m.rejBase + m.rejSpike);
  const drift = m.hot ? tol * 0.35 : 0;
  let weight = nominal + drift + (r1 + r2 - 1) * tol * 0.95;
  let ok = true;
  let reason = '';
  let auto = true;
  if (r3 < rej) {
    ok = false;
    if (r3 < rej * 0.6) {
      const heavy = h01(serial + 'h') < (m.hot ? 0.8 : 0.5);
      weight = nominal + (heavy ? 1 : -1) * tol * (1.08 + r2 * 0.9);
      reason = heavy ? 'Flash on parting line' : 'Short shot';
    } else {
      reason = VISUAL[Math.floor(r1 * VISUAL.length)];
      auto = false;
    }
  } else if (Math.abs(weight - nominal) > tol) {
    weight = nominal + Math.sign(weight - nominal) * tol * 0.9;
  }
  return { serial, t, machineId: m.id, shot, cavity: cavCode, mouldId: md?.id ?? '', partId: p?.id ?? '', weight: +weight.toFixed(1), nominal, tol, ok, reason, auto, shift: shiftOf(Math.max(0, t)) };
}

/** Most recent `count` part records for a machine (walks back from the live shot counter). */
export function latestParts(w: World, m: Machine, count: number): PartRec[] {
  const out: PartRec[] = [];
  const cav = activeCav(w, m);
  const ct = stdOf(w, m) * m.cycleFactor;
  const s0 = shiftStartOf(w.t);
  let shot = Math.floor(m.shotCounter);
  // last run time
  let t = m.state === 'RUN' ? w.t : m.since;
  const md = w.mould[m.mouldId];
  while (out.length < count && t > s0) {
    for (let c = cav - 1; c >= 0 && out.length < count; c--) {
      let idx = 0;
      let n = -1;
      for (let i = 0; i < (md?.blocked.length ?? 1); i++) {
        if (!md?.blocked[i]) n++;
        if (n === c) {
          idx = i;
          break;
        }
      }
      out.push(recordFor(w, m, shot, idx, t));
    }
    shot -= 1;
    t -= ct;
  }
  return out;
}

export function paramsAtShot(w: World, m: Machine, serial: string) {
  const r = (k: string) => h01(serial + k) - 0.5;
  const s = m.set;
  return [
    { l: 'Barrel zone 3', v: s.z3 + r('z3') * 4, u: '°C', lo: s.z3 - 10, hi: s.z3 + 10 },
    { l: 'Barrel zone 4', v: s.z4 + (m.hot ? 8 : 0) + r('z4') * 4, u: '°C', lo: s.z4 - 5, hi: s.z4 + 5 },
    { l: 'Mould temp', v: s.mouldTemp + r('mt') * 6, u: '°C', lo: s.mouldTemp - 4, hi: s.mouldTemp + 4 },
    { l: 'Injection pressure', v: s.injP + r('ip') * 90, u: 'bar', lo: s.injP - 100, hi: s.injP + 100 },
    { l: 'Hold pressure', v: s.holdP + r('hp') * 50, u: 'bar', lo: s.holdP - 50, hi: s.holdP + 50 },
    { l: 'Cushion', v: s.cushion + r('cu') * 3, u: 'mm', lo: s.cushion - 2, hi: s.cushion + 2 },
    { l: 'Cycle time', v: stdOf(w, m) * m.cycleFactor * (1 + r('ct') * 0.03), u: 's', lo: stdOf(w, m) * 0.95, hi: stdOf(w, m) * 1.05 },
    { l: 'Clamp force', v: s.clamp + r('cf') * 120, u: 'kN', lo: s.clamp - 200, hi: s.clamp + 200 },
  ];
}
