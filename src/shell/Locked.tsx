import { motion } from 'framer-motion';
import { Lock, MessageCircle, Unlock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { MODULES, useSim, type ModuleId } from '../sim/store';
import { EASE } from '../ui/primitives';
import { notify } from './Toasts';

/** Tasteful locked-module state: value prop, static preview, "Talk to us" and a demo unlock. */
export default function Locked({ mod: modProp }: { mod?: ModuleId }) {
  const params = useParams();
  const nav = useNavigate();
  const mod = (modProp ?? params.mod) as ModuleId;
  const meta = MODULES.find((m) => m.id === mod);
  const toggle = useSim((s) => s.toggleModule);
  if (!meta) return null;
  return (
    <div className="relative flex min-h-[calc(100vh-56px)] items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-4 p-8 opacity-[0.18] blur-[6px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="glass h-40" />
        ))}
      </div>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, ease: EASE }} className="glass-strong relative max-w-lg rounded-[16px] p-8 text-center shadow-[var(--shadow)]">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-line2 bg-panel2">
          <Lock size={22} className="text-fg2" />
        </div>
        <div className="overline mb-1">{meta.code} · add-on module</div>
        <h1 className="num text-[30px] font-bold leading-9">{meta.name}</h1>
        <p className="mt-2 text-[15px] text-fg2">{meta.promise}.</p>
        <p className="mt-3 text-[13px] text-fg3">This module isn’t on Apex Polymers’ plan yet. Turn it on for a 30-day trial or talk to us about the Enterprise bundle.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            className="btn btn-primary"
            onClick={() => {
              toggle(mod);
              notify({ tone: 'run', title: `${meta.name} unlocked`, body: '30-day trial started · nav updated' });
              nav(-1);
            }}
          >
            <Unlock size={14} /> Start 30-day trial
          </button>
          <button className="btn btn-ghost" onClick={() => notify({ tone: 'info', title: 'Request sent to AGG Technology', body: 'Your account manager will call within 1 working day' })}>
            <MessageCircle size={14} /> Talk to us
          </button>
          <button className="btn btn-ghost" onClick={() => nav('/modules')}>
            See all modules
          </button>
        </div>
      </motion.div>
    </div>
  );
}
