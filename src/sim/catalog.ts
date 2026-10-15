import type { MState, Stage, TeamId } from './types';

export const TENANT = {
  name: 'Apex Polymers Group',
  short: 'Apex Polymers',
  initials: 'AP',
};

export const SHIFT_LEN = 8 * 3600;
export const DAY = 24 * 3600;
export const shiftOf = (t: number): 'A' | 'B' | 'C' => (t < SHIFT_LEN ? 'A' : t < 2 * SHIFT_LEN ? 'B' : 'C');
export const shiftStartOf = (t: number) => Math.floor(t / SHIFT_LEN) * SHIFT_LEN;
export const SHIFT_WINDOWS = { A: '06:00–14:00', B: '14:00–22:00', C: '22:00–06:00' } as const;

export const TEAMS: Record<TeamId, { label: string; color: string; short: string }> = {
  maintenance: { label: 'Maintenance', color: '#F97316', short: 'MAINT' },
  toolroom: { label: 'Tool room', color: '#3B82F6', short: 'TOOL' },
  mouldchange: { label: 'Mould change', color: '#A855F7', short: 'MC' },
  store: { label: 'Material store', color: '#0F9D8F', short: 'STORE' },
  quality: { label: 'Quality', color: '#DB2777', short: 'QA' },
  utilities: { label: 'Utilities', color: '#8B5E34', short: 'UTIL' },
  planning: { label: 'Planning · no job', color: '#6B7079', short: 'PPC' },
  production: { label: 'Production · no operator', color: '#E5B000', short: 'PROD' },
};
export const TICKET_TEAMS: TeamId[] = ['maintenance', 'toolroom', 'mouldchange', 'store', 'quality', 'utilities', 'planning'];

export const STATE_META: Record<MState, { label: string; v: string; hexDark: string; hexLight: string }> = {
  RUN: { label: 'Running', v: 'run', hexDark: '#34C77B', hexLight: '#1E9E57' },
  IDLE: { label: 'Idle', v: 'idle', hexDark: '#FFC233', hexLight: '#E5B000' },
  MC: { label: 'Mould change', v: 'mould', hexDark: '#5B8DFF', hexLight: '#2F6FEB' },
  DOWN: { label: 'Down', v: 'down', hexDark: '#FF5A47', hexLight: '#D8382B' },
  OFF: { label: 'Offline', v: 'off', hexDark: '#4A4F57', hexLight: '#9AA0A8' },
};

export const STAGE_META: Record<Stage, { label: string; short: string }> = {
  unassigned: { label: 'Stopped · not assigned', short: 'NOT ASSIGNED' },
  assigned: { label: 'Assigned · not arrived', short: 'ASSIGNED' },
  working: { label: 'Team working', short: 'WORKING' },
  spare: { label: 'Waiting for spare', short: 'WAITING FOR SPARE' },
  verify: { label: 'Fixed · verify', short: 'VERIFY FIX' },
  closed: { label: 'Closed', short: 'CLOSED' },
};

