import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow/latin-800.css';
import '@fontsource/barlow-condensed/latin-700.css';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Pause, Play, Settings2, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import logo from '../assets/ui-logo.png';
import { useWorld } from '../sim/store';
import { machinesOfUnit } from '../sim/kpi';
import { SHIFT_LEN, SHIFT_WINDOWS, shiftOf, shiftStartOf } from '../sim/catalog';
import type { World } from '../sim/engine';
import type { Machine, Segment } from '../sim/types';
import {
  BAR,
  COND,
  FA,
  FG,
  FR,
  MC_PURPLE,
  ORANGE,
  TEAM_TAG,
  YELLOW,
  availRank,
  dcol,
  delta,
  fill,
  hhmm,
  hm,
  hourBars,
  machineInfo,
  mins,
  nowCell,
  ranking,
  reasons,
  shiftHours,
  summary,
  theme,
  topLosses,
  trend12,
  trucks,
  txt,
  waitTone,
  type Theme,
} from './tvui/model';

/* ------------------------------------------------------------------ */
/* Shopfloor TV · UI — United Industries, Shopfloor TV v3 design       */
/* 1920×1080 for a 65″ screen read at 5–10 m (1080×1920 portrait)      */
/* ------------------------------------------------------------------ */

type Kind = 'timeline' | 'oee' | 'hourly' | 'worst' | 'reasons' | 'avail' | 'trucks';
interface Pg {
  key: string;
  kind: Kind;
  page: number;
  secs: number;
}
const PILL: { kind: Kind; l: string }[] = [
  { kind: 'timeline', l: 'TIMELINE' },
  { kind: 'oee', l: 'OEE' },
  { kind: 'hourly', l: 'HOURLY' },
  { kind: 'worst', l: 'WORST' },
  { kind: 'reasons', l: 'REASONS' },
  { kind: 'avail', l: 'AVAIL.' },
  { kind: 'trucks', l: 'TRUCKS' },
];
const PER = 8;

export default function TVUI() {
  const w = useWorld();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const unitId = sp.get('u') && w.unit[sp.get('u')!] ? sp.get('u')! : 'MN1';
  const u = w.unit[unitId];
  const ms = machinesOfUnit(w, u);
  const [dark, setDark] = useState(sp.get('theme') === 'dark');
  const [T, setT] = useState(75);
  const [amber, setAmber] = useState(30);
  const [red, setRed] = useState(60);
  const [orient, setOrient] = useState<'auto' | 'landscape' | 'portrait'>((sp.get('o') as 'portrait') ?? 'auto');
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState(false);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const th = theme(dark);

  const portrait = orient === 'portrait' || (orient === 'auto' && vp.h > vp.w * 1.15);
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;
  const scale = Math.min(vp.w / W, vp.h / H);

  const nPages = Math.max(1, Math.ceil(ms.length / PER));
  const pages: Pg[] = useMemo(() => {
    const l: Pg[] = [];
    for (let p = 0; p < nPages; p++) l.push({ key: `tl${p}`, kind: 'timeline', page: p, secs: 15 });
    l.push({ key: 'oee', kind: 'oee', page: 0, secs: 25 });
    for (let p = 0; p < nPages; p++) l.push({ key: `hr${p}`, kind: 'hourly', page: p, secs: 15 });
    l.push({ key: 'worst', kind: 'worst', page: 0, secs: 15 }, { key: 'reasons', kind: 'reasons', page: 0, secs: 20 }, { key: 'avail', kind: 'avail', page: 0, secs: 15 }, { key: 'trucks', kind: 'trucks', page: 0, secs: 20 });
    return l;
  }, [nPages]);
  const pg = pages[i % pages.length];

  useEffect(() => {
    const r = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      if (paused) return;
      setElapsed((e) => {
        if (e + 0.1 >= pg.secs) {
          setI((x) => (x + 1) % pages.length);
          return 0;
        }
        return e + 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [paused, pg.secs, pages.length]);
  const go = (n: number) => (setI(((n % pages.length) + pages.length) % pages.length), setElapsed(0));
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') panel ? setPanel(false) : nav(-1);
      else if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === ' ') (e.preventDefault(), setPaused((p) => !p));
      else if (e.key === 't' || e.key === 'T') setDark((d) => !d);
      else if (e.key === 'o' || e.key === 'O') setOrient((o) => (o === 'portrait' ? 'landscape' : 'portrait'));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const tk = trucks(w, unitId, amber, red);
  const sh = shiftOf(w.t);
  const name = u.name.toUpperCase();
  const ctx: Ctx = { w, ms, th, T, amber, red, tk, portrait, unitId, name, sh };

  const head = headFor(pg, ctx, nPages);
  // clickable page tabs in rotation order; multi-page groups carry their 1 · 2 · 3 inside the tab
  const navItems: NavItem[] = PILL.map((p) => {
    const idxs = pages.map((x, k) => (x.kind === p.kind ? k : -1)).filter((k) => k >= 0);
    return {
      l: p.l,
      on: p.kind === pg.kind,
      go: () => go(idxs[0]),
      pages: idxs.length > 1 ? idxs.map((k, n) => ({ l: String(n + 1), on: k === i % pages.length, go: () => go(k) })) : undefined,
    };
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: dark ? '#000' : '#E9E7E1' }}>
      <div
        data-tour="tv"
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'center', background: th.bg, color: th.tx, display: 'flex', flexDirection: 'column', fontFamily: BAR, position: 'relative', overflow: 'hidden', flex: 'none' }}
      >
        <Header th={th} portrait={portrait} title={head.title} sub={head.sub} nav={portrait ? null : <PageNav items={navItems} />} clock={hhmm(w.t)} />
        {portrait && (
          <div style={{ flex: 'none', background: th.hd, padding: '0 30px 14px', display: 'flex', justifyContent: 'center' }}>
            <PageNav items={navItems} portrait />
          </div>
        )}
        {/* rotation progress, thin, under the header */}
        <div style={{ height: 6, flex: 'none', background: th.hd }}>
          <div style={{ height: '100%', width: `${(elapsed / pg.secs) * 100}%`, background: ORANGE, transition: 'width 0.1s linear' }} />
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={pg.key + (portrait ? 'p' : 'l')} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              {pg.kind === 'timeline' && <TimelinePage c={ctx} page={pg.page} />}
              {pg.kind === 'oee' && <OeePage c={ctx} />}
              {pg.kind === 'hourly' && <HourlyPage c={ctx} page={pg.page} />}
              {pg.kind === 'worst' && <WorstPage c={ctx} />}
              {pg.kind === 'reasons' && <ReasonsPage c={ctx} />}
              {pg.kind === 'avail' && <AvailPage c={ctx} />}
              {pg.kind === 'trucks' && <TrucksPage c={ctx} />}
            </motion.div>
          </AnimatePresence>
        </div>
        {pg.kind !== 'trucks' && <TruckBand c={ctx} />}
      </div>

      {/* presenter controls — outside the TV canvas, fade in on hover */}
      <div className="fixed bottom-3 left-3 z-10 flex items-center gap-1.5 opacity-30 transition hover:opacity-100">
        <Ctl onClick={() => nav('/tv')} label="Standard TV">
          <ArrowLeft size={14} /> <span className="text-[12px]">Standard TV</span>
        </Ctl>
        <Ctl onClick={() => setPaused((p) => !p)} label={paused ? 'Play' : 'Pause'}>
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </Ctl>
        <Ctl onClick={() => go(i + 1)} label="Next page">
          <SkipForward size={14} />
        </Ctl>
        <Ctl onClick={() => setPanel((p) => !p)} label="Settings">
          <Settings2 size={14} />
        </Ctl>
      </div>
      {panel && (
        <div className="fixed bottom-14 left-3 z-10 flex w-[280px] flex-col gap-3 rounded-[14px] bg-[#15171A]/95 p-4 text-[12px] text-white shadow-2xl" style={{ fontFamily: BAR }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9AA0A8]">Shopfloor TV · UI</div>
          <Row l="Theme">
            <Seg opts={['Light', 'Dark']} v={dark ? 'Dark' : 'Light'} on={(v) => setDark(v === 'Dark')} />
          </Row>
          <Row l="Screen">
            <Seg opts={['Auto', 'Landscape', 'Portrait']} v={orient[0].toUpperCase() + orient.slice(1)} on={(v) => setOrient(v.toLowerCase() as 'auto')} />
          </Row>
          <Row l={`OEE target ${T}%`}>
            <input type="range" min={50} max={90} step={5} value={T} onChange={(e) => setT(+e.target.value)} className="w-full accent-[#F26A21]" />
          </Row>
          <Row l={`Truck amber ${amber}′ · red ${red}′`}>
            <div className="flex gap-2">
              <input type="range" min={10} max={120} step={5} value={amber} onChange={(e) => setAmber(Math.min(+e.target.value, red - 5))} className="w-full accent-[#FFC233]" />
              <input type="range" min={20} max={240} step={5} value={red} onChange={(e) => setRed(Math.max(+e.target.value, amber + 5))} className="w-full accent-[#FF6A5A]" />
            </div>
          </Row>
          <Row l="Unit">
            <select value={unitId} onChange={(e) => (setSp({ u: e.target.value }), go(0))} className="w-full rounded-[6px] bg-white/10 px-2 py-1.5">
              {w.units.map((x) => (
                <option key={x.id} value={x.id} className="text-black">
                  {x.name}
                </option>
              ))}
            </select>
          </Row>
          <div className="text-[11px] leading-[16px] text-[#9AA0A8]">← → pages · Space pause · T theme · O portrait · Esc back</div>
        </div>
      )}
    </div>
  );
}

