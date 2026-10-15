import { Activity, Bell, Boxes, Brain, Factory, Gauge, Home, IndianRupee, LayoutGrid, Map, MonitorPlay, Smartphone, Truck, Users, Wrench, Zap, CalendarRange, ListChecks, Layers3, PackageSearch } from 'lucide-react';
import type { ModuleId } from '../sim/store';

export interface NavItem {
  label: string;
  to: string;
  icon: typeof Home;
  mod?: ModuleId;
  match?: string;
  group?: string;
}

export const NAV: NavItem[] = [
  { label: 'Home', to: '/home', icon: Home },
  { label: 'Money', to: '/money', icon: IndianRupee, mod: 'money', match: '/money|/briefing' },
  { label: 'Roll-up map', to: '/rollup', icon: Map },
  { label: 'Digital twin', to: '/twin/MN1', icon: Layers3, match: '/twin' },
  { label: 'Unit dashboard', to: '/unit/MN1', icon: Gauge, group: 'Production', match: '/unit' },
  { label: 'Machines', to: '/machine/MN1-05', icon: Factory, group: 'Production', match: '/machine' },
  { label: 'Records', to: '/records', icon: ListChecks, group: 'Production' },
  { label: 'Breakdowns', to: '/breakdowns', icon: Wrench, mod: 'breakdown' },
  { label: 'Moulds', to: '/moulds', icon: Boxes, mod: 'mould' },
  { label: 'Mould setup queue', to: '/mould-setup', icon: PackageSearch },
  { label: 'Planning', to: '/planning', icon: CalendarRange, mod: 'planning' },
  { label: 'People', to: '/people', icon: Users, mod: 'people' },
  { label: 'Energy', to: '/energy', icon: Zap, mod: 'energy' },
  { label: 'Dispatch & Gate', to: '/dispatch', icon: Truck, mod: 'dispatch' },
  { label: 'Alerts', to: '/alerts', icon: Bell },
  { label: 'Ask IMMDATA', to: '/ask', icon: Brain, mod: 'ai' },
  { label: 'Mobile apps', to: '/mobile', icon: Smartphone, mod: 'mobile' },
  { label: 'Modules & plans', to: '/modules', icon: LayoutGrid },
];

export const TV_ITEM = { label: 'Shopfloor TV mode', to: '/tv', icon: MonitorPlay, mod: 'tv' as ModuleId };
export const ActivityIcon = Activity;