/** Downtime master: code, name, owning team, symptom chip */
export const DOWN_REASONS: { code: string; name: string; team: TeamId; symptom: string; spare?: [string, string, string, number] }[] = [
  { code: 'MM-04', name: 'Heater band failure', team: 'maintenance', symptom: 'Heater alarm', spare: ['SP-HB-450-60', 'Heater band 450 W, Ø60', 'B-14', 6] },
  { code: 'MM-07', name: 'Thermocouple open', team: 'maintenance', symptom: 'Heater alarm', spare: ['SP-TC-J6', 'Thermocouple J-type 6 mm', 'B-09', 22] },
  { code: 'MM-11', name: 'Hydraulic leak', team: 'maintenance', symptom: 'Hydraulic leak', spare: ['SP-HS-12', 'Hydraulic hose 12 mm', 'C-03', 9] },
  { code: 'MM-15', name: 'Robot gripper fault', team: 'maintenance', symptom: 'Robot fault', spare: ['SP-VG-40', 'Vacuum gripper pad 40 mm', 'D-11', 31] },
  { code: 'TM-11', name: 'Mould water leak', team: 'toolroom', symptom: 'Water leak', spare: ['SP-WH-12', 'Water hose 12 mm', 'A-07', 14] },
  { code: 'TM-03', name: 'Ejector pin stuck', team: 'toolroom', symptom: 'Mould stuck', spare: ['SP-EP-8', 'Ejector pin Ø8', 'A-02', 40] },
  { code: 'TM-06', name: 'Flash on parting line', team: 'toolroom', symptom: 'Flash' },
  { code: 'UT-05', name: 'Chiller trip', team: 'utilities', symptom: 'Chiller pressure low' },
  { code: 'UT-02', name: 'Compressor pressure low', team: 'utilities', symptom: 'Air pressure low' },
  { code: 'QA-02', name: 'Short shots · process', team: 'quality', symptom: 'Short shot' },
  { code: 'MS-01', name: 'Material contamination', team: 'store', symptom: 'Black dots' },
];
export const SYMPTOMS = ['Heater alarm', 'Hydraulic leak', 'Short shot', 'Mould stuck', 'No material', 'Robot fault', 'Water leak', 'Flash', 'Chiller pressure low'];

export const IDLE_REASONS: { name: string; team: TeamId }[] = [
  { name: 'No material', team: 'store' },
  { name: 'Operator break', team: 'production' },
  { name: 'Waiting crane', team: 'production' },
  { name: 'Waiting for QC', team: 'quality' },
  { name: 'No operator', team: 'production' },
  { name: 'Dryer not ready', team: 'store' },
];

/** Big chips for "Log reason" */
export const LOG_REASONS: { name: string; team: TeamId; code: string }[] = [
  { name: 'Heater / electrical', team: 'maintenance', code: 'MM-04' },
  { name: 'Hydraulic leak', team: 'maintenance', code: 'MM-11' },
  { name: 'Mould water leak', team: 'toolroom', code: 'TM-11' },
  { name: 'Ejector / mould stuck', team: 'toolroom', code: 'TM-03' },
  { name: 'Material shortage', team: 'store', code: 'MS-01' },
  { name: 'Waiting for QC', team: 'quality', code: 'QA-02' },
  { name: 'Chiller / utilities', team: 'utilities', code: 'UT-05' },
  { name: 'Mould change overrun', team: 'mouldchange', code: 'MC-03' },
  { name: 'No operator', team: 'production', code: 'PR-01' },
  { name: 'No plan / no job', team: 'planning', code: 'PL-01' },
];

export const DEFECTS = ['Short shot', 'Flash', 'Sink mark', 'Warpage', 'Silver streak', 'Black dot', 'Weld line', 'Bend', 'Scratch & damage'];

export const MAKES = ['Engel', 'Haitian', 'JSW', 'Arburg', 'Toshiba', 'Milacron', 'Sumitomo', 'Windsor', 'Chen Hsong', 'Toyo'];
export const TONNAGES = [150, 180, 220, 250, 350, 450, 550, 650];