interface Ctx {
  w: World;
  ms: Machine[];
  th: Theme;
  T: number;
  amber: number;
  red: number;
  tk: ReturnType<typeof trucks>;
  portrait: boolean;
  unitId: string;
  name: string;
  sh: 'A' | 'B' | 'C';
}

function headFor(pg: Pg, c: Ctx, nPages: number) {
  const live = (
    <>
      {' · '}
      <b style={{ color: FG }}>● LIVE</b>
    </>
  );
  const sw = `Shift ${c.sh} ${SHIFT_WINDOWS[c.sh].replace(':00', '').replace(':00', '')}`;
  const range = (p: number) => `machines ${p * PER + 1}–${Math.min(c.ms.length, (p + 1) * PER)} of ${c.ms.length}`;
  const P = c.portrait;
  switch (pg.kind) {
    case 'timeline':
      return { title: P ? 'TIMELINE' : `${c.name} · TIMELINE ${pg.page + 1}/${nPages}`, sub: <>{P ? `${c.name.toLowerCase().replace(/(^|\s)\w/g, (x) => x.toUpperCase())} · ` : ''}{sw} · {range(pg.page)}{live}</> };
    case 'oee':
      return { title: P ? `${c.name} · OEE` : `${c.name} · OEE SUMMARY`, sub: <>Shift {c.sh} · target {c.T}%{live}</> };
    case 'hourly':
      return { title: P ? 'HOURLY OEE BY MACHINE' : `${c.name} · HOURLY OEE BY MACHINE`, sub: <>{sw} · {range(pg.page)} · target {c.T}%{live}</> };
    case 'worst':
      return { title: P ? 'MACHINES · WORST FIRST' : `${c.name} · MACHINES · WORST FIRST`, sub: <>Shift {c.sh} so far · page 1 of {Math.max(1, Math.ceil(c.ms.length / 10))} · target {c.T}%{live}</> };
    case 'reasons':
      return { title: P ? 'WHY MACHINES STOPPED' : `${c.name} · WHY MACHINES STOPPED`, sub: <>Shift {c.sh} so far · stop minutes by reason and owning team{live}</> };
    case 'avail':
      return { title: P ? 'AVAILABILITY · LOWEST FIRST' : `${c.name} · AVAILABILITY · LOWEST FIRST`, sub: <>Shift {c.sh} so far · run time ÷ planned time{live}</> };
    case 'trucks':
      return { title: P ? 'TRUCKS AT THE GATE' : `${c.name} · TRUCKS AT THE GATE`, sub: <>From gate entry · limits {c.amber}′ / {c.red}′{live}</> };
  }
}

/* ---------------- shared pieces ---------------- */

const f = (weight: number, size: number, family: string, lh?: number | string): CSSProperties => ({ fontWeight: weight, fontSize: size, fontFamily: family, lineHeight: lh ?? 'normal' });

interface NavItem {
  l: string;
  on: boolean;
  go: () => void;
  pages?: { l: string; on: boolean; go: () => void }[];
}

