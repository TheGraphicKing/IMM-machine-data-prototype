import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, SkipForward, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSim } from '../sim/store';
import { acceptFix, assignTeam, demoBreak, imOnIt, markFixed } from '../sim/actions';
import { EASE } from '../ui/primitives';

const TOUR_M = 16; // machine that breaks during the tour

interface Step {
  at: number; // seconds
  route: string;
  title: string;
  body: string;
  run?: () => void;
}

const ticketOf = () => {
  const w = useSim.getState().world;
  return w.machine[`${w.heroUnitId}-${String(TOUR_M).padStart(2, '0')}`]?.ticketId ?? null;
};

export const TOUR: Step[] = [
  { at: 0, route: '/home', title: 'Every unit, live', body: '12 plants, 178 machines. Plan attainment, OEE, rejects and machines down for the whole group — every number has a comparison.' },
  { at: 9, route: '/twin/MN1', title: 'The digital twin', body: 'Manesar U1 in 3D. Each machine glows in its live status; red ones show a running stop timer.' },
  { at: 19, route: '/twin/MN1', title: 'A machine goes down', body: 'IMM-16 trips on a heater fault. The machine signal (OPC) is the truth — nobody has to report it.', run: () => demoBreak(TOUR_M, 'MM-04') },
  { at: 27, route: '/alerts', title: 'An alert fires', body: 'Critical alert to the supervisor on app and SMS, with evidence and a timeline. Escalates to the unit head at 30 min.' },
  { at: 35, route: '/breakdowns?view=phones', title: 'Two taps to assign', body: 'The supervisor picks Maintenance, a symptom and a photo. The TV turns to “assigned”.', run: () => { const t = ticketOf(); if (t) assignTeam(t, 'maintenance', 'Heater alarm', 1); } },
  { at: 43, route: '/breakdowns?view=phones', title: '“I’m on it”', body: 'The technician accepts on their phone. The repair clock starts and the board shows the team working.', run: () => { const t = ticketOf(); if (t) imOnIt(t); } },
  { at: 51, route: '/breakdowns', title: 'Fixed and verified', body: 'Root cause, spares and an after-photo, then production verifies. Downtime is booked to the root cause and team.', run: () => { const t = ticketOf(); if (t) { markFixed(t, 'MM-04 Heater band failure', 'Replaced heater band zone 3', [{ code: 'SP-HB-450-60', name: 'Heater band 450 W, Ø60', bin: 'B-14', stock: 6, qty: 1 }]); setTimeout(() => acceptFix(t), 2500); } } },
  { at: 60, route: '/money', title: 'Losses in rupees', body: 'Every minute down is valued at contribution margin and owned by a team. The waterfall reconciles to the rupee.' },
  { at: 70, route: '/briefing', title: 'One decision for today', body: 'The owner’s 08:00 briefing: three sentences, a unit league table and the one decision that pays back.' },
  { at: 80, route: '/tv', title: 'The whole hall sees it', body: 'Shopfloor TV rotates timeline, reasons, availability and trucks — no rupees on the floor.' },
  { at: 92, route: '/home', title: 'That’s IMMDATA', body: 'Explore any screen, press D for demo controls, or ⌘K to search. Thanks for watching.' },
];
const END = 100;

export default function Tour() {
  const on = useSim((s) => s.tourOn);
  const set = useSim((s) => s.set);
  const nav = useNavigate();
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const done = useRef(new Set<number>());

  useEffect(() => {
    if (!on) return;
    setT(0);
    done.current = new Set();
    set({ entered: true, speed: 1, paused: false });
  }, [on, set]);

  useEffect(() => {
    if (!on || paused) return;
    const id = setInterval(() => setT((x) => x + 0.25), 250);
    return () => clearInterval(id);
  }, [on, paused]);

  useEffect(() => {
    if (!on) return;
    TOUR.forEach((s, i) => {
      if (t >= s.at && !done.current.has(i)) {
        done.current.add(i);
        nav(s.route);
        if (s.run) setTimeout(s.run, 600);
      }
    });
    if (t >= END) set({ tourOn: false });
  }, [t, on, nav, set]);

  const idx = TOUR.reduce((a, s, i) => (t >= s.at ? i : a), 0);
  const step = TOUR[idx];
  const next = TOUR[idx + 1];
  const skip = () => setT(next ? next.at : END);

  return (
    <AnimatePresence>
      {on && (
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="fixed bottom-5 left-1/2 z-[120] w-[min(720px,calc(100vw-24px))] -translate-x-1/2" role="status" aria-live="polite">
          <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#111316]/92 text-white shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-start gap-4 p-4">
              <div className="num grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F26A21] text-[16px] font-bold text-[#15171A]">{idx + 1}</div>
              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
                    <div className="num text-[22px] font-bold leading-7">{step.title}</div>
                    <div className="text-[14px] leading-5 text-[#C9CDD3]">{step.body}</div>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="grid h-8 w-8 place-items-center rounded-md text-[#C9CDD3] hover:bg-white/10" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume tour' : 'Pause tour'}>
                  {paused ? <Play size={15} /> : <Pause size={15} />}
                </button>
                <button className="grid h-8 w-8 place-items-center rounded-md text-[#C9CDD3] hover:bg-white/10" onClick={skip} aria-label="Next step">
                  <SkipForward size={15} />
                </button>
                <button className="grid h-8 w-8 place-items-center rounded-md text-[#C9CDD3] hover:bg-white/10" onClick={() => set({ tourOn: false })} aria-label="Exit tour">
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="flex h-1.5 gap-[2px] bg-black/30">
              {TOUR.map((s, i) => {
                const end = TOUR[i + 1]?.at ?? END;
                const k = Math.max(0, Math.min(1, (t - s.at) / (end - s.at)));
                return (
                  <div key={i} className="relative flex-1 bg-white/10">
                    <div className="absolute inset-y-0 left-0 bg-[#F26A21]" style={{ width: `${k * 100}%` }} />
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
