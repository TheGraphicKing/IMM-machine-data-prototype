import { CUSTOMERS, MAKES, MODELS, OPERATORS, PART_CATALOG, SKILLS, TONNAGES } from './catalog';
import { gauss, irange, mulberry32, pick, range } from '../lib/rng';
import { START_T, goDown, goIdle, goMC, mkSet, newTruck, setStage, step, type World } from './engine';
import type { Employee, HeldIngest, Machine, Mould, Order, Org, Part, Unit } from './types';

interface UnitSeed {
  name: string;
  code: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  n: number;
  health: number;
  head: string;
}
const ORG_SEED: { name: string; code: string; city: string; state: string; head: string; units: UnitSeed[] }[] = [
  {
    name: 'Apex South',
    code: 'AS',
    city: 'Chennai',
    state: 'TN',
    head: 'K. Venkatesh',
    units: [
      { name: 'Sriperumbudur U1', code: 'SP1', city: 'Sriperumbudur', state: 'TN', lat: 12.97, lng: 79.95, n: 18, health: 0.9, head: 'R. Krishnan' },
      { name: 'Sriperumbudur U2', code: 'SP2', city: 'Sriperumbudur', state: 'TN', lat: 12.93, lng: 79.9, n: 16, health: 0.78, head: 'M. Selvam' },
      { name: 'Oragadam U3', code: 'OR3', city: 'Oragadam', state: 'TN', lat: 12.84, lng: 80.02, n: 14, health: 0.66, head: 'A. Prakash' },
      { name: 'Hosur U4', code: 'HS4', city: 'Hosur', state: 'TN', lat: 12.74, lng: 77.83, n: 12, health: 0.93, head: 'S. Raman' },
    ],
  },
  {
    name: 'Apex West',
    code: 'AW',
    city: 'Pune',
    state: 'MH',
    head: 'S. Kulkarni',
    units: [
      { name: 'Chakan U1', code: 'CK1', city: 'Chakan', state: 'MH', lat: 18.76, lng: 73.86, n: 16, health: 0.84, head: 'P. Deshmukh' },
      { name: 'Ranjangaon U2', code: 'RJ2', city: 'Ranjangaon', state: 'MH', lat: 18.76, lng: 74.24, n: 14, health: 0.95, head: 'N. Joshi' },
      { name: 'Talegaon U3', code: 'TG3', city: 'Talegaon', state: 'MH', lat: 18.73, lng: 73.68, n: 12, health: 0.8, head: 'A. Gokhale' },
    ],
  },
  {
    name: 'Apex North',
    code: 'AN',
    city: 'Manesar',
    state: 'HR',
    head: 'A. Malhotra',
    units: [
      { name: 'Manesar U1', code: 'MN1', city: 'Manesar', state: 'HR', lat: 28.36, lng: 76.94, n: 20, health: 0.68, head: 'I. Qureshi' },
      { name: 'Bawal U2', code: 'BW2', city: 'Bawal', state: 'HR', lat: 28.08, lng: 76.58, n: 16, health: 0.82, head: 'H. Chaudhary' },
      { name: 'Pantnagar U3', code: 'PN3', city: 'Pantnagar', state: 'UK', lat: 29.02, lng: 79.49, n: 14, health: 0.88, head: 'D. Negi' },
    ],
  },
  {
    name: 'Apex East',
    code: 'AE',
    city: 'Kolkata',
    state: 'WB',
    head: 'P. Banerjee',
    units: [
      { name: 'Uluberia U1', code: 'UL1', city: 'Uluberia', state: 'WB', lat: 22.47, lng: 88.11, n: 14, health: 0.7, head: 'S. Mukherjee' },
      { name: 'Jamshedpur U2', code: 'JS2', city: 'Jamshedpur', state: 'JH', lat: 22.8, lng: 86.2, n: 12, health: 0.91, head: 'R. Mahato' },
    ],
  },
];

export const HERO_UNIT = 'MN1';

