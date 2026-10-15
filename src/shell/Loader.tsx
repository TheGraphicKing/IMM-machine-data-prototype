import { motion } from 'framer-motion';
import { Mark } from './Sidebar';

/** Stylish loader used while 3D scenes / lazy routes load. */
export default function Loader({ label = 'Loading scene' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[60vh] w-full flex-col items-center justify-center gap-5" role="status" aria-live="polite">
      <div className="relative">
        <Mark size={56} />
        <motion.div className="absolute -inset-4 rounded-full border border-brand/40" animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="num text-[13px] font-semibold uppercase tracking-[0.2em] text-fg3">{label}</div>
        <div className="h-[2px] w-40 overflow-hidden rounded bg-line">
          <div className="h-full w-1/2 animate-sweep bg-brand" />
        </div>
      </div>
    </div>
  );
}
