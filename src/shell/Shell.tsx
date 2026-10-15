import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useOutlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Toasts from './Toasts';
import CommandPalette from './CommandPalette';
import DemoControls from './DemoControls';
import { EASE } from '../ui/primitives';
import { useSim } from '../sim/store';

export default function Shell() {
  const outlet = useOutlet();
  const loc = useLocation();
  const calm = useSim((s) => s.calm);
  const [mobileNav, setMobileNav] = useState(false);
  const key = loc.pathname.split('/').slice(0, 3).join('/');
  return (
    <div className="app-backdrop scanlines flex h-full w-full overflow-hidden">
      <div className="vignette pointer-events-none fixed inset-0" />
      <Sidebar mobileOpen={mobileNav} onClose={() => setMobileNav(false)} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileNav(true)} />
        <main id="main" className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={key}
              initial={calm ? { opacity: 0 } : { opacity: 0, scale: 0.985, filter: 'blur(6px)', y: 8 }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
              exit={calm ? { opacity: 0 } : { opacity: 0, scale: 1.01, filter: 'blur(4px)' }}
              transition={{ duration: calm ? 0.15 : 0.32, ease: EASE }}
              className="min-h-full"
              onAnimationComplete={() => {
                // framer leaves filter:none; keep compositing cheap
              }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toasts />
      <CommandPalette />
      <DemoControls />
    </div>
  );
}