function buildParts(r: () => number): Part[] {
  const parts: Part[] = [];
  let k = 0;
  // 3 models per catalog item, positions expanded → ~400 parts
  PART_CATALOG.forEach(([name, weight, ci, material, sell, pos], i) => {
    const models = MODELS[ci];
    const nModels = pos ? 4 : 4 + (i % 3 === 0 ? 2 : i % 2);
    const colours = i % 2 === 0 ? ['Black', 'Grey', 'Beige'] : ['Black', 'Grey'];
    for (let mi = 0; mi < nModels; mi++) {
      const model = models[mi % models.length] + (mi >= models.length ? '-FL' : '');
      const variants = pos ?? [''];
      for (const v of variants) for (const col of colours) {
        k++;
        const pref = ['OM', 'NV', 'KT'][ci];
        const w = +(weight * (1 + (mi - 1) * 0.04)).toFixed(1);
        const s = Math.round(sell * (1 + (mi - 1) * 0.05));
        const mat = Math.round(w * (material.startsWith('PC') ? 0.24 : material.startsWith('ABS') ? 0.19 : 0.13));
        parts.push({
          id: `P${k}`,
          number: `${pref}${mi + 1}-${24100 + k * 7}${v ? v[0] : 'A'}-${col[0]}`,
          erp: `SFG${30600 + k * 3}`,
          name: v ? `${name} ${v}` : name,
          colour: col,
          customer: CUSTOMERS[ci],
          model,
          material,
          weight: w,
          tol: +(Math.max(0.8, Math.min(4, w * 0.006))).toFixed(1),
          sell: s,
          material$: mat,
          conv: Math.round(s * 0.26 + r() * 4),
        });
      }
    }
  });
  return parts;
}

function buildMoulds(r: () => number, parts: Part[]): Mould[] {
  const moulds: Mould[] = [];
  const used = new Set<number>([2208, 2207, 1420, 1104, 918, 1733, 614, 831, 612]);
  // group by base name+model (family) so LH/RH share a mould
  const groups = new Map<string, Part[]>();
  for (const p of parts) {
    const base = p.name.replace(/ (LH|RH|CTR)$/, '') + '|' + p.model + '|' + p.colour;
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(p);
  }
  let idx = 0;
  const all = [...groups.values()];
  // ~300 moulds: some parts get 2 moulds (duplicate tools)
  while (moulds.length < 300) {
    const g = all[idx % all.length];
    idx++;
    let num: number;
    do num = irange(r, 300, 2399);
    while (used.has(num));
    used.add(num);
    const family = g.length > 1;
    const p0 = g[0];
    const heavy = p0.weight > 600;
    const cav = family ? 1 : heavy ? 1 : p0.weight > 250 ? 2 : p0.weight > 120 ? pick(r, [2, 4]) : pick(r, [4, 8]);
    const positions = family ? g.map((p) => ({ code: p.name.split(' ').pop()!, partId: p.id })) : Array.from({ length: cav }, (_, i) => ({ code: String.fromCharCode(65 + i), partId: p0.id }));
    const std = +(Math.min(58, 16 + Math.sqrt(p0.weight) * 1.05 + r() * 6)).toFixed(1);
    const ton = TONNAGES.find((t) => t >= (p0.weight * positions.length) / 4.2 + 100) ?? 650;
    const pmInterval = pick(r, [40000, 50000, 60000, 80000]);
    moulds.push({
      id: `M-${String(num).padStart(4, '0')}`,
      name: p0.name.replace(/ (LH|RH|CTR)$/, '') + (family ? ` ${g.map((p) => p.name.split(' ').pop()).join('/')}` : ''),
      serial: `SN-${irange(r, 1000, 9999)}`,
      type: family ? 'family' : 'multi',
      positions,
      blocked: positions.map(() => false),
      stdCycle: std,
      tonnage: ton,
      pmInterval,
      shotsSincePM: Math.round(pmInterval * r() * 0.9),
      lifetime: irange(r, 60000, 900000),
      location: `Rack R-${String(irange(r, 1, 24)).padStart(2, '0')}`,
      status: r() < 0.06 ? 'toolroom' : 'storage',
      owner: r() < 0.4 ? 'customer' : 'own',
      customer: p0.customer,
      stdChangeMin: ton >= 450 ? 40 : 30,
    });
  }
  return moulds;
}

