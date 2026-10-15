import { create } from 'zustand';
import { createWorld } from './world';
import { step, type World } from './engine';
import type { RoleId } from './types';
import type { ValueBasis } from './kpi';

export type Scope = { kind: 'corp' } | { kind: 'org'; id: string } | { kind: 'unit'; id: string };

export const MODULES = [
  { id: 'core', code: 'Core', name: 'Core platform', promise: 'Live monitoring, masters, alerts, reports, audit', core: true },
  { id: 'tv', code: 'M1', name: 'Shopfloor TV', promise: 'Every hall sees the truth on a wall' },
  { id: 'breakdown', code: 'M2', name: 'Downtime & Breakdown', promise: 'Every stop has an owner and a root cause' },
  { id: 'quality', code: 'M3', name: 'Quality & Traceability', promise: 'Every part traceable; scrap caught before it is made' },
  { id: 'process', code: 'M4', name: 'Process Monitoring & SPC', promise: 'Parameters inside the window, drift caught early' },
  { id: 'mould', code: 'M5', name: 'Mould Management', promise: 'Moulds maintained by shots, changeovers measured' },
  { id: 'pm', code: 'M6', name: 'PM & Spares', promise: 'Machines maintained before they break' },
  { id: 'planning', code: 'M7', name: 'Planning & Scheduling', promise: 'Right job, right machine, right time' },
  { id: 'people', code: 'M8', name: 'People & Shift', promise: 'Right people, right skills, every shift' },
  { id: 'material', code: 'M9', name: 'Material & Inventory', promise: 'Resin and regrind under control' },
  { id: 'energy', code: 'M10', name: 'Energy & Utilities', promise: '₹ of power per part, peaks avoided' },
  { id: 'dispatch', code: 'M11', name: 'Dispatch & Gate', promise: 'Every truck on time and full' },
  { id: 'money', code: 'M12', name: 'Money View (CEO)', promise: 'Losses in rupees with owners' },
  { id: 'ai', code: 'M13', name: 'AI Copilot & Insights', promise: 'Answers and decisions, not just dashboards' },
  { id: 'integrations', code: 'M14', name: 'Integrations Hub', promise: 'ERP, HRMS, Tally, WhatsApp - no retyping' },
  { id: 'compliance', code: 'M15', name: 'Compliance & Audit', promise: 'IATF / 4M audit-ready any day' },
  { id: 'safety', code: 'M16', name: 'Safety & EHS', promise: 'Zero harm, visible' },
  { id: 'esg', code: 'M17', name: 'Sustainability / ESG', promise: 'Carbon per part for customers' },
  { id: 'portal', code: 'M18', name: 'Customer Portal', promise: 'OEM customers see their parts’ status' },
  { id: 'mobile', code: 'M19', name: 'Mobile apps (PWAs)', promise: 'Bundled with modules for every role' },
] as const;
export type ModuleId = (typeof MODULES)[number]['id'];

export const ROLES: Record<RoleId, { label: string; name: string; title: string; home: string; ini: string }> = {
  ceo: { label: 'Owner / CEO', name: 'Vikram Rao', title: 'Managing Director', home: '/money', ini: 'VR' },
  director: { label: 'Director Ops', name: 'Neha Sethi', title: 'Director Operations', home: '/home', ini: 'NS' },
  planthead: { label: 'Plant head', name: 'Imran Qureshi', title: 'Plant head · Manesar U1', home: '/unit/MN1', ini: 'IQ' },
  supervisor: { label: 'Supervisor', name: 'Ravi Tomar', title: 'Shift supervisor · Manesar U1', home: '/breakdowns', ini: 'RT' },
  technician: { label: 'Maintenance tech', name: 'Suresh Pillai', title: 'Maintenance technician', home: '/breakdowns?view=tech', ini: 'SP' },
};

interface SimState {
  world: World;
  version: number;
  speed: number;
  paused: boolean;
  theme: 'dark' | 'light';
  calm: boolean;
  sound: boolean;
  role: RoleId;
  scope: Scope;
  modules: Record<ModuleId, boolean>;
  basis: ValueBasis;
  entered: boolean;
  paletteOpen: boolean;
  demoOpen: boolean;
  tourOn: boolean;
  sidebarCollapsed: boolean;
  lastTick: number;
  tick: () => void;
  bump: () => void;
  act: (fn: (w: World) => void) => void;
  set: (p: Partial<SimState>) => void;
  toggleModule: (id: ModuleId) => void;
  reset: () => void;
}

const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem('immdata.prefs.v2') ?? '{}') as Partial<SimState>;
  } catch {
    return {};
  }
})();

const allModules = Object.fromEntries(MODULES.map((m) => [m.id, true])) as Record<ModuleId, boolean>;
// a few add-ons start locked to show the upsell state
allModules.compliance = false;
allModules.safety = false;
allModules.esg = false;
allModules.portal = false;
allModules.material = false;

export const useSim = create<SimState>((set, get) => ({
  world: createWorld(),
  version: 0,
  speed: 1,
  paused: false,
  theme: (saved.theme as 'dark' | 'light') ?? 'light',
  calm: saved.calm ?? !!reducedMotion,
  sound: false,
  role: 'director',
  scope: { kind: 'corp' },
  modules: { ...allModules, ...(saved.modules ?? {}) },
  basis: 'cm',
  entered: false,
  paletteOpen: false,
  demoOpen: false,
  tourOn: false,
  sidebarCollapsed: false,
  lastTick: Date.now(),
  tick: () => {
    const s = get();
    if (s.paused) return;
    step(s.world, s.speed);
    set({ version: s.version + 1, lastTick: Date.now() });
  },
  bump: () => set({ version: get().version + 1 }),
  act: (fn) => {
    fn(get().world);
    set({ version: get().version + 1 });
  },
  set: (p) => {
    set(p);
    if ('theme' in p || 'calm' in p || 'modules' in p) {
      const { theme, calm, modules } = get();
      try {
        localStorage.setItem('immdata.prefs.v2', JSON.stringify({ theme, calm, modules }));
      } catch {
        /* storage unavailable */
      }
    }
  },
  toggleModule: (id) => {
    if (id === 'core') return;
    get().set({ modules: { ...get().modules, [id]: !get().modules[id] } });
  },
  reset: () => set({ world: createWorld(), version: get().version + 1 }),
}));

/** Subscribe to simulator ticks and get the (mutable) world. */
export function useWorld() {
  useSim((s) => s.version);
  return useSim.getState().world;
}
