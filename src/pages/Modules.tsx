import { motion } from 'framer-motion';
import { Check, Lock, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MODULES, useSim, type ModuleId } from '../sim/store';
import { cx } from '../lib/format';
import { EASE } from '../ui/primitives';
import { notify } from '../shell/Toasts';

const PLANS: { id: string; name: string; tag: string; mods: ModuleId[] }[] = [
  { id: 'starter', name: 'Starter', tag: 'See every machine live', mods: ['core', 'tv', 'breakdown', 'mobile'] },
  { id: 'growth', name: 'Growth', tag: 'Quality, process and moulds', mods: ['core', 'tv', 'breakdown', 'mobile', 'quality', 'process', 'mould', 'pm'] },
  { id: 'enterprise', name: 'Enterprise', tag: 'Plan, people, energy, money, AI', mods: ['core', 'tv', 'breakdown', 'mobile', 'quality', 'process', 'mould', 'pm', 'planning', 'people', 'material', 'energy', 'dispatch', 'money', 'ai', 'integrations'] },
];
const ADDONS: ModuleId[] = ['compliance', 'safety', 'esg', 'portal'];
const ROUTE: Partial<Record<ModuleId, string>> = { tv: '/tv', breakdown: '/breakdowns', quality: '/records', process: '/machine/MN1-05', mould: '/moulds', pm: '/moulds', planning: '/planning', people: '/people', energy: '/energy', dispatch: '/dispatch', money: '/money', ai: '/ask', mobile: '/mobile', core: '/home' };

export default function Modules() {
  const { modules, set, toggleModule } = useSim();
  const nav = useNavigate();
  const on = MODULES.filter((m) => modules[m.id]).length;
  const applyPlan = (mods: ModuleId[]) => {
    const next = Object.fromEntries(MODULES.map((m) => [m.id, mods.includes(m.id)])) as Record<ModuleId, boolean>;
    set({ modules: next });
  };
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">IMMDATA · modular SaaS by AGG Technology</div>
          <h1 className="num mt-1 text-[26px] font-bold leading-10">Buy only the modules you need</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-fg2">A Core every plant gets, plus add-ons that switch on per tenant. Toggle a module and watch the sidebar, routes and screens update live — locked modules show a tasteful “Unlock” state everywhere.</p>
        </div>
        <div className="glass !rounded-[12px] px-4 py-3 text-center">
          <div className="num text-[24px] font-bold">{on} / {MODULES.length}</div>
          <div className="text-[12px] text-fg3">modules enabled for Apex Polymers</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {PLANS.map((p, i) => {
          const active = p.mods.every((m) => modules[m]) && MODULES.filter((m) => modules[m.id] && !p.mods.includes(m.id) && !ADDONS.includes(m.id)).length === 0;
          return (
            <motion.button key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ y: -3 }} onClick={() => (applyPlan(p.mods), notify({ tone: 'run', title: `${p.name} plan applied`, body: `${p.mods.length} modules · sidebar updated` }))} className={cx('glass relative flex flex-col gap-2 overflow-hidden !rounded-[14px] p-5 text-left', active && '!border-brand')}>
              {p.id === 'enterprise' && <span className="absolute right-3 top-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-ink">MOST POPULAR</span>}
              <div className="num text-[20px] font-bold">{p.name}</div>
              <div className="text-[13px] text-fg2">{p.tag}</div>
              <div className="mt-1 text-[12px] text-fg3">{p.mods.length} modules · priced per connected machine / month</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.mods.map((m) => (
                  <span key={m} className="rounded bg-panel3 px-1.5 py-0.5 text-[10px] font-semibold text-fg2">{MODULES.find((x) => x.id === m)?.code}</span>
                ))}
              </div>
              <span className={cx('mt-3 inline-flex h-9 w-fit items-center gap-2 rounded-md px-3 text-[13px] font-semibold', active ? 'bg-brand text-ink' : 'border border-line2')}>{active ? <><Check size={14} />Current plan</> : 'Apply plan'}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {MODULES.map((m, i) => {
          const enabled = modules[m.id];
          const core = 'core' in m && m.core;
          return (
            <motion.div key={m.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.025, ease: EASE }} className={cx('glass spotlight flex flex-col gap-2 !rounded-[12px] p-4 transition', !enabled && 'opacity-70')}>
              <div className="flex items-center justify-between">
                <span className="num rounded bg-panel3 px-2 py-0.5 text-[12px] font-bold">{m.code}</span>
                <button
                  onClick={() => (core ? notify({ tone: 'info', title: 'Core is always on', body: 'Live monitoring, masters, alerts, reports and audit' }) : (toggleModule(m.id), notify({ tone: enabled ? 'info' : 'run', title: `${m.name} ${enabled ? 'turned off' : 'turned on'}`, body: enabled ? 'Nav item now shows a lock' : 'Nav item unlocked' })))}
                  className={cx('relative h-6 w-11 rounded-full transition', enabled ? 'bg-run' : 'bg-line2', core && 'opacity-60')}
                  aria-pressed={enabled}
                  aria-label={`Toggle ${m.name}`}
                >
                  <motion.span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" animate={{ left: enabled ? 22 : 2 }} transition={{ duration: 0.25, ease: EASE }} />
                </button>
              </div>
              <div className="num text-[19px] font-semibold leading-6">{m.name}</div>
              <div className="text-[13px] text-fg2">{m.promise}</div>
              <div className="mt-auto flex items-center justify-between pt-2 text-[12px]">
                {enabled ? (
                  ROUTE[m.id] ? (
                    <button className="font-semibold text-brand hover:underline" onClick={() => nav(ROUTE[m.id]!)}>Open →</button>
                  ) : (
                    <span className="text-fg3">Included · configured in Settings</span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 text-fg3"><Lock size={12} />Locked</span>
                )}
                {ADDONS.includes(m.id) && <span className="rounded bg-mould/15 px-1.5 py-0.5 text-[10px] font-semibold text-mould-t">ADD-ON</span>}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="glass flex flex-wrap items-center justify-between gap-3 !rounded-[14px] p-5">
        <div>
          <div className="num text-[16px] font-semibold">Retrofit any machine, any brand</div>
          <div className="text-[13px] text-fg2">A Raspberry Pi gateway per machine reads OPC UA / EUROMAP 77 / 63 / Modbus / digital I/O · store-and-forward · Indian ERPs (TARKA, Tally, SAP B1, Zoho) · WhatsApp + SMS alerts.</div>
        </div>
        <button className="btn btn-primary" onClick={() => notify({ tone: 'run', title: 'Request sent to AGG Technology', body: 'A solutions engineer will reach out within 1 working day' })}><MessageCircle size={14} />Talk to us</button>
      </div>
    </div>
  );
}
