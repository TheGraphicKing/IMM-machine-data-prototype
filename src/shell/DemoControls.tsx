import { AnimatePresence, motion } from 'framer-motion';
import { FastForward, Hammer, Pause, Play, RotateCcw, Truck, Wrench, X, Zap } from 'lucide-react';
import { useSim } from '../sim/store';
import { demoBreak, demoFixAll, demoRejects, demoTruckDelay } from '../sim/actions';
import { cx } from '../lib/format';
import { EASE } from '../ui/primitives';

export default function DemoControls() {
  const { demoOpen, speed, paused, set, reset } = useSim();
  return (
    <AnimatePresence>
      {demoOpen && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="glass-strong fixed bottom-4 left-1/2 z-[85] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 rounded-[14px] p-3 shadow-[var(--shadow)]"
          role="dialog"
          aria-label="Demo controls"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="eyebrow !text-brand">Demo controls</span>
              <span className="text-[12px] text-fg3">Presenter panel · press D to hide</span>
            </div>
            <button className="grid h-7 w-7 place-items-center rounded text-fg3 hover:text-fg" onClick={() => set({ demoOpen: false })} aria-label="Close demo controls">
              <X size={15} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-danger" onClick={() => demoBreak(7)}>
              <Hammer size={14} /> Break IMM-07
            </button>
            <button className="btn btn-ghost" onClick={() => demoRejects(12)}>
              <Zap size={14} /> Spike rejects on IMM-12
            </button>
            <button className="btn btn-ghost" onClick={demoTruckDelay}>
              <Truck size={14} /> Truck delay
            </button>
            <button className="btn btn-ghost" onClick={demoFixAll}>
              <Wrench size={14} /> Fix all
            </button>
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
            <div className="flex items-center gap-1 rounded-md border border-line2/70 p-0.5">
              {[1, 10, 60].map((s) => (
                <button key={s} onClick={() => set({ speed: s, paused: false })} className={cx('num h-8 rounded px-3 text-[13px] font-semibold', speed === s && !paused ? 'bg-fg text-bg' : 'text-fg2 hover:text-fg')}>
                  {s}×
                </button>
              ))}
            </div>
            <button className="btn btn-ghost !w-9 !p-0" onClick={() => set({ paused: !paused })} aria-label={paused ? 'Resume' : 'Pause'}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <button className="btn btn-ghost !w-9 !p-0" onClick={() => set({ speed: 60, paused: false })} aria-label="Fast forward">
              <FastForward size={14} />
            </button>
            <button className="btn btn-ghost !w-9 !p-0" onClick={reset} aria-label="Reset simulation" title="Reset to 11:42">
              <RotateCcw size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
