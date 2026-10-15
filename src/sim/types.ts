export type MState = 'RUN' | 'IDLE' | 'MC' | 'DOWN' | 'OFF';
export type TeamId = 'maintenance' | 'toolroom' | 'mouldchange' | 'store' | 'quality' | 'utilities' | 'planning' | 'production';
export type Stage = 'unassigned' | 'assigned' | 'working' | 'spare' | 'verify' | 'closed';
export type Severity = 'critical' | 'warning' | 'info';
export type RoleId = 'ceo' | 'director' | 'planthead' | 'supervisor' | 'technician';

export interface Org {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  head: string;
  unitIds: string[];
}

export interface Unit {
  id: string;
  orgId: string;
  name: string;
  code: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  halls: string[];
  machineIds: string[];
  head: string;
  /** performance character 0..1 (1 = best) used by the simulator */
  health: number;
}

export interface Part {
  id: string;
  number: string;
  erp: string;
  name: string;
  customer: string;
  model: string;
  colour: string;
  material: string;
  weight: number; // g
  tol: number; // g
  sell: number; // ₹ per part
  material$: number; // ₹ per part
  conv: number; // variable conversion ₹ per part
}

export interface MouldPos {
  code: string; // LH, RH, CTR, A, B ...
  partId: string;
}

export interface Mould {
  id: string; // M-1420
  name: string;
  serial: string;
  type: 'family' | 'multi';
  positions: MouldPos[]; // one entry per cavity
  blocked: boolean[];
  stdCycle: number; // s
  tonnage: number; // required
  pmInterval: number; // shots
  shotsSincePM: number;
  lifetime: number;
  location: string; // machine id or rack
  status: 'production' | 'storage' | 'toolroom' | 'customer';
  owner: 'own' | 'customer';
  customer: string;
  stdChangeMin: number;
}

export interface Segment {
  s: MState;
  start: number;
  end: number;
  team?: TeamId | null;
  stage?: Stage;
  reason?: string;
  ticketId?: string;
}

export interface Params {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
  nozzle: number;
  mouldTemp: number;
  injP: number;
  holdP: number;
  injSpeed: number;
  cushion: number;
  cooling: number;
  clamp: number;
}

export interface Machine {
  id: string;
  code: string; // IMM-07
  unitId: string;
  hall: string;
  tonnage: number;
  make: string;
  year: number;
  mouldId: string;
  wo: string;
  woQty: number;
  operator: string;
  cycleFactor: number; // actual/std
  rejBase: number; // fraction
  rejSpike: number; // extra fraction (decays)
  state: MState;
  since: number;
  reason: string;
  reasonLogged: boolean;
  team: TeamId | null;
  ticketId: string | null;
  nextAt: number; // scheduled end for IDLE / MC
  nextMouldId: string | null;
  nextMCAt: number;
  // shift accumulators
  plannedSec: number;
  capParts: number; // parts possible at std cycle while planned
  runStdParts: number; // parts possible at std cycle while running
  stdShotSec: number; // Σ shots × std cycle
  runSec: number;
  idleSec: number;
  downSec: number;
  mcSec: number;
  shots: number;
  parts: number;
  bad: number;
  hourly: number[];
  hourlyBad: number[];
  kwh: number;
  kwhIdle: number;
  kw: number;
  ratedKw: number;
  timeline: Segment[];
  set: Params;
  act: Params;
  cycleHist: number[];
  weightHist: number[];
  shotCounter: number;
  hot: boolean; // zone 4 overheating drift
  hero?: boolean;
  hold?: boolean; // ticket auto-progress disabled (scripted scenario)
  mcDone: number; // mould changes completed this shift
}

export interface TicketEvent {
  t: number;
  stage: Stage | 'transfer' | 'rejected' | 'note';
  by: string;
  note: string;
}

export interface Ticket {
  id: string;
  machineId: string;
  unitId: string;
  stage: Stage;
  team: TeamId | null;
  assignee: string | null;
  symptom: string;
  rootCause: string;
  action: string;
  spares: { code: string; name: string; qty: number; bin: string; stock: number }[];
  createdAt: number;
  stageAt: number;
  closedAt: number | null;
  history: TicketEvent[];
  photos: number;
  hold: boolean;
  plan: { assign: number; arrive: number; work: number; spare: number; verify: number };
}

export interface AlertEvent {
  t: number;
  tone: 'down' | 'idle' | 'mould' | 'run' | 'muted';
  msg: string;
}

export type AlertType =
  | 'Machine stopped'
  | 'Cycle time drift'
  | 'Reject rate'
  | 'Part weight'
  | 'Process param'
  | 'Mould maintenance'
  | 'Behind target'
  | 'Truck waiting'
  | 'Data gap';

export interface Alert {
  id: string;
  type: AlertType;
  severity: Severity;
  title: string;
  unitId: string;
  machineId?: string;
  t: number;
  status: 'open' | 'ack' | 'resolved';
  ackBy?: string;
  escalated?: boolean;
  timeline: AlertEvent[];
  notified: string;
}

export interface Truck {
  id: string;
  unitId: string;
  plate: string;
  transporter: string;
  dir: 'IN' | 'OUT';
  party: string;
  partyShort: string;
  doc: string;
  gateIn: number;
  status: string;
  phaseAt: number;
  phase: 0 | 1 | 2 | 3; // waiting, loading, docs, left
  dueOut: number;
  out: number | null;
  delayed?: boolean;
}

export interface Order {
  id: string;
  unitId: string;
  customer: string;
  partId: string;
  machineIds: string[];
  qty: number;
  stock: number;
  due: number; // sim seconds of the day
  truck: string;
}

export interface ShiftSummary {
  label: string;
  out: number;
  plan: number;
  oee: number;
  rej: number;
}

export interface Employee {
  id: string;
  name: string;
  role: 'Operator' | 'Setter' | 'QC inspector' | 'Maintenance' | 'Tool room' | 'Supervisor';
  shift: 'A' | 'B' | 'C';
  present: boolean;
  late: boolean;
  contract: boolean;
  skills: number[]; // per skill 0-4
  machineId: string | null;
  goodParts: number;
  oee: number;
  rej: number;
  reasonsOnTime: number;
}

export interface Job {
  id: string;
  machineId: string;
  partName: string;
  mouldId: string;
  customer: string;
  qty: number;
  start: number; // hours from now-ish (planning board coordinates, h from 06:00 today)
  dur: number; // hours
  changeover: number; // hours before start
  due: number; // h
  late?: boolean;
}

export interface Toast {
  id: string;
  tone: 'down' | 'idle' | 'mould' | 'run' | 'info';
  title: string;
  body?: string;
  href?: string;
}

export interface HeldIngest {
  id: string;
  machine: { id: string; name: string } | null;
  mould: {
    name: string;
    serial: string;
    partWeight: string;
    threshold: string;
    type: 'family' | 'multicavity';
    positions: { code: string; qty: number }[];
  } | null;
  parts: Record<string, { partNumber: string; partName: string }>;
  mapped: boolean;
  promoted: boolean;
  heldShots: number;
}
