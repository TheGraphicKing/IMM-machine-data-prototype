import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "../sim/store";
import {
  acceptFix,
  assignTeam,
  demoBreak,
  imOnIt,
  markFixed,
} from "../sim/actions";
import { aggAll, aggUnit, derive, moneyOf } from "../sim/kpi";
import type { World } from "../sim/engine";
import { fmt, inr } from "../lib/format";
import { EASE, Ticker } from "../ui/primitives";

/* ------------------------------------------------------------------ */
/* The story: one takeaway per step, text at the focus, live numbers   */
/* ------------------------------------------------------------------ */

const TOUR_M = 16; // the machine that breaks during the story
const mid = (w: World) => `${w.heroUnitId}-${String(TOUR_M).padStart(2, "0")}`;
const tk = () => {
  const w = useSim.getState().world;
  return w.machine[mid(w)]?.ticketId ?? null;
};
const click = (sel: string) =>
  (
    document.querySelector(`[data-tour="${sel}"]`) as HTMLElement | null
  )?.click();

interface Stat {
  v: number;
  f: (n: number) => string;
  label: string;
}
export interface Act {
  chapter: string;
  route: string;
  sel: string;
  title: string;
  body: string;
  say: string;
  stat?: (w: World) => Stat;
  action?: () => void;
  prefer?: "right" | "left" | "below" | "above" | "inside";
}