/** Page tabs (UI v3 header pills), clickable. The active multi-page tab shows its pages as circles. */
function PageNav({ items, portrait }: { items: NavItem[]; portrait?: boolean }) {
  const fs = portrait ? 20 : 18;
  return (
    <nav style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: portrait ? 'center' : undefined }} aria-label="TV pages">
      {items.map((p) => (
        <div key={p.l} style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 7, background: p.on ? ORANGE : '#1E2227', padding: p.on && p.pages ? '3px 4px 3px 0' : 0 }}>
          <button
            type="button"
            onClick={p.go}
            aria-current={p.on ? 'page' : undefined}
            style={{ ...f(700, fs, BAR), padding: portrait ? '8px 12px' : '7px 11px', borderRadius: 6, border: 0, cursor: 'pointer', background: 'transparent', color: p.on ? '#15171A' : '#9AA0A8' }}
            onMouseEnter={(e) => !p.on && (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={(e) => !p.on && (e.currentTarget.style.color = '#9AA0A8')}
          >
            {p.l}
          </button>
          {p.on &&
            p.pages?.map((n) => (
              <button
                key={n.l}
                type="button"
                onClick={n.go}
                aria-label={`${p.l} page ${n.l}`}
                style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${n.on ? '#15171A' : 'rgba(21,23,26,.35)'}`, background: n.on ? '#15171A' : 'transparent', color: n.on ? ORANGE : '#15171A', cursor: 'pointer', ...f(700, 22, COND, 1) }}
              >
                {n.l}
              </button>
            ))}
        </div>
      ))}
    </nav>
  );
}

function Header({ th, portrait, title, sub, nav, clock }: { th: Theme; portrait: boolean; title: string; sub: ReactNode; nav: ReactNode; clock: string }) {
  return (
    <header style={{ height: portrait ? 130 : 104, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: portrait ? '0 30px' : '0 36px', background: th.hd, color: '#fff', borderBottom: portrait ? 'none' : '2px solid #1E2227', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: portrait ? 16 : 20, minWidth: 0 }}>
        <img src={logo} alt="United Industries" style={{ height: portrait ? 56 : 54, width: 'auto', flex: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ ...f(700, 46, COND, 1), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
          <span style={{ ...f(500, 24, BAR), color: '#9AA0A8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: portrait ? 16 : 22, flex: 'none' }}>
        {nav}
        <span style={f(700, portrait ? 84 : 80, COND, 1)}>{clock}</span>
      </div>
    </header>
  );
}

function TruckBand({ c }: { c: Ctx }) {
  const { th, tk, amber, red, portrait } = c;
  const list = tk.inside.slice(0, 4);
  const overL = tk.overRed.length ? `${tk.overRed.length} over ${red}′` : tk.overAmber.length ? `${tk.overAmber.length} over ${amber}′` : 'all within limit';
  const cell = (k: (typeof list)[0]) => {
    const tone = waitTone(k.wait, amber, red);
    return (
      <div key={k.k.id} style={{ background: th.truck, border: `1px solid ${th.line}`, borderLeft: `10px solid ${({ g: FG, a: FA, r: FR })[tone]}`, borderRadius: 8, padding: portrait ? '4px 14px' : '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ ...f(700, portrait ? 30 : 34, COND, 1), whiteSpace: 'nowrap' }}>{k.k.plate}</span>
          {!portrait && <span style={{ ...f(600, 22, BAR), color: th.mu, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.k.dir} · {k.k.partyShort}{k.k.dir === 'IN' ? ' · ' + k.k.party.split(' ')[0].toLowerCase() : ''}</span>}
        </div>
        <span style={{ ...f(700, portrait ? 44 : 54, COND, 1), color: th[tone] }}>{mins(k.wait)}</span>
      </div>
    );
  };
  const empty = (n: number) => Array.from({ length: Math.max(0, 4 - n) }, (_, k) => <div key={'e' + k} style={{ borderRadius: 8, border: `1px dashed ${th.line}` }} />);
  if (portrait)
    return (
      <div style={{ height: 170, flex: 'none', margin: '14px 24px 16px', display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10 }}>
        <div style={{ gridRow: 'span 2', background: YELLOW, color: '#15171A', borderRadius: 8, padding: '10px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ ...f(700, 20, BAR), letterSpacing: '.08em' }}>TRUCKS INSIDE</span>
          <span style={f(700, 70, COND, 1)}>{tk.inside.length}</span>
          <span style={f(700, 24, BAR)}>{overL}</span>
        </div>
        {list.map(cell)}
        {empty(list.length)}
      </div>
    );
  return (
    <div style={{ height: 96, flex: 'none', margin: '16px 36px 16px', display: 'grid', gridTemplateColumns: '260px repeat(4, minmax(0,1fr))', gap: 12 }}>
      <div style={{ background: YELLOW, color: '#15171A', borderRadius: 8, padding: '8px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ ...f(700, 20, BAR), letterSpacing: '.08em' }}>TRUCKS INSIDE</span>
        <span style={f(700, 46, COND, 1)}>
          {tk.inside.length} <span style={{ fontSize: 26 }}>· {overL}</span>
        </span>
      </div>
      {list.map(cell)}
      {empty(list.length)}
    </div>
  );
}

function Panel({ th, children, style }: { th: Theme; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: th.panel, border: `1px solid ${th.line}`, borderRadius: 10, ...style }}>{children}</div>;
}
const Label = ({ th, children, style }: { th: Theme; children: ReactNode; style?: CSSProperties }) => <span style={{ ...f(700, 26, BAR), letterSpacing: '.06em', color: th.mu, ...style }}>{children}</span>;
const hatch = (c: string, a = 12, b = 20) => `repeating-linear-gradient(135deg, ${c} 0 ${a}px, rgba(0,0,0,.3) ${a}px ${b}px)`;

function Brand({ brand, bc, size = 17, box }: { brand: string; bc: string; size?: number; box?: boolean }) {
  return (
    <span style={{ flex: 'none', padding: box ? 0 : '3px 8px', width: box ? 112 : undefined, height: box ? 44 : undefined, display: box ? 'grid' : 'inline-block', placeItems: 'center', borderRadius: box ? 6 : 5, background: '#fff', border: '1px solid #D5D2CA', ...f(800, size, BAR, 1), color: bc, whiteSpace: 'nowrap' }}>
      {brand}
    </span>
  );
}

function NowBox({ n, portrait, big = 48 }: { n: ReturnType<typeof nowCell>; portrait?: boolean; big?: number }) {
  if (portrait)
    return (
      <div style={{ borderRadius: 6, background: n.bg, color: n.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: 6, minWidth: 0 }}>
        <span style={f(700, 46, COND, 1)}>{n.v || '●'}</span>
        <span style={{ ...f(700, 19, BAR, 1.1) }}>{n.l}</span>
        <span style={{ ...f(600, 17, BAR, 1.1), opacity: 0.92 }}>{n.s}</span>
      </div>
    );
  return (
    <div style={{ borderRadius: 6, background: n.bg, color: n.fg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 16px', minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ ...f(700, 26, BAR, 1.1), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.l}</span>
        <span style={{ ...f(600, 21, BAR, 1.1), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.92 }}>{n.s}</span>
      </div>
      <span style={{ ...f(700, big, COND, 1), whiteSpace: 'nowrap' }}>{n.v}</span>
    </div>
  );
}

function Legend({ th, items, right, size = 22 }: { th: Theme; items: [string, string][]; right?: ReactNode; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 22, padding: '10px 16px', borderTop: `1px solid ${th.line}`, ...f(600, size, BAR), color: th.mu, alignItems: 'center', flexWrap: 'wrap' }}>
      {items.map(([bg, l]) => (
        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          {bg === 'dash' ? <i style={{ width: 34, borderTop: `3px dashed ${th.mu}` }} /> : <i style={{ width: 30, height: 20, borderRadius: 4, background: bg, border: bg === 'transparent' ? `1px solid ${th.line}` : undefined }} />}
          {l}
        </span>
      ))}
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  );
}

/* ---------------- TIMELINE (status through the shift) ---------------- */

function segBg(s: Segment, w: World) {
  if (s.s === 'RUN') return FG;
  if (s.s === 'IDLE') return FA;
  if (s.s === 'MC') return hatch(MC_PURPLE);
  if (s.s === 'OFF') return hatch('#5A5F67');
  const tk = s.ticketId ? w.ticket[s.ticketId] : undefined;
  const team = s.team && s.stage !== 'unassigned' ? s.team : tk?.team && s.stage !== 'unassigned' ? tk.team : null;
  return team ? hatch(TEAM_TAG[team].c) : FR;
}

function TimelinePage({ c, page }: { c: Ctx; page: number }) {
  const { w, th, portrait } = c;
  const rows = c.ms.slice(page * PER, page * PER + PER);
  const s0 = shiftStartOf(w.t);
  const hours = shiftHours(w);
  const nowPct = ((w.t - s0) / SHIFT_LEN) * 100;
  const cols = portrait ? '230px minmax(0,1fr) 160px' : '360px minmax(0,1fr) 360px';
  return (
    <Panel th={th} style={{ flex: 1, minHeight: 0, margin: portrait ? '14px 24px 0' : '14px 36px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '10px 16px 6px', ...f(700, portrait ? 24 : 26, BAR), color: th.mu, alignItems: 'end' }}>
        <span>{portrait ? 'MACHINE' : 'MACHINE · PART'}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)' }}>
          {hours.map((h) => (
            <span key={h.l} style={{ color: h.state === 'now' ? th.tx : h.state === 'future' ? (th.dark ? '#4A4F57' : '#B5B2AA') : th.mu }}>{portrait ? h.s : h.l}</span>
          ))}
        </div>
        <span style={{ textAlign: portrait ? 'center' : undefined }}>NOW</span>
      </div>
      {rows.map((m) => {
        const mi = machineInfo(w, m);
        const n = nowCell(w, m, th);
        return (
          <div key={m.id} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '8px 16px', borderTop: `1px solid ${th.line}` }}>
            <MachineCell mi={mi} th={th} portrait={portrait} plan={m.state === 'OFF'} />
            <div style={{ position: 'relative', alignSelf: 'stretch', margin: '6px 0', borderRadius: 6, overflow: 'hidden', background: th.slot }}>
              {m.timeline.map((s, k) => {
                const a = Math.max(s.start, s0);
                const e = k === m.timeline.length - 1 ? w.t : s.end;
                if (e <= a) return null;
                const left = ((a - s0) / SHIFT_LEN) * 100;
                const wd = ((e - a) / SHIFT_LEN) * 100;
                const lab = s.s === 'DOWN' || s.s === 'MC' ? (s.s === 'MC' ? 'M/C' : s.team && s.stage !== 'unassigned' ? TEAM_TAG[s.team as keyof typeof TEAM_TAG]?.short : 'STOP') : '';
                return (
                  <div key={k} style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${wd}%`, background: segBg(s, w), display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                    {wd > 5 && lab && <span style={{ ...f(700, 22, BAR), color: '#fff', letterSpacing: '.04em', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>{lab}</span>}
                  </div>
                );
              })}
              {/* hour gridlines + now line */}
              {[1, 2, 3, 4, 5, 6, 7].map((h) => (
                <div key={h} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(h / 8) * 100}%`, borderLeft: `1px solid ${th.dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'}` }} />
              ))}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${nowPct}%`, width: 4, marginLeft: -2, background: th.tx }} />
            </div>
            <NowBox n={n} portrait={portrait} />
          </div>
        );
      })}
      <Legend
        th={th}
        size={portrait ? 19 : 22}
        items={[
          [FG, 'running'],
          [FA, 'idle'],
          [FR, 'stopped · not assigned'],
          [hatch('#F97316'), 'MAINT'],
          [hatch('#3B82F6'), 'MOULD'],
          [hatch('#0F9D8F'), 'MAT'],
          [hatch(MC_PURPLE), 'M/C = mould change'],
          [hatch('#5A5F67'), 'NO PLAN'],
        ]}
        right={portrait ? undefined : <>white line = now</>}
      />
    </Panel>
  );
}

function MachineCell({ mi, th, portrait, plan }: { mi: ReturnType<typeof machineInfo>; th: Theme; portrait: boolean; plan: boolean }) {
  if (portrait)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, minWidth: 0 }}>
        <span style={f(700, 44, COND, 1)}>{mi.id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brand brand={mi.brand} bc={mi.bc} size={16} />
          <span style={{ ...f(600, 18, BAR), color: th.mu }}>{mi.ton}</span>
        </div>
        <span style={{ ...f(700, 23, BAR, 1.15), color: plan ? th.mu : th.tx, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mi.part}</span>
      </div>
    );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={f(700, 42, COND, 1)}>{mi.id}</span>
        <Brand brand={mi.brand} bc={mi.bc} />
        <span style={{ ...f(600, 20, BAR), color: th.mu }}>{mi.ton}</span>
      </div>
      <span style={{ ...f(700, 26, BAR, 1.1), color: plan ? th.mu : th.tx, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mi.part}</span>
    </div>
  );
}

/* ---------------- OEE SUMMARY (14a / 14c) ---------------- */

function OeePage({ c }: { c: Ctx }) {
  const { w, th, T, portrait } = c;
  const s = summary(w, c.unitId, c.ms);
  const tr = trend12(w, c.unitId, c.ms);
  const losses = topLosses(w, c.ms);
  const tPct = ((T - 30) / 70) * 94;
  const blocks = [
    { b: s.hour, d: s.hour.prev ? s.hour.oee - s.hour.prev.oee : 0, apqD: s.hour.prev ? [s.hour.A - s.hour.prev.A, s.hour.P - s.hour.prev.P, s.hour.Q - s.hour.prev.Q] : [0, 0, 0], secC: s.hour.secD > 0 ? th.r : th.g },
    { b: s.month, d: s.month.oee - s.month.prev.oee, apqD: [s.month.A - s.month.prev.A, s.month.P - s.month.prev.P, s.month.Q - s.month.prev.Q], secC: th.g },
  ];
  const apqT = [90, 90, 98];
  const apqFill = (v: number, t: number) => (v >= t ? FG : v >= t - 8 ? FA : FR);
  const apqTxt = (v: number, t: number) => (v >= t ? th.g : v >= t - 8 ? th.a : th.r);

  const block = (x: (typeof blocks)[0], key: number, short?: boolean) => {
    const oee = Math.round(x.b.oee);
    const dd = delta(x.d);
    const vals = [x.b.A, x.b.P, x.b.Q];
    return (
      <Panel key={key} th={th} style={{ borderTop: `8px solid ${fill(oee, T)}`, padding: portrait ? '14px 18px' : '16px 22px', display: 'flex', flexDirection: 'column', gap: portrait ? 10 : 12, minHeight: 0 }}>
        <Label th={th} style={portrait ? { fontSize: 24, letterSpacing: '.04em' } : undefined}>{short ? x.b.short : x.b.label}</Label>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ ...f(700, portrait ? 124 : 132, COND, 0.85), color: txt(oee, T, th) }}>
            {oee}
            <span style={{ fontSize: portrait ? 56 : 60 }}>%</span>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            {!portrait && <span style={{ ...f(700, 26, BAR), color: th.mu }}>OEE</span>}
            <span style={{ ...f(700, portrait ? 38 : 40, COND, 1), color: dcol(dd, th) }}>{dd}</span>
            <span style={{ ...f(600, portrait ? 20 : 22, BAR), color: th.mu }}>{x.b.vs}</span>
          </div>
        </div>
        <div style={{ flex: portrait ? undefined : 1, display: 'grid', gridTemplateColumns: portrait ? '1fr' : 'repeat(3,1fr)', gap: portrait ? 8 : 10 }}>
          {['AVAILABILITY', 'PERFORMANCE', 'QUALITY'].map((l, k) => {
            const v = Math.round(vals[k]);
            const qd = delta(x.apqD[k]);
            const alt = k === 0 ? '= utilisation' : k === 1 ? '= productivity' : '';
            return portrait ? (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: th.panel2, borderLeft: `8px solid ${apqFill(v, apqT[k])}`, borderRadius: 6, padding: '6px 12px' }}>
                <span style={{ display: 'flex', flexDirection: 'column', ...f(700, 22, BAR, 1.1), color: th.mu }}>
                  {l}
                  <span style={f(600, 18, BAR)}>{alt}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <b style={{ ...f(700, 50, COND, 1), color: apqTxt(v, apqT[k]) }}>{v}%</b>
                  <span style={{ ...f(700, 22, BAR), color: dcol(qd, th), width: 54, textAlign: 'right' }}>{qd}</span>
                </span>
              </div>
            ) : (
              <div key={l} style={{ background: th.panel2, borderRadius: 8, borderLeft: `8px solid ${apqFill(v, apqT[k])}`, padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                <span style={{ ...f(700, 20, BAR, 1.1), letterSpacing: '.04em', color: th.mu }}>
                  {l} <span style={{ fontWeight: 600, letterSpacing: 0 }}>{alt}</span>
                </span>
                <span style={{ ...f(700, 60, COND, 1), color: apqTxt(v, apqT[k]) }}>{v}%</span>
                <span style={{ ...f(700, 24, BAR), color: dcol(qd, th) }}>{qd}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderTop: `1px solid ${th.line}`, paddingTop: 8, whiteSpace: 'nowrap', flexWrap: portrait ? 'wrap' : undefined }}>
          <span style={{ ...f(700, portrait ? 20 : 22, BAR), letterSpacing: '.06em', color: th.mu }}>ENERGY</span>
          <span style={f(700, portrait ? 34 : 36, COND, 1)}>{x.b.kwhL}</span>
          <span style={f(700, portrait ? 34 : 36, COND, 1)}>
            {x.b.sec.toFixed(2)} <span style={{ ...f(600, 24, BAR), color: th.mu }}>kWh/kg</span>
          </span>
          <span style={{ ...f(700, 26, BAR), color: x.secC }}>{(x.b.secD > 0 ? '▲ ' : '▼ ') + Math.abs(x.b.secD).toFixed(2)}</span>
        </div>
      </Panel>
    );
  };

  const trend = (fs: number) => (
    <>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gridTemplateRows: '100%', gap: portrait ? 6 : 8, alignItems: 'end' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${tPct}%`, borderTop: `4px dashed ${th.mu}` }} />
        {tr.map((t, k) => (
          <div key={k} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
            <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(4, ((t.v - 30) / 70) * 94)}%` }} transition={{ duration: 0.8, delay: k * 0.04, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'relative', zIndex: 1, width: '100%', background: fill(t.v, T), borderRadius: '4px 4px 0 0', outline: t.now ? `4px dashed ${th.tx}` : 'none', outlineOffset: -4, display: 'flex', justifyContent: 'center', paddingTop: 6, ...f(700, fs, COND, 1), color: '#0B0D10', overflow: 'hidden' }}>
              {t.v}
            </motion.div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: portrait ? 6 : 8, textAlign: 'center' }}>
        {tr.map((t, k) => (
          <span key={k} style={{ ...f(700, portrait ? 24 : 26, BAR), color: t.now ? th.tx : th.mu }}>{t.hr}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: portrait ? 6 : 8, textAlign: 'center' }}>
        {tr.map((t, k) => (
          <div key={k} style={{ background: t.shift === 'prev' ? '#4A4F57' : ORANGE, color: t.shift === 'prev' ? '#fff' : '#15171A', borderRadius: 4, padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={f(700, portrait ? 26 : 28, COND, 1)}>{t.kwh}</span>
            <span style={f(700, portrait ? 24 : 26, COND, 1)}>{t.sec.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </>
  );
  const prevShift = c.sh === 'A' ? 'C' : c.sh === 'B' ? 'A' : 'B';

  if (portrait)
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '16px 30px 0' }}>
          {blocks.map((x, k) => block(x, k, true))}
        </div>
        <Panel th={th} style={{ height: 560, flex: 'none', margin: '14px 30px 0', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label th={th} style={{ fontSize: 24 }}>OEE · LAST 12 HOURS</Label>
            <span style={{ ...f(600, 20, BAR), color: th.mu }}>grey = shift {prevShift} · orange = shift {c.sh}</span>
          </div>
          {trend(36)}
        </Panel>
        <div style={{ flex: 1, minHeight: 0, margin: '14px 30px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Label th={th} style={{ fontSize: 24 }}>TOP 3 LOSSES NOW · OEE POINTS THIS SHIFT</Label>
          {losses.map((l) => (
            <Panel key={l.m.id} th={th} style={{ flex: 1, borderLeft: `12px solid ${TEAM_TAG[l.team].c}`, borderRadius: 8, padding: '10px 18px', display: 'grid', gridTemplateColumns: '170px minmax(0,1fr) 130px', gap: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={f(700, 50, COND, 1)}>{l.m.code}</span>
                <span style={f(700, 32, COND, 1)}>{l.timer}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span style={{ ...f(700, 26, BAR, 1.15), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.t}</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ ...f(700, 20, BAR), padding: '3px 10px', borderRadius: 5, background: TEAM_TAG[l.team].c, color: '#fff' }}>{TEAM_TAG[l.team].long}</span>
                  <span style={{ ...f(700, 22, BAR), color: th[l.stage.tone] }}>{l.stage.l}</span>
                </div>
              </div>
              <span style={{ ...f(700, 52, COND, 1), color: th.r, textAlign: 'right' }}>−{Math.max(1, Math.round(l.pts))} pts</span>
            </Panel>
          ))}
        </div>
      </>
    );

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 560px', gridTemplateRows: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 16, padding: '16px 36px 0' }}>
      {blocks.map((x, k) => block(x, k))}
      <Panel th={th} style={{ gridRow: 'span 2', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Label th={th}>TOP 3 LOSSES NOW</Label>
        {losses.map((l) => (
          <div key={l.m.id} style={{ flex: 1, background: th.panel2, borderLeft: `12px solid ${TEAM_TAG[l.team].c}`, borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={f(700, 54, COND, 1)}>{l.m.code}</span>
              <span style={{ ...f(700, 48, COND, 1), color: th.r }}>−{Math.max(1, Math.round(l.pts))} pts</span>
            </div>
            <span style={{ ...f(700, 26, BAR, 1.15), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.t}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ ...f(700, 22, BAR), padding: '4px 10px', borderRadius: 5, background: TEAM_TAG[l.team].c, color: '#fff' }}>{TEAM_TAG[l.team].long}</span>
              <span style={{ ...f(700, 24, BAR), color: th[l.stage.tone] }}>{l.stage.l}</span>
              <span style={{ ...f(700, 32, COND, 1), marginLeft: 'auto' }}>{l.timer}</span>
            </div>
          </div>
        ))}
        <span style={{ ...f(600, 20, BAR), color: th.mu }}>pts = OEE points lost this shift</span>
      </Panel>
      <Panel th={th} style={{ gridColumn: 'span 2', padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label th={th}>OEE · LAST 12 HOURS</Label>
          <span style={{ ...f(600, 22, BAR), color: th.mu }}>dashed = target · scale from 30% · under each hour: kWh, kWh/kg · grey = shift {prevShift}, orange = shift {c.sh}</span>
        </div>
        {trend(40)}
      </Panel>
    </div>
  );
}

/* ---------------- HOURLY OEE BY MACHINE (14g / 14h) ---------------- */

function HourlyPage({ c, page }: { c: Ctx; page: number }) {
  const { w, th, T, portrait } = c;
  const rows = c.ms.slice(page * PER, page * PER + PER);
  const hours = shiftHours(w);
  const tBar = ((T - 30) / 70) * 80;
  const cols = portrait ? '230px repeat(8,minmax(0,1fr)) 160px' : '360px repeat(8,minmax(0,1fr)) 360px';
  return (
    <Panel th={th} style={{ flex: 1, minHeight: 0, margin: portrait ? '14px 24px 0' : '14px 36px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: portrait ? 6 : 10, padding: portrait ? '10px 12px 6px' : '10px 16px 6px', ...f(700, portrait ? 24 : 26, BAR), color: th.mu, alignItems: 'end' }}>
        <span>{portrait ? 'MACHINE' : 'MACHINE · PART'}</span>
        {hours.map((h) => (
          <span key={h.l} style={{ textAlign: 'center', color: h.state === 'now' ? th.tx : h.state === 'future' ? (th.dark ? '#4A4F57' : '#B5B2AA') : th.mu }}>{portrait ? h.s : h.l}</span>
        ))}
        <span style={{ textAlign: portrait ? 'center' : undefined }}>NOW</span>
      </div>
      {rows.map((m) => {
        const mi = machineInfo(w, m);
        const bars = hourBars(w, m);
        return (
          <div key={m.id} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: cols, gap: portrait ? 6 : 10, padding: portrait ? '8px 12px' : '6px 16px', borderTop: `1px solid ${th.line}` }}>
            <MachineCell mi={mi} th={th} portrait={portrait} plan={m.state === 'OFF'} />
            {bars.map((b, j) => {
              if (b.kind === 'future') return <div key={j} />;
              const fs = portrait ? 38 : 32;
              let h = 0,
                bg = '',
                inside = true,
                label = '',
                v: string | number = '';
              if (b.kind === 'plan') (h = 24), (bg = hatch(TEAM_TAG.planning.c)), (inside = false), (v = '—');
              else if (b.kind === 'stop') (h = 60), (bg = hatch(b.c)), (inside = false), (label = b.lab), (v = b.v ?? 0);
              else {
                const val = b.v ?? 0;
                h = Math.max(6, ((val - 30) / 70) * 80);
                bg = fill(val, T);
                inside = h >= 38;
                v = val;
              }
              return (
                <div key={j} style={{ position: 'relative', minWidth: 0, background: th.slot, borderRadius: '4px 4px 0 0', borderBottom: `3px solid ${th.line}` }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${tBar}%`, borderTop: `3px dashed ${th.mu}` }} />
                  <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.7, delay: j * 0.03, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'absolute', left: '8%', right: '8%', bottom: 0, background: bg, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 5, overflow: 'hidden', outline: b.now ? `3px dashed ${th.tx}` : undefined, outlineOffset: -3 }}>
                    {inside && <span style={{ ...f(700, fs, COND, 1), color: '#0B0D10' }}>{v}</span>}
                    {label && <span style={{ ...f(700, 22, BAR, 1), color: '#fff', letterSpacing: '.04em', writingMode: portrait ? 'vertical-rl' : undefined, transform: portrait ? 'rotate(180deg)' : undefined, textShadow: '0 1px 2px rgba(0,0,0,.45)' }}>{label}</span>}
                  </motion.div>
                  {!inside && <span style={{ position: 'absolute', left: 0, right: 0, bottom: b.tag ? `calc(${h}% + 30px)` : `${h}%`, textAlign: 'center', ...f(700, fs, COND, 1), color: b.kind === 'oee' ? txt(b.v ?? 0, T, th) : th.mu, paddingBottom: 4 }}>{v}</span>}
                  {b.tag && <span style={{ position: 'absolute', left: '8%', right: '8%', bottom: `${h}%`, background: MC_PURPLE, color: '#fff', textAlign: 'center', ...f(700, 22, BAR, 1), padding: '4px 0', borderRadius: '4px 4px 0 0' }}>M/C</span>}
                </div>
              );
            })}
            <NowBox n={nowCell(w, m, th)} portrait={portrait} />
          </div>
        );
      })}
      <Legend
        th={th}
        size={portrait ? 19 : 22}
        items={[
          [FG, `≥ ${T}%`],
          [FA, `${T - 15}–${T}%`],
          [FR, `< ${T - 15}%`],
          [hatch('#F97316'), 'MAINT'],
          [hatch('#3B82F6'), 'MOULD'],
          [hatch('#0F9D8F'), 'MAT'],
          [MC_PURPLE, 'M/C = mould change that hour'],
          ...(portrait ? [] : ([['transparent', 'bar scale starts at 30%']] as [string, string][])),
          ['dash', 'target'],
        ]}
      />
    </Panel>
  );
}

