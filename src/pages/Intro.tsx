import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Factory, Gauge, IndianRupee, Wrench, Users } from 'lucide-react';
import { Suspense, lazy, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES, useSim } from '../sim/store';
import type { RoleId } from '../sim/types';
import { Mark } from '../shell/Sidebar';
import { TENANT } from '../sim/catalog';
import { EASE } from '../ui/primitives';

const Stage = lazy(() => import('../three/Stage'));
const IntroScene = lazy(() => import('../three/IntroScene'));

const ROLE_CARDS: { id: RoleId; icon: typeof Gauge; q: string }[] = [
  { id: 'ceo', icon: IndianRupee, q: 'Are we making money today, and who is fixing the leaks?' },
  { id: 'director', icon: Gauge, q: 'Which orgs and units are behind plan, and why?' },
  { id: 'planthead', icon: Factory, q: 'Will this shift close on plan? Which machines hurt me?' },
  { id: 'supervisor', icon: Users, q: 'Which machine stopped, who is on it, what do I unblock?' },
  { id: 'technician', icon: Wrench, q: 'What are my jobs and which spares do I need?' },
];

export default function Intro() {
  const nav = useNavigate();
  const { calm, set } = useSim();
  const [phase, setPhase] = useState(calm ? 2 : 0);
  const [email, setEmail] = useState('neha.sethi@apexpolymers.example');
  const [pw, setPw] = useState('••••••••••');
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (calm) return;
    const a = setTimeout(() => setPhase(1), 900);
    const b = setTimeout(() => setPhase(2), 3200);
    return () => (clearTimeout(a), clearTimeout(b));
  }, [calm]);

  const enter = (role: RoleId = 'director') => {
    const unitRole = role === 'planthead' || role === 'supervisor' || role === 'technician';
    set({ entered: true, role, scope: unitRole ? { kind: 'unit', id: 'MN1' } : { kind: 'corp' } });
    nav(ROLES[role].home);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0B0D10] text-white" data-theme="dark">
      {!mobile ? (
        <Suspense fallback={null}>
          <Stage className="absolute inset-0" bg="#0B0D10" hero camera={{ position: [40, 34, 56], fov: 38 }}>
            <IntroScene calm={calm} />
          </Stage>
        </Suspense>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(91,141,255,0.25),transparent_60%),radial-gradient(ellipse_at_80%_90%,rgba(242,106,33,0.2),transparent_50%)]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(11,13,16,0.85)_100%)]" />

      <div className="absolute inset-0 z-10 overflow-y-auto"><div className="flex min-h-full flex-col items-center justify-center px-4 py-12 sm:py-0">
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(12px)' }} animate={{ opacity: 1, y: phase >= 2 ? -10 : 0, filter: 'blur(0px)' }} transition={{ duration: 1, ease: EASE }} className="flex flex-col items-center">
              <div className="flex items-center gap-4">
                <Mark size={mobile ? 40 : 56} />
                <div className="relative overflow-hidden">
                  <span className="num text-[56px] font-bold leading-none tracking-[0.12em] sm:text-[88px]">IMMDATA</span>
                  {!calm && <motion.span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent mix-blend-overlay" initial={{ left: '-40%' }} animate={{ left: '120%' }} transition={{ duration: 1.4, delay: 0.4, ease: EASE }} />}
                </div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-3 text-center text-[15px] text-[#C9CDD3] sm:text-[18px]">
                Every machine, every mould, every shift, every rupee — visible in real time.
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase >= 2 && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="mt-8 flex w-full max-w-[1180px] flex-col items-center gap-6">
              <div className="w-full max-w-[420px] rounded-[16px] border border-white/10 bg-[#111316]/70 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[10px] border border-[#2A2F36] bg-[#1B1F24] text-[13px] font-bold">{TENANT.initials}</div>
                  <div>
                    <div className="text-[15px] font-semibold">Sign in to {TENANT.name}</div>
                    <div className="text-[12px] text-[#8A9099]">Demo · any email and password work</div>
                  </div>
                </div>
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    enter('director');
                  }}
                >
                  <input className="h-11 rounded-[8px] border border-[#2A2F36] bg-[#0B0D10]/80 px-3 text-[14px] outline-none focus:border-[#F26A21]" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
                  <input className="h-11 rounded-[8px] border border-[#2A2F36] bg-[#0B0D10]/80 px-3 text-[14px] outline-none focus:border-[#F26A21]" type="password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" />
                  <button type="submit" className="mt-1 flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#F26A21] text-[14px] font-bold text-[#15171A] transition hover:bg-[#ff7a33]">
                    Sign in <ArrowRight size={16} />
                  </button>
                </form>
              </div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8A9099]">or enter the demo as</div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {ROLE_CARDS.map((r, i) => (
                  <TiltCard key={r.id} delay={0.1 + i * 0.07} onClick={() => enter(r.id)}>
                    <r.icon size={22} className="text-[#F26A21]" />
                    <div className="num mt-2 text-[20px] font-bold">{ROLES[r.id].label}</div>
                    <div className="text-[12px] text-[#8A9099]">{ROLES[r.id].name}</div>
                    <div className="mt-2 text-[13px] leading-[18px] text-[#C9CDD3]">“{r.q}”</div>
                  </TiltCard>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-10 flex items-center justify-between px-6 text-[12px] text-[#6A7079]">
        <span className="hidden sm:inline">Powered by AGG Technology · interactive prototype · simulated data for a fictional tenant</span>
        <button onClick={() => enter('director')} className="pointer-events-auto ml-auto rounded-full border border-white/15 px-4 py-2 font-semibold text-white transition hover:border-[#F26A21]">
          Enter demo →
        </button>
      </div>
    </div>
  );
}

function TiltCard({ children, onClick, delay }: { children: React.ReactNode; onClick: () => void; delay: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [t, setT] = useState({ x: 0, y: 0 });
  const onMove = (e: MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    setT({ x: ((e.clientY - r.top) / r.height - 0.5) * -14, y: ((e.clientX - r.left) / r.width - 0.5) * 16 });
  };
  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, rotateX: t.x, rotateY: t.y }}
      transition={{ opacity: { delay, duration: 0.5 }, y: { delay, duration: 0.5, ease: EASE }, rotateX: { duration: 0.2 }, rotateY: { duration: 0.2 } }}
      onMouseMove={onMove}
      onMouseLeave={() => setT({ x: 0, y: 0 })}
      onClick={onClick}
      style={{ transformPerspective: 700 }}
      className="group flex flex-col items-start rounded-[14px] border border-white/10 bg-[#111316]/70 p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors hover:border-[#F26A21]/70"
    >
      {children}
      <span className="mt-3 text-[12px] font-semibold text-[#F26A21] opacity-0 transition group-hover:opacity-100">Enter as this role →</span>
    </motion.button>
  );
}
