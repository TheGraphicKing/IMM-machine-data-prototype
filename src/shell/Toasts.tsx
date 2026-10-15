import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSim } from '../sim/store';
import type { Toast } from '../sim/types';
import { EASE } from '../ui/primitives';

let ctx: AudioContext | null = null;
function chime(tone: Toast['tone']) {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = tone === 'down' ? 660 : 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.55);
  } catch {
    /* audio unavailable */
  }
}

/** Push a UI toast from anywhere (not tied to the simulator). */
export function notify(t: Omit<Toast, 'id'>) {
  const w = useSim.getState().world;
  w.toasts.push({ ...t, id: `U${Date.now()}${Math.random().toString(36).slice(2, 5)}` });
  useSim.getState().bump();
}

export default function Toasts() {
  const version = useSim((s) => s.version);
  const sound = useSim((s) => s.sound);
  const [list, setList] = useState<Toast[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    const w = useSim.getState().world;
    if (!w.toasts.length) return;
    const fresh = w.toasts.splice(0, w.toasts.length);
    if (sound) chime(fresh[fresh.length - 1].tone);
    setList((l) => [...fresh.reverse(), ...l].slice(0, 4));
    for (const t of fresh) setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), t.tone === 'down' ? 7000 : 5000);
  }, [version, sound]);

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[90] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const Icon = t.tone === 'down' || t.tone === 'idle' ? AlertTriangle : t.tone === 'run' ? CheckCircle2 : Info;
          const c = t.tone === 'info' ? 'var(--fg2)' : `var(--${t.tone})`;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ duration: 0.38, ease: EASE }}
              className="glass-strong pointer-events-auto flex cursor-pointer gap-3 overflow-hidden rounded-[10px] p-3 pr-2 shadow-[var(--shadow)]"
              style={{ borderLeft: `4px solid rgb(${c})` }}
              onClick={() => {
                if (t.href) nav(t.href);
                setList((l) => l.filter((x) => x.id !== t.id));
              }}
            >
              <Icon size={18} className="mt-0.5 shrink-0" style={{ color: `rgb(${c})` }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold leading-5">{t.title}</div>
                {t.body && <div className="truncate text-[12px] text-fg3">{t.body}</div>}
              </div>
              <button
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg3 hover:text-fg"
                onClick={(e) => {
                  e.stopPropagation();
                  setList((l) => l.filter((x) => x.id !== t.id));
                }}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