export const OPERATORS = [
  'R. Singh', 'P. Kumar', 'S. Devi', 'A. Khan', 'M. Rawat', 'V. Sharma', 'N. Joshi', 'K. Iyer', 'T. Nair', 'G. Reddy',
  'B. Das', 'H. Patil', 'J. Menon', 'L. Ghosh', 'R. Pandey', 'S. Mishra', 'A. Verma', 'K. Rao', 'M. Pillai', 'D. Chauhan',
  'F. Shaikh', 'Y. Bhat', 'P. Naidu', 'C. Mohan', 'R. Kaur', 'S. Bose', 'U. Jadhav', 'I. Ansari', 'V. Kamath', 'E. Thomas',
  'N. Saini', 'O. Mehra', 'Z. Hussain', 'A. Gowda', 'T. Sen', 'B. Yadav', 'K. Murthy', 'H. Dutta', 'M. Kale', 'R. Chandra',
];
export const TECHS: Record<TeamId, string[]> = {
  maintenance: ['S. Pillai', 'R. Gupta', 'M. Faisal'],
  toolroom: ['V. Shetty', 'A. Lobo'],
  mouldchange: ['Setup team · K. Rawat'],
  store: ['Stores · P. Dixit'],
  quality: ['QA · N. Kapoor'],
  utilities: ['Utilities · J. Kumar'],
  planning: ['PPC · S. Arora'],
  production: ['Supervisor'],
};

export const CUSTOMERS = ['Orion Motors', 'Nova Appliances', 'Kestrel Two-Wheelers'] as const;

/** name, weight g, customer idx, material, sell ₹, family positions */
export const PART_CATALOG: [string, number, number, string, number, string[]?][] = [
  ['Bumper bracket', 250, 0, 'PP-TD20', 118],
  ['Lamp housing', 182, 0, 'PC', 164],
  ['Door trim', 640, 0, 'PP', 312, ['LH', 'RH']],
  ['Fan shroud', 820, 0, 'PP-TD20', 286],
  ['Glove box lid', 410, 0, 'ABS', 226],
  ['Air vent', 64, 0, 'ABS', 58],
  ['Wheel arch liner', 910, 0, 'HDPE', 248],
  ['Battery tray', 1150, 0, 'PP-GF30', 342],
  ['Console bin', 380, 0, 'ABS', 196],
  ['Cowl top garnish', 520, 0, 'PP', 214],
  ['Pillar trim', 210, 0, 'PP', 92, ['LH', 'RH']],
  ['Tail lamp bezel', 96, 0, 'PC', 88],
  ['Radiator grille', 680, 0, 'ABS', 402],
  ['Seat back cover', 450, 0, 'PP', 178],
  ['Mud flap', 280, 0, 'TPO', 74, ['LH', 'RH']],
  ['Door lid cover', 190, 1, 'PP', 64],
  ['Stand tray', 520, 1, 'PP', 132],
  ['Washer lid', 760, 1, 'PP', 214],
  ['Crisper drawer', 640, 1, 'GPPS', 186],
  ['Control panel fascia', 210, 1, 'ABS', 142],
  ['AC front grille', 830, 1, 'ABS', 296],
  ['Detergent drawer', 140, 1, 'PP', 52],
  ['Fan blade', 220, 1, 'AS', 84],
  ['Side panel', 330, 2, 'PP', 168, ['LH', 'RH']],
  ['Front fender', 410, 2, 'PP', 154],
  ['Chain guard', 160, 2, 'PP', 48],
  ['Visor', 120, 2, 'PC', 96],
  ['Tail cover', 240, 2, 'ABS', 112, ['LH', 'CTR', 'RH']],
  ['Speedo housing', 90, 2, 'ABS', 72],
  ['Headlamp bezel', 110, 2, 'PC', 98],
];
export const MODELS = [['OM-S7', 'OM-X3', 'OM-C2'], ['NV-W8', 'NV-F2', 'NV-A5'], ['KT-125', 'KT-160', 'KT-200']];

export const SKILLS = ['≤250 T', '350–650 T', 'Mould setting', 'Robot', 'QC inspection', 'Crane', 'Process tuning', 'First aid'];

export const TRANSPORTERS = ['VRL Logistics', 'Safexpress', 'Om Logistics', 'TCI Freight', 'Gati', 'Delhivery', 'Rivigo', 'Blue Dart'];
export const SUPPLIERS = ['Reliance Polymers (PP)', 'Haldia Petrochemicals', 'GAIL (HDPE)', 'Supreme Petrochem (GPPS)', 'Deepak Phenolics'];
