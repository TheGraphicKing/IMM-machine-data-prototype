import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSim, type ModuleId } from './sim/store';
import Shell from './shell/Shell';
import Locked from './shell/Locked';
import Loader from './shell/Loader';
import Home from './pages/Home';
import Unit from './pages/Unit';
import Machine from './pages/Machine';
import Records from './pages/Records';
import Alerts from './pages/Alerts';
import Breakdowns from './pages/Breakdowns';
import Moulds from './pages/Moulds';
import MouldSetup from './pages/MouldSetup';
import Money from './pages/Money';
import Planning from './pages/Planning';
import People from './pages/People';
import Energy from './pages/Energy';
import Dispatch from './pages/Dispatch';
import Ask from './pages/Ask';
import Modules from './pages/Modules';
import MobilePreview from './pages/MobilePreview';
import Tour from './shell/Tour';

const Intro = lazy(() => import('./pages/Intro'));
const Rollup = lazy(() => import('./pages/Rollup'));
const Twin = lazy(() => import('./pages/Twin'));
const TV = lazy(() => import('./pages/TV'));

function Gate({ mod, children }: { mod: ModuleId; children: ReactNode }) {
  const on = useSim((s) => s.modules[mod]);
  return on ? <>{children}</> : <Locked mod={mod} />;
}

export default function App() {
  const theme = useSim((s) => s.theme);
  const calm = useSim((s) => s.calm);
  const entered = useSim((s) => s.entered);
  const loc = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.calm = String(calm);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B0D10' : '#F3F2EE');
  }, [theme, calm]);

  // simulator heartbeat (pauses when the tab is hidden)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') useSim.getState().tick();
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // keyboard: Cmd/Ctrl+K palette, D demo controls
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useSim.getState().set({ paletteOpen: !useSim.getState().paletteOpen });
      } else if (!typing && e.key === '/' && !e.metaKey) {
        e.preventDefault();
        useSim.getState().set({ paletteOpen: true });
      } else if (!typing && (e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey) {
        useSim.getState().set({ demoOpen: !useSim.getState().demoOpen });
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const needsIntro = !entered && loc.pathname !== '/tv' && !loc.pathname.startsWith('/tv');

  return (
    <Suspense fallback={<Loader label="Loading" />}>
      {needsIntro ? (
        <Intro />
      ) : (
        <Routes>
          <Route path="/tv" element={<Gate mod="tv"><TV /></Gate>} />
          <Route element={<Shell />}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/rollup" element={<Rollup />} />
            <Route path="/twin/:unitId" element={<Twin />} />
            <Route path="/twin" element={<Navigate to="/twin/MN1" replace />} />
            <Route path="/unit/:unitId" element={<Unit view="overview" />} />
            <Route path="/unit/:unitId/timeline" element={<Unit view="timeline" />} />
            <Route path="/unit" element={<Navigate to="/unit/MN1" replace />} />
            <Route path="/machine/:id" element={<Machine />} />
            <Route path="/records" element={<Records />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/breakdowns" element={<Gate mod="breakdown"><Breakdowns /></Gate>} />
            <Route path="/moulds" element={<Gate mod="mould"><Moulds /></Gate>} />
            <Route path="/mould-setup" element={<MouldSetup />} />
            <Route path="/money" element={<Gate mod="money"><Money view="money" /></Gate>} />
            <Route path="/briefing" element={<Gate mod="money"><Money view="briefing" /></Gate>} />
            <Route path="/planning" element={<Gate mod="planning"><Planning /></Gate>} />
            <Route path="/people" element={<Gate mod="people"><People /></Gate>} />
            <Route path="/energy" element={<Gate mod="energy"><Energy /></Gate>} />
            <Route path="/dispatch" element={<Gate mod="dispatch"><Dispatch /></Gate>} />
            <Route path="/ask" element={<Gate mod="ai"><Ask /></Gate>} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/mobile" element={<Gate mod="mobile"><MobilePreview /></Gate>} />
            <Route path="/locked/:mod" element={<Locked />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      )}
      <Tour />
    </Suspense>
  );
}