/* ---------------- MACHINES · WORST FIRST (14b / 14d) ---------------- */

function WorstPage({ c }: { c: Ctx }) {
  const { w, th, T, portrait } = c;
  const { rows, unplanned } = ranking(w, c.ms);
  const top = rows.slice(0, 10);
  const segs = (r: (typeof rows)[0]) => {
    const o = r.oee;
    const lab = (pre: string, v: number) => (v >= 5 ? `${pre} −${Math.round(v)}` : '');
    return [
      { w: o, bg: th.dark ? '#E9E7E1' : '#2A2D31', fg: th.dark ? ({ g: '#14713E', a: '#8A6700', r: '#B02A1F' })[o >= T ? 'g' : o >= T - 15 ? 'a' : 'r'] : fill(o, T), t: `${Math.round(o)}%` },
      { w: r.aLoss, bg: hatch('#D8382B', 14, 22), fg: '#fff', t: lab('A', r.aLoss) },
      { w: r.pLoss, bg: hatch('#B07A00', 14, 22), fg: '#fff', t: lab('P', r.pLoss) },
      { w: r.qLoss, bg: hatch('#BE185D', 14, 22), fg: '#fff', t: lab('Q', r.qLoss) },
    ];
  };
  const lossBar = (r: (typeof rows)[0], h: number, fs: number) => (
    <div style={{ position: 'relative', flex: 1, height: h }}>
      <div style={{ height: '100%', display: 'flex', borderRadius: 6, overflow: 'hidden', background: th.panel2 }}>
        {segs(r).map((s, k) => (
          <motion.div key={k} initial={{ width: 0 }} animate={{ width: `${Math.max(0, s.w)}%` }} transition={{ duration: 0.8, delay: 0.1 + k * 0.08, ease: [0.22, 1, 0.36, 1] }} style={{ background: s.bg, color: s.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', ...f(700, fs, COND, 1), whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {s.t}
          </motion.div>
        ))}
      </div>
      <div style={{ position: 'absolute', top: -12, height: 10, left: `${T}%`, width: 6, marginLeft: -3, background: th.tx }} />
      <div style={{ position: 'absolute', bottom: -12, height: 10, left: `${T}%`, width: 6, marginLeft: -3, background: th.tx }} />
    </div>
  );
  const lastH = (r: (typeof rows)[0]) => {
    const h = r.lastH ?? Math.round(r.oee);
    const d = r.lastH !== null && r.prevH !== null ? r.lastH - r.prevH : 0;
    return { h, hc: txt(h, T, th), d: d === 0 ? '—' : `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`, dc: d > 0 ? th.g : d < 0 ? th.r : th.mu };
  };
  const legend: [string, string][] = [
    [th.dark ? '#E9E7E1' : '#2A2D31', portrait ? 'OEE achieved' : 'OEE achieved (number coloured by target band)'],
    ['#D8382B', 'A = lost to stops'],
    ['#B07A00', 'P = lost to slow cycles'],
    ['#BE185D', 'Q = lost to rejects'],
    [th.tx, 'tick = target'],
  ];
  const note = unplanned ? `${unplanned} machine${unplanned > 1 ? 's' : ''} with no plan ${unplanned > 1 ? 'are' : 'is'} not ranked` : undefined;

  if (portrait)
    return (
      <Panel th={th} style={{ flex: 1, minHeight: 0, margin: '14px 24px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {top.map((r, i) => {
          const mi = machineInfo(w, r.m);
          const n = nowCell(w, r.m, th);
          const L = lastH(r);
          return (
            <div key={r.m.id} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)', gap: 12, padding: '8px 16px', borderBottom: `1px solid ${th.line}` }}>
              <span style={{ display: 'flex', alignItems: 'center', ...f(700, 44, COND, 1), color: th.mu }}>{i + 1}</span>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={f(700, 44, COND, 1)}>{mi.id}</span>
                  <Brand brand={mi.brand} bc={mi.bc} />
                  <span style={{ ...f(600, 20, BAR), color: th.mu, whiteSpace: 'nowrap' }}>
                    last hr <b style={{ color: L.hc }}>{L.h}%</b> <b style={{ color: L.dc }}>{L.d}</b>
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', borderRadius: 6, background: n.bg, color: n.fg, whiteSpace: 'nowrap' }}>
                    <b style={f(700, 20, BAR)}>{n.p}</b>
                    {n.v && n.v !== '●' && <b style={f(700, 34, COND, 1)}>{n.v}</b>}
                  </span>
                </div>
                {lossBar(r, 48, 30)}
              </div>
            </div>
          );
        })}
        <Legend th={th} size={19} items={legend} right={note} />
      </Panel>
    );

  const cols = '56px 300px minmax(0,1fr) 170px 380px';
  return (
    <Panel th={th} style={{ flex: 1, minHeight: 0, margin: '14px 36px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '10px 16px 6px', ...f(700, 24, BAR), color: th.mu, alignItems: 'end' }}>
        <span>#</span>
        <span>MACHINE</span>
        <span>SHIFT OEE AND WHERE THE REST WENT</span>
        <span style={{ textAlign: 'center' }}>LAST HOUR</span>
        <span>NOW</span>
      </div>
      {top.map((r, i) => {
        const mi = machineInfo(w, r.m);
        const L = lastH(r);
        return (
          <div key={r.m.id} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '4px 16px', alignItems: 'stretch', borderTop: `1px solid ${th.line}` }}>
            <span style={{ display: 'flex', alignItems: 'center', ...f(700, 40, COND, 1), color: th.mu }}>{i + 1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <Brand brand={mi.brand} bc={mi.bc} size={18} box />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={f(700, 40, COND, 1)}>{mi.id}</span>
                <span style={{ ...f(600, 20, BAR), color: th.mu }}>{mi.ton}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {lossBar(r, 54, 32)}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, alignSelf: 'center' }}>
              <span style={{ ...f(700, 50, COND, 1), color: L.hc }}>{L.h}%</span>
              <span style={{ ...f(700, 24, BAR), color: L.dc }}>{L.d}</span>
            </div>
            <NowBox n={nowCell(w, r.m, th)} big={46} />
          </div>
        );
      })}
      <Legend th={th} items={legend} right={note} />
    </Panel>
  );
}