export function createWorld(seed = 20261015): World {
  const r = mulberry32(seed);
  const parts = buildParts(r);
  const moulds = buildMoulds(r, parts);
  const w: World = {
    t: 0,
    day: 15,
    rng: r,
    orgs: [],
    units: [],
    machines: [],
    moulds,
    parts,
    org: {},
    unit: {},
    machine: {},
    mould: {},
    part: {},
    tickets: [],
    ticket: {},
    alerts: [],
    trucks: [],
    orders: [],
    prevShifts: {},
    employees: [],
    jobs: [],
    held: [],
    script: [],
    seq: { ticket: 80, alert: 0, truck: 0, wo: 48100 },
    toasts: [],
    powerHist: {},
    alerted: new Set(),
    warm: true,
    heroUnitId: '',
    shiftsCompleted: 0,
  };
  for (const p of parts) w.part[p.id] = p;
  for (const m of moulds) w.mould[m.id] = m;

  // org/unit/machines
  let opIdx = 0;
  for (const os of ORG_SEED) {
    const org: Org = { id: os.code, name: os.name, code: os.code, city: os.city, state: os.state, head: os.head, unitIds: [] };
    w.orgs.push(org);
    w.org[org.id] = org;
    for (const us of os.units) {
      const unit: Unit = { id: us.code, orgId: org.id, name: us.name, code: us.code, city: us.city, state: us.state, lat: us.lat, lng: us.lng, halls: us.n >= 14 ? ['Hall A', 'Hall B'] : ['Hall A'], machineIds: [], head: us.head, health: us.health };
      org.unitIds.push(unit.id);
      w.units.push(unit);
      w.unit[unit.id] = unit;
      for (let i = 1; i <= us.n; i++) {
        const tonnage = TONNAGES[Math.min(TONNAGES.length - 1, Math.floor((i - 1) / Math.max(1, us.n / TONNAGES.length)))];
        const cands = moulds.filter((m) => m.status === 'storage' && m.tonnage <= tonnage && m.tonnage >= tonnage - 300);
        const md = cands.length ? pick(r, cands) : moulds.find((m) => m.status === 'storage')!;
        md.status = 'production';
        const id = `${unit.code}-${String(i).padStart(2, '0')}`;
        md.location = id;
        const m: Machine = {
          id,
          code: `IMM-${String(i).padStart(2, '0')}`,
          unitId: unit.id,
          hall: unit.halls.length > 1 && i > us.n / 2 ? 'Hall B' : 'Hall A',
          tonnage,
          make: pick(r, MAKES),
          year: irange(r, 2009, 2024),
          mouldId: md.id,
          wo: `WO-${++w.seq.wo}`,
          woQty: irange(r, 6, 24) * 1000,
          operator: OPERATORS[opIdx++ % OPERATORS.length],
          cycleFactor: 1 + (1 - us.health) * 0.08 + Math.abs(gauss(r)) * 0.012 + (r() < 0.12 ? 0.05 : 0),
          rejBase: Math.max(0.006, 0.009 + (1 - us.health) * 0.06 * r() + r() * 0.012),
          rejSpike: 0,
          state: 'RUN',
          since: 0,
          reason: '',
          reasonLogged: true,
          team: null,
          ticketId: null,
          nextAt: 0,
          nextMouldId: null,
          nextMCAt: range(r, 0.5, 14) * 3600,
          plannedSec: 0,
          capParts: 0,
          runStdParts: 0,
          stdShotSec: 0,
          runSec: 0,
          idleSec: 0,
          downSec: 0,
          mcSec: 0,
          shots: 0,
          parts: 0,
          bad: 0,
          hourly: new Array(8).fill(0),
          hourlyBad: new Array(8).fill(0),
          kwh: 0,
          kwhIdle: 0,
          kw: 0,
          ratedKw: Math.round(12 + tonnage * 0.075),
          timeline: [{ s: 'RUN', start: 0, end: 0 }],
          set: {} as Machine['set'],
          act: {} as Machine['act'],
          cycleHist: [],
          weightHist: [],
          shotCounter: irange(r, 40000, 400000),
          hot: false,
          mcDone: 0,
        };
        w.machines.push(m);
        w.machine[id] = m;
        unit.machineIds.push(id);
        m.set = mkSet(w, m);
        m.act = { ...m.set };
      }
    }
  }
  w.heroUnitId = HERO_UNIT;
  const hero = w.unit[HERO_UNIT];
  const H = (n: number) => w.machine[`${HERO_UNIT}-${String(n).padStart(2, '0')}`];

  // --- hero unit hand-placed moulds (matches the approved redesign story) ---
  const clone = (name: string, id: string, cav?: number, std?: number): Mould => {
    const tpl = moulds.find((x) => x.name.startsWith(name)) ?? moulds[0];
    const md: Mould = JSON.parse(JSON.stringify(tpl));
    md.id = id;
    md.serial = `SN-${irange(r, 1000, 9999)}`;
    if (cav && md.type === 'multi') {
      md.positions = Array.from({ length: cav }, (_, i) => ({ code: String.fromCharCode(65 + i), partId: tpl.positions[0].partId }));
      md.blocked = md.positions.map(() => false);
    }
    if (std) md.stdCycle = std;
    md.status = 'storage';
    md.location = 'Rack R-07';
    moulds.push(md);
    w.mould[id] = md;
    return md;
  };
  const place = (m: Machine, md: Mould) => {
    const old = w.mould[m.mouldId];
    old.status = 'storage';
    old.location = 'Rack R-03';
    md.status = 'production';
    md.location = m.id;
    m.mouldId = md.id;
    m.set = mkSet(w, m);
    m.act = { ...m.set };
  };
  place(H(2), clone('Bumper bracket', 'M-2208', 2, 33.5));
  place(H(7), clone('Bumper bracket', 'M-2207', 2, 34.0));
  clone('Lamp housing', 'M-1420', 2, 29.0);
  place(H(5), clone('Door trim', 'M-1104', undefined, 44.0)); // changes to M-1420 at 08:16 (script)
  place(H(9), clone('Wheel arch liner', 'M-0918', 1, 47.0));
  place(H(13), clone('Air vent', 'M-1733', 4, 24.0));
  place(H(15), clone('Glove box lid', 'M-0614', 2, 36.0));
  place(H(12), clone('Fan shroud', 'M-0831', 1, 42.0));
  clone('Glove box lid', 'M-0612', 2, 36.0);
  H(7).tonnage = 450;
  H(7).make = 'Engel';
  H(5).tonnage = 350;
  H(5).make = 'Engel';
  H(5).operator = 'S. Devi';
  const m1420 = w.mould['M-1420'];
  m1420.shotsSincePM = 47100;
  m1420.pmInterval = 50000;
  const lamp = w.part[m1420.positions[0].partId];
  lamp.weight = 182.0;
  lamp.tol = 1.5;
  const bb = w.part[w.mould['M-2208'].positions[0].partId];
  bb.weight = 250.0;
  bb.tol = 1.5;
  for (const n of [2, 4, 5, 7, 9, 11, 12, 13, 15]) H(n).hero = true;
  for (const n of [2, 4, 5, 7, 9, 11, 12, 13, 15]) H(n).nextMCAt = 99 * 3600;

  // offline / planned stop machines elsewhere
  const off1 = w.machine['BW2-16'];
  off1.state = 'OFF';
  off1.timeline = [{ s: 'OFF', start: 0, end: 0 }];
  off1.reason = 'Gateway offline';

  // --- scripted story for the hero unit (shop-floor seconds since 06:00) ---
  const at = (hh: number, mm: number) => (hh - 6) * 3600 + mm * 60;
  w.script.push(
    { at: at(8, 16), run: (w) => goMC(w, H(5), 'M-1420', 12) },
    { at: at(8, 29), run: () => { H(5).wo = 'WO-48155'; H(5).woQty = 12000; H(5).operator = 'S. Devi'; } },
    { at: at(9, 52), run: (w) => { const tk = goDown(w, H(5), 'TM-03'); setStage(w, tk, 'assigned', 'Supervisor', '', 'toolroom'); } },
    { at: at(10, 30), run: () => { H(9).rejSpike = 0.042; } },
    { at: at(10, 50), run: () => { H(5).cycleFactor = 1.09; H(5).hot = true; } },
    { at: at(11, 4), run: (w) => { const tk = goDown(w, H(7), 'MM-04', true); tk.symptom = 'Heater alarm zone 3 · temp not rising'; H(7).reason = 'Heater zone 3 fault'; tk.photos = 2; } },
    { at: at(11, 6), run: (w) => { const tk = w.ticket[H(7).ticketId!]; setStage(w, tk, 'assigned', 'R. Tomar', 'Heater alarm zone 3 · photo attached', 'maintenance'); tk.assignee = 'S. Pillai'; } },
    { at: at(11, 18), run: (w) => goMC(w, H(13), 'M-0612', 40) },
    { at: at(11, 21), run: (w) => { const tk = goDown(w, H(2), 'TM-11', true); H(2).reason = 'Mould water leak'; tk.photos = 1; } },
    { at: at(11, 23), run: (w) => { const tk = w.ticket[H(2).ticketId!]; setStage(w, tk, 'assigned', 'R. Tomar', 'Water leak on mould cooling line', 'toolroom'); tk.assignee = 'V. Shetty'; } },
    { at: at(11, 25), run: (w) => setStage(w, w.ticket[H(2).ticketId!], 'working', 'V. Shetty', "I'm on it") },
    { at: at(11, 26), run: (w) => setStage(w, w.ticket[H(7).ticketId!], 'working', 'S. Pillai', "I'm on it") },
    { at: at(11, 28), run: (w) => setStage(w, w.ticket[H(2).ticketId!], 'spare', 'V. Shetty', 'Spare requested · Water hose 12 mm') },
    { at: at(11, 31), run: (w) => { const tk = w.ticket[H(7).ticketId!]; tk.history.push({ t: w.t, stage: 'note', by: 'S. Pillai', note: 'Spare request · Heater band 450 W · ready for pickup, bin B-14' }); } },
    { at: at(11, 35), run: (w) => { goDown(w, H(15), null, true); H(15).reason = 'No reason logged'; } },
    { at: at(11, 36), run: (w) => goIdle(w, H(4), 'No material', 14) },
    { at: at(11, 37), run: (w) => { const tk = goDown(w, H(12), 'UT-05', true); H(12).reason = 'Chiller pressure low'; setStage(w, tk, 'assigned', 'R. Tomar', 'Chiller pressure low? · 2 photos', 'utilities'); tk.photos = 2; } },
    { at: at(11, 38), run: (w) => goIdle(w, H(11), 'Operator break', 12) },
  );

  // previous shifts (synthetic, deterministic)
  for (const u of w.units) {
    const base = 1300 * u.machineIds.length * 8 * (0.85 + u.health * 0.1);
    const mk = (label: string, f: number) => {
      const plan = base * 1.04;
      const out = plan * Math.min(0.99, u.health * f);
      return { label, out: Math.round(out), plan: Math.round(plan), oee: Math.min(88, 62 + u.health * 18 * f), rej: Math.max(0.9, 4.2 - u.health * 3 * f) };
    };
    w.prevShifts[u.id] = [mk('Shift C · last night', 0.96), mk('Shift B · yesterday', 1.0), mk('Shift A · yesterday', 1.02)];
  }

  // warm-up: run the factory from 06:00 to 11:42
  const DT = 20;
  while (w.t < START_T) step(w, Math.min(DT, START_T - w.t));
  w.warm = false;

  // trucks for every unit (hero unit gets the hand-crafted set)
  const T = (dir: 'IN' | 'OUT', plateS: string, trans: string, party: string, short: string, doc: string, waitedMin: number, status: string, phase: 0 | 1 | 2, delayed = false) =>
    newTruck(w, hero, { dir, plate: plateS, transporter: trans, party, partyShort: short, doc, gateIn: w.t - waitedMin * 60, status, phase, phaseAt: w.t + range(r, 300, 1500), delayed });
  T('OUT', 'HR 55 AK 4721', 'VRL Logistics', 'Orion Motors, Manesar', 'Orion', 'INV 2610-0412', 80, 'Waiting for loading', 0, true);
  T('OUT', 'HR 38 Z 9081', 'Safexpress', 'Nova Appliances, Noida', 'Nova', 'INV 2610-0415', 51, 'Loading · dock 2', 1);
  T('IN', 'HR 26 DK 3310', 'Om Logistics', 'Reliance Polymers (PP)', 'Reliance', 'DC 88213', 37, 'Waiting to unload', 0);
  T('OUT', 'DL 1M 7744', 'TCI Freight', 'Kestrel Two-Wheelers, Dharuhera', 'Kestrel', 'INV 2610-0418', 24, 'Invoice pending', 2);
  T('IN', 'RJ 14 GC 2208', 'Gati', 'Haldia Petrochemicals', 'Haldia', 'DC 4471', 16, 'Unloading · dock 1', 1);
  T('OUT', 'HR 55 AB 1190', 'VRL Logistics', 'Orion Motors, Gurugram', 'Orion', 'INV 2610-0420', 8, 'Waiting for loading', 0);
  const left: [string, 'IN' | 'OUT', string, number, number][] = [
    ['HR 55 X 2231', 'OUT', 'Orion Motors', 12, 42],
    ['HR 26 C 9011', 'IN', 'Reliance Polymers', 30, 35],
    ['DL 1L 5520', 'OUT', 'Nova Appliances', 44, 61],
    ['HR 55 Q 8817', 'OUT', 'Kestrel Two-Wheelers', 82, 38],
  ];
  for (const [p, d, party, agoMin, stay] of left) {
    const k = newTruck(w, hero, { plate: p, dir: d, party, partyShort: party.split(' ')[0], status: 'Left', phase: 3 as const });
    k.out = w.t - agoMin * 60;
    k.gateIn = k.out - stay * 60;
  }
  for (const u of w.units) {
    if (u.id === HERO_UNIT) continue;
    const n = irange(r, 2, 5);
    for (let i = 0; i < n; i++) {
      const k = newTruck(w, u);
      k.gateIn = w.t - range(r, 3, 48) * 60;
    }
  }

  // customer orders → dispatch at risk
  const mkOrder = (u: Unit, customer: string, mIds: string[], qty: number, stock: number, dueHHMM: [number, number], truck: string): Order => {
    const pid = w.mould[w.machine[mIds[0]].mouldId].positions[0].partId;
    return { id: `SO-${irange(r, 7000, 9999)}`, unitId: u.id, customer, partId: pid, machineIds: mIds, qty, stock, due: at(dueHHMM[0], dueHHMM[1]), truck };
  };
  w.orders.push(mkOrder(hero, 'Orion Motors', [H(2).id, H(7).id], 7200, 3800, [18, 0], '18:00 truck'));
  w.orders.push(mkOrder(hero, 'Orion Motors', [H(5).id], 3900, 1500, [21, 0], '21:00 truck'));
  w.orders.push(mkOrder(hero, 'Nova Appliances', [H(3).id], 3000, 2600, [16, 0], '16:00 truck'));
  for (const u of w.units) {
    if (u.id === HERO_UNIT) continue;
    const ms = u.machineIds.slice(0, 2);
    const ratePerH = ms.reduce((a, id) => a + (3600 / w.mould[w.machine[id].mouldId].stdCycle) * w.mould[w.machine[id].mouldId].positions.length, 0);
    const pressure = 1.25 - u.health * 0.35;
    w.orders.push(mkOrder(u, pick(r, ['Orion Motors', 'Nova Appliances', 'Kestrel Two-Wheelers']), ms, Math.round((ratePerH * 6.3 * pressure) / 100) * 100, Math.round(ratePerH * 0.4), [18, 0], '18:00 truck'));
  }

  // workforce (hero unit)
  const roles: [Employee['role'], number][] = [
    ['Operator', 22],
    ['Setter', 3],
    ['QC inspector', 3],
    ['Maintenance', 3],
    ['Tool room', 2],
    ['Supervisor', 2],
  ];
  let eid = 1;
  const heroMs = hero.machineIds;
  for (const sh of ['A', 'B', 'C'] as const) {
    for (const [role, n] of roles) {
      for (let i = 0; i < n; i++) {
        const name = sh === 'A' && role === 'Operator' && i < heroMs.length ? w.machine[heroMs[i]].operator : `${pick(r, 'ABCDGHKMNPRSTV'.split(''))}. ${pick(r, ['Yadav', 'Sharma', 'Rawat', 'Singh', 'Kumar', 'Saini', 'Tomar', 'Bisht', 'Malik', 'Dahiya', 'Rana', 'Mehta', 'Gill', 'Nagar', 'Joshi', 'Dutt'])}`;
        const present = sh !== 'A' ? true : !(role === 'Operator' && (i === 20 || i === 21)) && !(role === 'QC inspector' && i === 2);
        const skill = (k: number) => {
          if (role === 'Operator') return k < 2 ? irange(r, 1, 4) : k === 4 ? irange(r, 0, 2) : irange(r, 0, 3);
          if (role === 'Setter') return k === 2 ? 4 : irange(r, 1, 4);
          if (role === 'QC inspector') return k === 4 ? irange(r, 3, 4) : irange(r, 0, 2);
          return irange(r, 0, 4);
        };
        w.employees.push({
          id: `E${String(eid++).padStart(4, '0')}`,
          name,
          role,
          shift: sh,
          present,
          late: present && r() < 0.06,
          contract: r() < 0.35,
          skills: SKILLS.map((_, k) => skill(k)),
          machineId: sh === 'A' && role === 'Operator' && i < heroMs.length ? heroMs[i] : null,
          goodParts: 0,
          oee: 0,
          rej: 0,
          reasonsOnTime: Math.round(55 + r() * 45),
        });
      }
    }
  }

  // planning board jobs (hero unit, hours from 06:00 today; window 06:00 → 06:00 + 30 h)
  let jid = 48200;
  for (const id of heroMs) {
    const m = w.machine[id];
    let start = range(r, 0, 4);
    for (let j = 0; j < 4; j++) {
      const md = j === 0 ? w.mould[m.mouldId] : pick(r, moulds.filter((x) => x.tonnage <= Math.max(m.tonnage, 250)));
      const p = w.part[md.positions[0].partId];
      const durH = range(r, 4, 10);
      const co = j === 0 ? 0 : md.stdChangeMin / 60;
      const gap = j === 0 ? 0 : range(r, 0.3, 2.2);
      start += co + gap;
      const qty = Math.round(((durH * 3600) / md.stdCycle) * md.positions.length / 100) * 100;
      const due = start + durH + range(r, -1.5, 6);
      w.jobs.push({ id: `WO-${jid++}`, machineId: id, partName: p.name, mouldId: md.id, customer: p.customer, qty, start, dur: durH, changeover: co, due, late: start + durH > due });
      start += durH;
    }
  }

  // held ingest queue (mould setup wizard)
  const hm = (n: number) => ({ id: H(n).id, name: `${H(n).code} · ${H(n).tonnage} T · ${H(n).hall}` });
  const held: HeldIngest[] = [
    { id: 'ING-1001', machine: null, mould: null, parts: {}, mapped: false, promoted: false, heldShots: 318 },
    { id: 'ING-1002', machine: hm(17), mould: null, parts: {}, mapped: false, promoted: false, heldShots: 842 },
    { id: 'ING-1003', machine: hm(18), mould: { name: 'Rear bumper end cap', serial: 'SN-2291', partWeight: '0.255 kg', threshold: '0.02', type: 'family', positions: [{ code: 'LH', qty: 2 }, { code: 'RH', qty: 2 }] }, parts: {}, mapped: false, promoted: false, heldShots: 126 },
    { id: 'ING-1004', machine: hm(19), mould: { name: 'Dashboard trim', serial: 'SN-1187', partWeight: '0.480 kg', threshold: '0.015', type: 'multicavity', positions: [{ code: 'CAV', qty: 4 }] }, parts: { single: { partNumber: 'OM1-77410A', partName: 'Dashboard trim panel' } }, mapped: false, promoted: false, heldShots: 712 },
    { id: 'ING-1005', machine: hm(20), mould: { name: 'Door lid cover', serial: 'SN-0846', partWeight: '0.190 kg', threshold: '0.02', type: 'multicavity', positions: [{ code: 'CAV', qty: 1 }] }, parts: { single: { partNumber: 'NV1-04129A', partName: 'Door lid cover' } }, mapped: true, promoted: false, heldShots: 1204 },
  ];
  w.held = held;
  return w;
}