export const ACTS: Act[] = [
  {
    chapter: "Group",
    route: "/home",
    sel: "home-kpis",
    title: "The whole group in four numbers",
    body: "Output against plan, OEE, machines down and money lost — live across 12 plants and 178 machines.",
    say: "This is IMMDATA. Four live numbers tell a director how the whole group is doing right now.",
    stat: (w) => ({
      v: derive(aggAll(w)).plan,
      f: (n) => `${n.toFixed(1)}%`,
      label: "of plan, group-wide",
    }),
    prefer: "below",
  },
  {
    chapter: "Group",
    route: "/home",
    sel: "home-network",
    title: "Every plant as one picture",
    body: "Each tower is a plant. Height is output so far; the cap shows whether it is on plan. Drag to turn it.",
    say: "Every plant becomes a tower. Height is output, and the colour of the cap says on track, at risk, or behind.",
    stat: (w) => ({
      v: w.units.length,
      f: (n) => `${Math.round(n)}`,
      label: "plants reporting live",
    }),
    prefer: "right",
  },
  {
    chapter: "Group",
    route: "/home",
    sel: "home-units",
    title: "The plants that need help come first",
    body: "One quiet line per plant: output against the orange plan tick, OEE ring, machine mix and the last hours.",
    say: "Below it, plants are sorted so the ones behind plan are always at the top.",
    prefer: "above",
  },
  {
    chapter: "Group",
    route: "/rollup",
    sel: "rollup-map",
    title: "Where in India",
    body: "The same plants on a 3D map. Pillars rise with output; arcs show flows to customer plants.",
    say: "The roll-up map places every plant on India, so a director sees where the trouble is in one glance.",
    prefer: "inside",
  },
  {
    chapter: "Plant",
    route: "/unit/MN1",
    sel: "unit-flow",
    title: "Where every minute of the shift went",
    body: "Planned time splits into running, idle, mould change and down; running time into good parts, slow cycles and rejects.",
    say: "Inside a plant, this flow shows where every planned minute of the shift went, and why OEE is what it is.",
    stat: (w) => ({
      v: derive(aggUnit(w, "MN1")).oee,
      f: (n) => `${n.toFixed(1)}%`,
      label: "OEE at Manesar U1",
    }),
    prefer: "below",
  },
  {
    chapter: "Plant",
    route: "/unit/MN1",
    sel: "unit-floor",
    title: "The floor at a glance",
    body: "Each block is a machine. The top shows its state; height shows output against target. Red rings are stops.",
    say: "The floor map turns twenty machines into twenty small blocks. Red rings are machines that are stopped right now.",
    stat: (w) => ({
      v: aggUnit(w, "MN1").down,
      f: (n) => `${Math.round(n)}`,
      label: "machines down right now",
    }),
    prefer: "above",
  },
  {
    chapter: "Plant",
    route: "/twin/MN1",
    sel: "twin",
    title: "Walk the factory in 3D",
    body: "A live digital twin of Manesar U1. Status lights, clamps cycling, stop timers floating over red machines.",
    say: "And this is the same plant as a live digital twin. You can orbit it and click any machine.",
    prefer: "inside",
  },
  {
    chapter: "A breakdown",
    route: "/twin/MN1",
    sel: "twin",
    title: "IMM-16 just stopped",
    body: "A heater fault. Nobody had to report it — the machine signal is the source of truth.",
    say: "Now watch. Machine sixteen has just tripped on a heater fault. Nobody had to report it; the machine told us.",
    action: () => demoBreak(TOUR_M, "MM-04"),
    stat: () => ({ v: 0, f: () => "0", label: "phone calls needed" }),
    prefer: "inside",
  },
  {
    chapter: "A breakdown",
    route: "/alerts",
    sel: "alert-detail",
    title: "The right people hear in seconds",
    body: "A critical alert with evidence and a timeline, sent by app and SMS, escalating to the plant head at 30 minutes.",
    say: "An alert reaches the supervisor at once, with evidence, and it escalates on its own if nobody acts.",
    prefer: "left",
  },
  {
    chapter: "A breakdown",
    route: "/breakdowns?view=phones",
    sel: "phone-supervisor",
    title: "Two taps to send the right team",
    body: "The supervisor picks Maintenance, a symptom and a photo. The shopfloor TV turns to “assigned”.",
    say: "On the floor, the supervisor sends it to maintenance with two taps and a photo.",
    action: () => {
      const t = tk();
      if (t) assignTeam(t, "maintenance", "Heater alarm", 1);
    },
    prefer: "right",
  },
  {
    chapter: "A breakdown",
    route: "/breakdowns?view=phones",
    sel: "phone-tech",
    title: "“I’m on it”",
    body: "The technician accepts on their phone and the repair clock starts. Everyone can see who is fixing what.",
    say: "The technician taps I am on it, and the repair clock starts for everyone to see.",
    action: () => {
      const t = tk();
      if (t) imOnIt(t);
    },
    prefer: "left",
  },
  {
    chapter: "A breakdown",
    route: "/breakdowns",
    sel: "board",
    title: "Fixed, verified, booked",
    body: "Root cause and spares are recorded, production verifies the fix, and the downtime is booked to the right team.",
    say: "When it is fixed, production verifies it, and the lost time is booked to the right root cause.",
    action: () => {
      const t = tk();
      if (t) {
        markFixed(
          t,
          "MM-04 Heater band failure",
          "Replaced heater band, zone 3",
          [
            {
              code: "SP-HB-450-60",
              name: "Heater band 450 W, Ø60",
              bin: "B-14",
              stock: 6,
              qty: 1,
            },
          ],
        );
        setTimeout(() => acceptFix(t), 2200);
      }
    },
    prefer: "below",
  },
  {
    chapter: "Machine",
    route: "/machine/MN1-05",
    sel: "machine-3d",
    title: "Inside one machine",
    body: "A 3D model whose barrel heater zones glow by real temperature. Click a zone to see its parameter.",
    say: "Every machine has its own page, with a 3D model whose heater zones glow by their live temperature.",
    prefer: "left",
  },
  {
    chapter: "Money",
    route: "/money",
    sel: "money-flow",
    title: "Who owns every rupee lost",
    body: "Lost value flows from its type to the team responsible. Valued at contribution margin.",
    say: "For the owner, every lost minute becomes rupees, and every rupee has an owner.",
    stat: (w) => ({
      v: moneyOf(w, w.machines, useSim.getState().basis).lost,
      f: (n) => inr(n),
      label: "lost so far today",
    }),
    prefer: "left",
  },
  {
    chapter: "Money",
    route: "/briefing",
    sel: "decision",
    title: "One decision for today",
    body: "The 08:00 briefing ends with the single decision that pays back fastest.",
    say: "And each morning, the briefing ends with the one decision that pays back fastest.",
    prefer: "above",
  },
  {
    chapter: "Planning",
    route: "/planning",
    sel: "gantt",
    title: "Plan the next 30 hours",
    body: "Jobs on machines, with mould changes in purple. Auto-schedule groups same-mould jobs and meets due dates.",
    say: "Planners drag jobs between machines, or let auto schedule cut the number of mould changes.",
    action: () => setTimeout(() => click("plan-auto"), 600),
    stat: (w) => ({
      v: w.jobs.length,
      f: (n) => fmt(n),
      label: "work orders on the board",
    }),
    prefer: "above",
  },
  {
    chapter: "Shopfloor",
    route: "/tv",
    sel: "tv",
    title: "The whole hall sees it",
    body: "A TV playlist for every hall: timelines, reasons, availability and trucks. No rupees on the floor.",
    say: "Finally, every hall sees the same truth on a wall.",
    prefer: "inside",
  },
  {
    chapter: "Explore",
    route: "/home",
    sel: "home-network",
    title: "Now it’s yours",
    body: "Click any tower, press D for demo controls, or ⌘K to search. Replay any chapter from the bar above.",
    say: "That is IMMDATA. Every machine, every mould, every shift, every rupee. Now explore it yourself.",
    prefer: "right",
  },
];