/* ---------------- REASONS ---------------- */

function ReasonsPage({ c }: { c: Ctx }) {
  const { w, th, portrait } = c;
  const r = reasons(w, c.ms);
  const max = Math.max(1, ...r.list.map((x) => x.sec));
  return (
    <Panel th={th} style={{ flex: 1, minHeight: 0, margin: portrait ? '14px 24px 0' : '14px 36px 0', padding: portrait ? '14px 18px' : '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Label th={th}>STOP MINUTES BY REASON</Label>
        <span style={{ ...f(700, 36, COND, 1) }}>
          {hm(r.total)} <span style={{ ...f(600, 22, BAR), color: th.mu }}>machine-time lost</span>
        </span>
      </div>
      {r.list.map((x, k) => {
        const tag = TEAM_TAG[x.team === 'unassigned' ? 'none' : x.team];
        const share = r.total ? (x.sec / r.total) * 100 : 0;
        return (
          <div key={x.label} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: portrait ? '1fr' : '520px minmax(0,1fr) 200px', gap: portrait ? 6 : 18, alignItems: 'center', borderTop: `1px solid ${th.line}`, paddingTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <span style={{ ...f(700, 22, BAR), padding: '4px 10px', borderRadius: 5, background: tag.c, color: '#fff', flex: 'none', minWidth: 120, textAlign: 'center' }}>{tag.short}</span>
              <span style={{ ...f(700, portrait ? 28 : 30, BAR, 1.1), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, height: portrait ? 40 : 50, background: th.panel2, borderRadius: 6, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(x.sec / max) * 100}%` }} transition={{ duration: 0.8, delay: k * 0.06, ease: [0.22, 1, 0.36, 1] }} style={{ height: '100%', background: x.team === 'unassigned' ? FR : hatch(tag.c, 14, 22), borderRadius: 6 }} />
              </div>
              {portrait && <span style={{ ...f(700, 44, COND, 1), width: 150, textAlign: 'right' }}>{hm(x.sec)}</span>}
            </div>
            {!portrait && (
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 10 }}>
                <span style={f(700, 50, COND, 1)}>{hm(x.sec)}</span>
                <span style={{ ...f(700, 24, BAR), color: th.mu }}>{share.toFixed(0)}%</span>
              </div>
            )}
          </div>
        );
      })}
      {r.noReason > 0 && (
        <div style={{ background: th.badBg, color: th.r, borderRadius: 8, padding: '10px 16px', ...f(700, 26, BAR) }}>
          {r.noReason} stop{r.noReason > 1 ? 's' : ''} still without a team — supervisor, assign them now
        </div>
      )}
    </Panel>
  );
}

/* ---------------- AVAILABILITY ---------------- */

function AvailPage({ c }: { c: Ctx }) {
  const { th, portrait } = c;
  const list = availRank(c.ms).slice(0, portrait ? 14 : 10);
  const AT = 90;
  return (
    <Panel th={th} style={{ flex: 1, minHeight: 0, margin: portrait ? '14px 24px 0' : '14px 36px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: portrait ? '200px minmax(0,1fr) 120px' : '56px 300px minmax(0,1fr) 170px 360px', gap: 14, padding: '10px 16px 6px', ...f(700, 24, BAR), color: th.mu }}>
        {!portrait && <span>#</span>}
        <span>MACHINE</span>
        <span>RUN · IDLE · MOULD CHANGE · STOPPED (share of planned time)</span>
        <span style={{ textAlign: 'center' }}>AVAIL.</span>
        {!portrait && <span>NOW</span>}
      </div>
      {list.map((x, i) => {
        const mi = machineInfo(c.w, x.m);
        const P = x.m.plannedSec || 1;
        const parts = [
          { v: (x.m.runSec / P) * 100, bg: FG, t: 'run' },
          { v: (x.idle / P) * 100, bg: FA, t: 'idle' },
          { v: (x.mc / P) * 100, bg: hatch(MC_PURPLE, 14, 22), t: 'M/C' },
          { v: (x.down / P) * 100, bg: hatch('#D8382B', 14, 22), t: 'stop' },
        ];
        return (
          <div key={x.m.id} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: portrait ? '200px minmax(0,1fr) 120px' : '56px 300px minmax(0,1fr) 170px 360px', gap: 14, padding: '4px 16px', alignItems: 'stretch', borderTop: `1px solid ${th.line}` }}>
            {!portrait && <span style={{ display: 'flex', alignItems: 'center', ...f(700, 40, COND, 1), color: th.mu }}>{i + 1}</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {!portrait && <Brand brand={mi.brand} bc={mi.bc} size={18} box />}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={f(700, 40, COND, 1)}>{mi.id}</span>
                <span style={{ ...f(600, 20, BAR), color: th.mu }}>{portrait ? mi.brand + ' · ' : ''}{mi.ton}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, height: 50 }}>
                <div style={{ height: '100%', display: 'flex', borderRadius: 6, overflow: 'hidden', background: th.panel2 }}>
                  {parts.map((p, k) => (
                    <motion.div key={k} initial={{ width: 0 }} animate={{ width: `${p.v}%` }} transition={{ duration: 0.8, delay: k * 0.08, ease: [0.22, 1, 0.36, 1] }} style={{ background: p.bg, display: 'grid', placeItems: 'center', ...f(700, 26, COND, 1), color: k === 0 || k === 1 ? '#0B0D10' : '#fff', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {p.v >= 9 ? (k === 0 ? `${Math.round(p.v)}%` : `${p.t} ${Math.round(p.v)}`) : ''}
                    </motion.div>
                  ))}
                </div>
                <div style={{ position: 'absolute', top: -12, height: 10, left: `${AT}%`, width: 6, marginLeft: -3, background: th.tx }} />
                <div style={{ position: 'absolute', bottom: -12, height: 10, left: `${AT}%`, width: 6, marginLeft: -3, background: th.tx }} />
              </div>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...f(700, 50, COND, 1), color: x.a >= AT ? th.g : x.a >= AT - 10 ? th.a : th.r }}>{Math.round(x.a)}%</span>
            {!portrait && <NowBox n={nowCell(c.w, x.m, th)} big={44} />}
          </div>
        );
      })}
      <Legend th={th} size={portrait ? 19 : 22} items={[[FG, 'running'], [FA, 'idle'], [hatch(MC_PURPLE), 'mould change'], [hatch('#D8382B'), 'stopped'], [th.tx, `tick = availability target ${AT}%`]]} />
    </Panel>
  );
}

/* ---------------- TRUCKS AT THE GATE (14e / 14f) ---------------- */

function TrucksPage({ c }: { c: Ctx }) {
  const { th, tk, amber, red, portrait, w } = c;
  const tc = (sec: number) => waitTone(sec, amber, red);
  const kpis = [
    { l: 'INSIDE NOW', v: String(tk.inside.length), s: `${tk.out.length} out · ${tk.dock.length} dock · ${tk.in.length} in`, bg: th.panel, fg: th.tx },
    { l: `OVER ${red} MIN`, v: String(tk.overRed.length), s: tk.overRed.map((k) => `${k.k.plate} · ${mins(k.wait)}`).slice(0, 2).join(' · ') || 'none', bg: tk.overRed.length ? th.badBg : th.panel, fg: tk.overRed.length ? th.r : th.tx },
    { l: `OVER ${amber} MIN`, v: String(tk.overAmber.length), s: tk.overAmber.map((k) => `${k.k.partyShort} ${mins(k.wait)}`).slice(0, 2).join(' · ') || 'none', bg: tk.overAmber.length ? th.warnBg : th.panel, fg: tk.overAmber.length ? th.a : th.tx },
    { l: 'AVG TIME INSIDE TODAY', v: `${Math.round(tk.avgMin || 0)}′`, s: `yesterday ${Math.round((tk.avgMin || 40) * 1.18)}′`, bg: th.panel, fg: th.tx },
    { l: 'LEFT TODAY', v: String(tk.leftToday), s: `${tk.leftOut} out · ${tk.leftToday - tk.leftOut} in`, bg: th.panel, fg: th.tx },
  ];
  const card = (k: (typeof tk.inside)[0], plateFs: number) => {
    const t = tc(k.wait);
    return (
      <div key={k.k.id} style={{ background: th.panel, border: `1px solid ${th.line}`, borderLeft: `12px solid ${({ g: FG, a: FA, r: FR })[t]}`, borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ ...f(700, plateFs, COND, 1), whiteSpace: 'nowrap' }}>{k.k.plate}</span>
          <span style={{ ...f(700, 64, COND, 0.9), color: th[t] }}>{mins(k.wait)}</span>
        </div>
        <span style={{ ...f(700, 28, BAR, 1.1), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.k.party.replace(/, .*/, '')}</span>
        <span style={{ ...f(600, 22, BAR), color: th.mu, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.meta}</span>
        <span style={{ alignSelf: 'flex-start', ...f(700, 22, BAR), padding: '4px 10px', borderRadius: 5, background: k.bad ? th.badBg : th.chipBg, color: k.bad ? th.r : th.tx }}>{k.why}</span>
      </div>
    );
  };
  const lane = (title: string, col: string, n: number) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `6px solid ${col}`, paddingBottom: 6 }}>
      <span style={{ ...f(700, 30, COND), letterSpacing: '.04em' }}>{title}</span>
      <span style={{ ...f(700, 26, BAR), color: th.mu }}>{n}</span>
    </div>
  );
  const left = (k: (typeof tk.left)[0]) => (
    <div key={k.k.id} style={{ background: th.panel, border: `1px solid ${th.line}`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ ...f(700, 34, COND, 1), whiteSpace: 'nowrap' }}>{k.k.plate}</span>
        <span style={{ ...f(600, 21, BAR), color: th.mu, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {k.k.partyShort} · out {hhmm(k.k.out ?? w.t)}
        </span>
      </div>
      <span style={{ ...f(700, 40, COND, 1), color: th[tc(k.wait)] }}>{mins(k.wait)}</span>
    </div>
  );
  const empty = (t: string) => <div style={{ border: `2px dashed ${th.line}`, borderRadius: 8, padding: 18, ...f(600, 22, BAR), color: th.mu, textAlign: 'center' }}>{t}</div>;
  const lanes = [
    { t: 'OUTBOUND · WAITING TO LOAD', c: '#FF6A5A', list: tk.out.slice(0, portrait ? 4 : 3), n: tk.out.length, e: 'no truck waiting to load' },
    { t: 'AT DOCK', c: '#34C77B', list: tk.dock.slice(0, portrait ? 4 : 3), n: tk.dock.length, e: 'docks free' },
    { t: 'INBOUND · WAITING TO UNLOAD', c: '#3B82F6', list: tk.in.slice(0, portrait ? 4 : 3), n: tk.in.length, e: 'no truck waiting to unload' },
  ];

  if (portrait)
    return (
      <>
        <div style={{ height: 150, flex: 'none', margin: '14px 24px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[kpis[0], kpis[1], kpis[3]].map((s) => (
            <div key={s.l} style={{ background: s.bg, color: s.fg, border: `1px solid ${th.line}`, borderRadius: 10, padding: '10px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ ...f(700, 22, BAR), letterSpacing: '.06em', opacity: 0.85 }}>{s.l}</span>
              <span style={f(700, 64, COND, 1)}>{s.v}</span>
              <span style={{ ...f(600, 20, BAR), opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.s}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, margin: '14px 24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lanes.map((l) => (
            <div key={l.t} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lane(l.t, l.c, l.n)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{l.list.length ? l.list.map((k) => card(k, 42)) : empty(l.e)}</div>
            </div>
          ))}
          {lane('LEFT · LAST 2 H', '#6B7079', tk.left.length)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{tk.left.length ? tk.left.slice(0, 4).map((k) => left(k)) : empty('none in the last 2 hours')}</div>
        </div>
      </>
    );

  return (
    <>
      <div style={{ height: 128, flex: 'none', margin: '16px 36px 0', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
        {kpis.map((s) => (
          <div key={s.l} style={{ background: s.bg, color: s.fg, border: `1px solid ${th.line}`, borderRadius: 10, padding: '10px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minWidth: 0 }}>
            <span style={{ ...f(700, 22, BAR), letterSpacing: '.06em', opacity: 0.85 }}>{s.l}</span>
            <span style={f(700, 60, COND, 1)}>{s.v}</span>
            <span style={{ ...f(600, 20, BAR), opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.s}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, margin: '16px 36px 16px', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr)) 400px', gap: 16 }}>
        {lanes.map((l) => (
          <div key={l.t} style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' }}>
            {lane(l.t, l.c, l.n)}
            {l.list.length ? l.list.map((k) => card(k, 46)) : empty(l.e)}
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>
          {lane('LEFT · LAST 2 H', '#6B7079', tk.left.length)}
          {tk.left.length ? tk.left.slice(0, 6).map((k) => left(k)) : empty('none in the last 2 hours')}
          <span style={{ ...f(600, 20, BAR), color: th.mu }}>time = total inside, gate-in to gate-out</span>
        </div>
      </div>
    </>
  );
}

/* ---------------- presenter control bits ---------------- */

function Ctl({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="flex h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 text-white backdrop-blur transition hover:bg-black/80">
      {children}
    </button>
  );
}
function Row({ l, children }: { l: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-[#C9CDD3]">{l}</span>
      {children}
    </div>
  );
}
function Seg({ opts, v, on }: { opts: string[]; v: string; on: (v: string) => void }) {
  return (
    <div className="flex rounded-[8px] bg-white/10 p-0.5">
      {opts.map((o) => (
        <button key={o} onClick={() => on(o)} className={`flex-1 rounded-[6px] px-2 py-1 text-[12px] font-semibold ${o === v ? 'bg-[#F26A21] text-[#15171A]' : 'text-[#C9CDD3]'}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
