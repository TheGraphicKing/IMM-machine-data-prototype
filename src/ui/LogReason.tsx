import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { LOG_REASONS, TEAMS } from '../sim/catalog';
import { logReason } from '../sim/actions';
import { cx, dur } from '../lib/format';
import { Modal } from './primitives';
import { useWorld } from '../sim/store';

/** Big reason chips (floor-friendly). Updates timeline, Pareto and TV instantly. */
export default function LogReason({ machineId, open, onClose }: { machineId: string; open: boolean; onClose: () => void }) {
  const w = useWorld();
  const m = w.machine[machineId];
  const [sel, setSel] = useState<number | null>(null);
  if (!m) return null;
  const stopFor = m.state !== 'RUN' ? `${m.state === 'DOWN' ? 'Stopped' : m.state === 'IDLE' ? 'Idle' : 'In mould change'} ${dur(w.t - m.since)}` : 'Last stop';
  return (
    <Modal open={open} onClose={() => (onClose(), setSel(null))} title={`Log downtime reason · ${m.code}`} width={640}>
      <div className="p-5">
        <div className="mb-4 text-[13px] text-fg3">
          {stopFor} · {m.tonnage} T · {m.hall} · mould {m.mouldId}. Pick what stopped it; ticket reasons route to the owning team.
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {LOG_REASONS.map((r, i) => (
            <motion.button
              key={r.code}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSel(i)}
              className={cx('relative flex min-h-[64px] flex-col justify-center gap-0.5 rounded-[10px] border px-3 py-2.5 text-left transition', sel === i ? 'border-brand bg-brand/10' : 'border-line2 hover:border-fg3')}
            >
              <span className="flex items-center gap-2 text-[14px] font-semibold">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: TEAMS[r.team].color }} />
                {r.name}
              </span>
              <span className="num text-[11px] text-fg3">
                {r.code} · {TEAMS[r.team].label}
              </span>
              {sel === i && <Check size={16} className="absolute right-2.5 top-2.5 text-brand" />}
            </motion.button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => (onClose(), setSel(null))}>
            Cancel
          </button>
          <button
            className="btn btn-primary !h-11 !px-5"
            disabled={sel === null}
            style={{ opacity: sel === null ? 0.5 : 1 }}
            onClick={() => {
              if (sel === null) return;
              logReason(machineId, LOG_REASONS[sel]);
              setSel(null);
              onClose();
            }}
          >
            Log reason
          </button>
        </div>
      </div>
    </Modal>
  );
}