/* ------------------------------------------------------------------ */
/* Voice: the browser's own free speech engine, Google voices first    */
/* ------------------------------------------------------------------ */

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const vs = speechSynthesis.getVoices();
  const en = vs.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  return (
    en.find((v) => /google uk english female/i.test(v.name)) ??
    en.find((v) => /google/i.test(v.name) && /en-(gb|in)/i.test(v.lang)) ??
    en.find((v) => /google/i.test(v.name)) ??
    en.find((v) => /samantha|daniel|serena|natural/i.test(v.name)) ??
    en[0] ??
    null
  );
}
const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

/* ------------------------------------------------------------------ */

export default function Tour() {
  const on = useSim((s) => s.tourOn);
  const set = useSim((s) => s.set);
  const nav = useNavigate();
  const [act, setAct] = useState(-1); // -1 = play gate
  const [paused, setPaused] = useState(false);
  const [voice, setVoice] = useState(canSpeak);
  const [elapsed, setElapsed] = useState(0);
  const speaking = useRef(false);
  const gen = useRef(0);

  const stopVoice = () => {
    if (canSpeak) speechSynthesis.cancel();
    speaking.current = false;
  };
  const close = useCallback(() => {
    stopVoice();
    setAct(-1);
    set({ tourOn: false });
  }, [set]);

  // start at the gate whenever the tour is opened
  useEffect(() => {
    if (on) {
      setAct(-1);
      setPaused(false);
      set({ entered: true, speed: 1, paused: false });
    } else stopVoice();
  }, [on, set]);

  const play = useCallback(
    (i: number) => {
      if (i >= ACTS.length) return close();
      const a = ACTS[Math.max(0, i)];
      const g = ++gen.current;
      stopVoice();
      setAct(i);
      setElapsed(0);
      nav(a.route);
      if (a.action) setTimeout(() => g === gen.current && a.action!(), 900);
      if (voice && canSpeak) {
        setTimeout(() => {
          if (g !== gen.current) return;
          const u = new SpeechSynthesisUtterance(a.say);
          const v = pickVoice();
          if (v) u.voice = v;
          u.rate = 1.02;
          u.pitch = 1;
          u.onend = () => g === gen.current && (speaking.current = false);
          u.onerror = () => g === gen.current && (speaking.current = false);
          speaking.current = true;
          speechSynthesis.speak(u);
        }, 450);
      }
    },
    [nav, voice, close],
  );

  // pacing: a minimum dwell, then hold while narration is still speaking (safety cap 22 s)
  const dwell =
    act >= 0 ? Math.max(6.5, ACTS[act].body.split(" ").length * 0.32 + 2) : 0;
  useEffect(() => {
    if (!on || act < 0 || paused) return;
    const id = setInterval(() => {
      setElapsed((e) => {
        const n = e + 0.1;
        if (n >= dwell && (!speaking.current || n > 22)) {
          setTimeout(() => play(act + 1), 0);
          return 0;
        }
        return n;
      });
    }, 100);
    return () => clearInterval(id);
  }, [on, act, paused, dwell, play]);

  useEffect(() => {
    if (!canSpeak) return;
    if (paused) speechSynthesis.pause();
    else speechSynthesis.resume();
  }, [paused]);

  // keyboard: Esc skips, arrows step, space pauses
  useEffect(() => {
    if (!on) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") (e.preventDefault(), close());
      else if (act >= 0 && e.key === "ArrowRight") play(act + 1);
      else if (act >= 0 && e.key === "ArrowLeft") play(Math.max(0, act - 1));
      else if (act >= 0 && e.key === " ")
        (e.preventDefault(), setPaused((p) => !p));
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [on, act, play, close]);

  if (!on) return null;
  const a = act >= 0 ? ACTS[act] : null;
  const chapters = [...new Set(ACTS.map((x) => x.chapter))];

  return (
    <>
      <AnimatePresence>
        {act === -1 && (
          <Gate
            key="gate"
            voice={voice}
            setVoice={setVoice}
            onPlay={() => play(0)}
            onSkip={close}
            chapters={chapters}
          />
        )}
      </AnimatePresence>
      {a && <Focus key={act} act={a} index={act} total={ACTS.length} />}
      {a && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[130] flex justify-center px-3">
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="pointer-events-auto flex w-full max-w-[820px] items-center gap-3 rounded-full border border-white/10 bg-[rgba(31,32,34,0.96)] py-1.5 pl-4 pr-1.5 text-[#FAFAF9] shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[#A8A298] sm:inline">
              {a.chapter}
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-[3px]">
              {ACTS.map((x, i) => (
                <button
                  key={i}
                  onClick={() => play(i)}
                  className="group relative h-5 flex-1"
                  aria-label={`Step ${i + 1}: ${x.title}`}
                  title={x.title}
                >
                  <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/15">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-[#FE4B1E]"
                      style={{
                        width:
                          i < act
                            ? "100%"
                            : i === act
                              ? `${Math.min(100, (elapsed / dwell) * 100)}%`
                              : "0%",
                      }}
                    />
                  </span>
                </button>
              ))}
            </div>
            <span className="shrink-0 font-mono text-[10px] text-[#A8A298]">
              {act + 1}/{ACTS.length}
            </span>
            <div className="flex shrink-0 items-center">
              <IconBtn
                label="Previous"
                onClick={() => play(Math.max(0, act - 1))}
              >
                <ChevronLeft size={15} />
              </IconBtn>
              <IconBtn
                label={paused ? "Resume" : "Pause"}
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </IconBtn>
              <IconBtn label="Next" onClick={() => play(act + 1)}>
                <ChevronRight size={15} />
              </IconBtn>
              {canSpeak && (
                <IconBtn
                  label={voice ? "Mute narration" : "Narrate"}
                  onClick={() => {
                    if (voice) stopVoice();
                    setVoice((v) => !v);
                  }}
                >
                  {voice ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </IconBtn>
              )}
              <button
                onClick={close}
                className="ml-1 flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[12px] font-medium transition hover:bg-white/20"
              >
                Skip tour <X size={13} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-full text-[#CFCCC7] transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Play gate                                                           */
/* ------------------------------------------------------------------ */

function Gate({
  voice,
  setVoice,
  onPlay,
  onSkip,
  chapters,
}: {
  voice: boolean;
  setVoice: (v: boolean) => void;
  onPlay: () => void;
  onSkip: () => void;
  chapters: string[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[140] grid place-items-center bg-[rgba(31,32,34,0.55)] p-4 backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-label="Guided tour"
    >
      <motion.div
        initial={{ y: 20, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="w-full max-w-[520px] overflow-hidden rounded-[24px] bg-panel text-fg shadow-[0_40px_100px_rgba(0,0,0,0.35)]"
      >
        <div className="relative h-[170px] overflow-hidden bg-[#1F2022]">
          <GateArt />
        </div>
        <div className="flex flex-col gap-5 p-7">
          <div>
            <div className="eyebrow">Guided tour · about 3 minutes</div>
            <h2 className="mt-2 text-[24px] font-normal leading-[30px] tracking-[-0.02em]">
              See a breakdown go from machine signal to rupees, live.
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chapters.map((c, i) => (
              <span
                key={c}
                className="rounded-full bg-panel3 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-fg3"
              >
                {String(i + 1).padStart(2, "0")} {c}
              </span>
            ))}
          </div>
          {canSpeak && (
            <label className="flex cursor-pointer items-center justify-between rounded-[12px] border border-line px-4 py-3">
              <span className="flex items-center gap-2.5 text-[13px]">
                {voice ? <Volume2 size={15} /> : <VolumeX size={15} />}
                Narrate with your browser’s voice
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={voice}
                onClick={() => setVoice(!voice)}
                className={`relative h-5 w-9 rounded-full transition ${voice ? "bg-fg" : "bg-line2"}`}
              >
                <motion.span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-panel shadow"
                  animate={{ left: voice ? 18 : 2 }}
                  transition={{ duration: 0.2 }}
                />
              </button>
            </label>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onPlay}
              autoFocus
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#FE4B1E] text-[14px] font-medium text-white transition hover:bg-[#E8441B]"
            >
              <Play size={15} fill="currentColor" /> Play the tour
            </button>
            <button
              onClick={onSkip}
              className="h-11 rounded-full border border-line px-5 text-[13px] text-fg2 transition hover:bg-panel3"
            >
              Skip
            </button>
          </div>
          <div className="text-[11px] text-fg4">
            Skip any time with Esc · ← → to step · space to pause
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GateArt() {
  // an animated isometric skyline of plant towers
  const towers = [42, 70, 55, 92, 64, 38, 80, 58, 46, 74, 60, 50];
  return (
    <svg viewBox="0 0 520 170" className="h-full w-full">
      <defs>
        <linearGradient id="gate-fade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1F2022" stopOpacity="0" />
          <stop offset="1" stopColor="#1F2022" stopOpacity="1" />
        </linearGradient>
      </defs>
      {towers.map((h, i) => {
        const x = 40 + i * 38;
        const y = 150 - h;
        const cap =
          i % 5 === 3 ? "#E0826B" : i % 4 === 1 ? "#D6B56E" : "#7DB08F";
        return (
          <motion.g
            key={i}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.05, duration: 0.7, ease: EASE }}
          >
            <polygon
              points={`${x},${y} ${x + 14},${y - 8} ${x + 28},${y} ${x + 14},${y + 8}`}
              fill={cap}
            />
            <polygon
              points={`${x},${y} ${x + 14},${y + 8} ${x + 14},158 ${x},150`}
              fill="#3A3B3E"
            />
            <polygon
              points={`${x + 14},${y + 8} ${x + 28},${y} ${x + 28},150 ${x + 14},158`}
              fill="#2C2D30"
            />
          </motion.g>
        );
      })}
      <motion.circle
        r="3"
        fill="#FE4B1E"
        initial={{ cx: 20, cy: 40 }}
        animate={{ cx: [20, 500], cy: [40, 30] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
      />
      <rect x="0" y="110" width="520" height="60" fill="url(#gate-fade)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Focus: dim everything, ring the target, callout beside it           */
/* ------------------------------------------------------------------ */

interface R {
  x: number;
  y: number;
  w: number;
  h: number;
}

function Focus({
  act,
  index,
  total,
}: {
  act: Act;
  index: number;
  total: number;
}) {
  const [rect, setRect] = useState<R | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const stable = useRef<{ r: R | null; since: number }>({ r: null, since: 0 });
  const scrolled = useRef(false);
  const [stat, setStat] = useState<Stat | null>(null);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const t0 = performance.now();
    const tick = () => {
      if (!alive) return;
      const el = document.querySelector(
        `[data-tour="${act.sel}"]`,
      ) as HTMLElement | null;
      if (el) {
        if (!scrolled.current && act.prefer !== "inside") {
          scrolled.current = true;
          el.scrollIntoView({
            block: "center",
            behavior: useSim.getState().calm ? "auto" : "smooth",
          });
        }
        const b = el.getBoundingClientRect();
        const r = {
          x: Math.max(6, b.left),
          y: Math.max(6, b.top),
          w: Math.min(b.width, window.innerWidth - Math.max(6, b.left) - 6),
          h: Math.min(b.height, window.innerHeight - Math.max(6, b.top) - 6),
        };
        const p = stable.current.r;
        const same =
          p &&
          Math.abs(p.x - r.x) < 1 &&
          Math.abs(p.y - r.y) < 1 &&
          Math.abs(p.w - r.w) < 1 &&
          Math.abs(p.h - r.h) < 1;
        if (!same) stable.current = { r, since: performance.now() };
        if (
          performance.now() - stable.current.since > 150 ||
          performance.now() - t0 > 2500
        )
          setRect((old) =>
            old &&
            Math.abs(old.x - r.x) < 0.5 &&
            Math.abs(old.y - r.y) < 0.5 &&
            Math.abs(old.w - r.w) < 0.5 &&
            Math.abs(old.h - r.h) < 0.5
              ? old
              : r,
          );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // hidden-tab fallback: rAF freezes, keep placing slowly
    const iv = setInterval(() => document.hidden && tick(), 400);
    const rs = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", rs);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearInterval(iv);
      window.removeEventListener("resize", rs);
    };
  }, [act]);

  // stat computed once the action has had time to land
  useEffect(() => {
    if (!act.stat) return setStat(null);
    const id = setTimeout(
      () => setStat(act.stat!(useSim.getState().world)),
      1100,
    );
    return () => clearTimeout(id);
  }, [act]);

  const pad = 10;
  const box = rect
    ? {
        x: rect.x - pad,
        y: rect.y - pad,
        w: rect.w + pad * 2,
        h: rect.h + pad * 2,
      }
    : null;
  const big = box ? box.w * box.h > vp.w * vp.h * 0.55 : false;
  const CW = 320;
  const CH = 210;
  let cx = vp.w / 2 - CW / 2;
  let cy = vp.h - CH - 40;
  let side = "inside" as "right" | "left" | "below" | "above" | "inside";
  if (box) {
    const space = {
      right: vp.w - (box.x + box.w),
      left: box.x,
      below: vp.h - (box.y + box.h),
      above: box.y,
    };
    const order = [act.prefer, "right", "left", "below", "above"].filter(
      Boolean,
    ) as (keyof typeof space | "inside")[];
    side =
      big || act.prefer === "inside"
        ? "inside"
        : ((order.find(
            (s) =>
              s !== "inside" &&
              space[s as keyof typeof space] >
                (s === "left" || s === "right" ? CW + 36 : CH + 36),
          ) as typeof side) ?? "inside");
    if (side === "right")
      ((cx = box.x + box.w + 24), (cy = box.y + box.h / 2 - CH / 2));
    else if (side === "left")
      ((cx = box.x - CW - 24), (cy = box.y + box.h / 2 - CH / 2));
    else if (side === "below")
      ((cx = box.x + box.w / 2 - CW / 2), (cy = box.y + box.h + 24));
    else if (side === "above")
      ((cx = box.x + box.w / 2 - CW / 2), (cy = box.y - CH - 24));
    else ((cx = box.x + 28), (cy = box.y + box.h - CH - 28));
    cx = Math.max(16, Math.min(vp.w - CW - 16, cx));
    cy = Math.max(64, Math.min(vp.h - CH - 16, cy));
  }
  const anchor =
    box && side !== "inside"
      ? side === "right"
        ? [box.x + box.w, box.y + box.h / 2]
        : side === "left"
          ? [box.x, box.y + box.h / 2]
          : side === "below"
            ? [box.x + box.w / 2, box.y + box.h]
            : [box.x + box.w / 2, box.y]
      : null;
  const cAnchor = anchor
    ? side === "right"
      ? [cx, cy + 40]
      : side === "left"
        ? [cx + CW, cy + 40]
        : side === "below"
          ? [cx + CW / 2, cy]
          : [cx + CW / 2, cy + CH]
    : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      <svg width={vp.w} height={vp.h} className="absolute inset-0">
        <defs>
          <mask id="tour-mask">
            <rect x={0} y={0} width={vp.w} height={vp.h} fill="white" />
            {box && (
              <motion.rect
                initial={false}
                animate={{ x: box.x, y: box.y, width: box.w, height: box.h }}
                transition={{ duration: 0.5, ease: EASE }}
                rx={18}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <motion.rect
          x={0}
          y={0}
          width={vp.w}
          height={vp.h}
          fill="rgba(20,21,23,0.48)"
          mask="url(#tour-mask)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
        {box && (
          <motion.rect
            initial={false}
            animate={{ x: box.x, y: box.y, width: box.w, height: box.h }}
            transition={{ duration: 0.5, ease: EASE }}
            rx={18}
            fill="none"
            stroke="#FE4B1E"
            strokeWidth={2}
            className="animate-pulse"
          />
        )}
        {anchor && cAnchor && (
          <motion.line
            x1={anchor[0]}
            y1={anchor[1]}
            x2={cAnchor[0]}
            y2={cAnchor[1]}
            stroke="#FE4B1E"
            strokeWidth={1.5}
            strokeDasharray="3 4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          />
        )}
        {anchor && (
          <circle cx={anchor[0]} cy={anchor[1]} r={4} fill="#FE4B1E" />
        )}
      </svg>
      <AnimatePresence>
        {box && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, left: cx, top: cy }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.15 }}
            className="pointer-events-auto absolute flex flex-col gap-2.5 rounded-[18px] bg-panel p-5 text-fg shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
            style={{ width: CW }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg3">
              {String(index + 1).padStart(2, "0")} / {total} · {act.chapter}
            </span>
            <div className="text-[17px] leading-[23px] tracking-[-0.01em]">
              {act.title}
            </div>
            <div className="text-[12.5px] leading-[19px] text-fg3">
              {act.body}
            </div>
            {stat && (
              <div className="mt-1 flex items-baseline gap-2 border-t border-line pt-3">
                <span className="text-[26px] leading-none tracking-[-0.03em]">
                  <Ticker value={stat.v} format={stat.f} />
                </span>
                <span className="text-[11.5px] text-fg3">{stat.label}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
