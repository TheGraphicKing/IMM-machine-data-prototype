import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSim, useWorld } from '../sim/store';
import { aggMachines, availability, derive, downtimeByReason, hourly, machineKpis, machinesOfUnit, requiredRate } from '../sim/kpi';
import { SHIFT_LEN, SHIFT_WINDOWS, TEAMS, shiftOf, shiftStartOf } from '../sim/catalog';
import { hourIdx } from '../sim/engine';
import { clock, cx, dur, fmt, pct, timer } from '../lib/format';
import { TimelineBar, stageLabel } from '../ui/primitives';
import { TENANT } from '../sim/catalog';
import type { Machine } from '../sim/types';

type Page = { key: string; l: string; kind: 'timeline' | 'reasons' | 'avail' | 'trucks' | 'production' | 'single'; page?: number };
const DURATION = 12;

/** Shopfloor TV: 1920×1080 canvas scaled to the window, auto-rotating playlist. No ₹ on the floor. */
export default function TV() {
  const w = useWorld();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const single = sp.get('m');
  const unitId = (single ? w.machine[single]?.unitId : sp.get('u')) ?? 'MN1';
  const u = w.unit[unitId];
  const ms = machinesOfUnit(w, u);
  const [light, setLight] = useState(false);
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scale, setScale] = useState(1);

  const pages: Page[] = useMemo(() => {
    const n = Math.ceil(ms.length / 8);
    const list: Page[] = [];
    if (single) list.push({ key: 'single', l: w.machine[single].code, kind: 'single' });
    for (let p = 0; p < n; p++) list.push({ key: `t${p}`, l: `${p + 1}`, kind: 'timeline', page: p });
    list.push({ key: 'reasons', l: 'Reasons', kind: 'reasons' }, { key: 'avail', l: 'Avail', kind: 'avail' }, { key: 'trucks', l: 'Trucks', kind: 'trucks' }, { key: 'prod', l: 'Production', kind: 'production' });
    return list;
  }, [ms.length, single, w.machine]);
  const page = pages[i % pages.length];
  const singleDown = page.kind === 'single' && w.machine[single!]?.state === 'DOWN';

  useEffect(() => {
    const r = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    r();
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      if (paused || singleDown) return;
      setElapsed((e) => {
        if (e + 0.1 >= DURATION) {
          setI((x) => (x + 1) % pages.length);
          return 0;
        }
        return e + 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [paused, singleDown, pages.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') nav(-1);
      if (e.key === 'ArrowRight') (setI((x) => (x + 1) % pages.length), setElapsed(0));
      if (e.key === 'ArrowLeft') (setI((x) => (x - 1 + pages.length) % pages.length), setElapsed(0));
      if (e.key === ' ') setPaused((p) => !p);
      if (e.key === 't' || e.key === 'T') setLight((l) => !l);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [nav, pages.length]);

  const A = aggMachines(w, ms);
  const withTeam = ms.filter((m) => m.state === 'DOWN' && m.ticketId && w.ticket[m.ticketId]?.stage !== 'unassigned').length;
  const counters = [
    [A.run, 'RUNNING', 'run'],
    [A.down - withTeam, 'STOPPED', 'down'],
    [withTeam, 'WITH TEAM', 'team'],
    [A.idle, 'IDLE', 'idle'],
  ] as const;
  const sh = shiftOf(w.t);
  const title = page.kind === 'timeline' ? `TIMELINE ${page.page! + 1}/${pages.filter((p) => p.kind === 'timeline').length}` : page.kind === 'reasons' ? 'DOWNTIME BY REASON' : page.kind === 'avail' ? 'AVAILABILITY RANKING' : page.kind === 'trucks' ? 'GATE & DISPATCH' : page.kind === 'production' ? 'PRODUCTION' : `${page.l} · SINGLE MACHINE`;

  return (
    <div data-tour="tv" className={cx('fixed inset-0 flex items-center justify-center overflow-hidden', light ? 'bg-[#F1F0EE]' : 'bg-black')} data-theme={light ? 'light' : 'dark'}>
      <div className={cx('relative flex flex-col overflow-hidden', light ? 'bg-[#FAFAF9] text-[#1F2022]' : 'bg-[#18191B] text-white')} style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: 'center' }}>
        {/* header */}
        {!(page.kind === 'single' && singleDown) && (
          <header className={cx('flex h-[120px] shrink-0 items-center gap-8 px-12', light ? 'bg-white' : 'bg-[#1F2022]')}>
            <div className="grid h-16 w-16 place-items-center rounded-[14px] border border-[#38393C] bg-[#27282B] text-[22px] font-bold text-white">{TENANT.initials}</div>
            <div className="min-w-0 flex-1">
              <div className="num truncate text-[34px] font-medium uppercase leading-[42px] tracking-[0.01em]">
                {u.name} · {title}
              </div>
              <div className={cx('truncate text-[22px]', light ? 'text-[#4A4744]' : 'text-[#8A857C]')}>
                {w.org[u.orgId].name} · Shift {sh} {SHIFT_WINDOWS[sh]} · {ms.length} machines · <span className="font-semibold text-[#7DB08F]">● LIVE</span>
              </div>
            </div>
            {counters.map(([n, l, v]) => (
              <div key={l} className="flex flex-col items-center px-3">
                <span className="num text-[48px] font-medium leading-[52px]" style={{ color: v === 'team' ? '#D8A285' : v === 'run' ? '#7DB08F' : v === 'down' ? '#E0826B' : '#D6B56E' }}>{n}</span>
                <span className={cx('text-[20px] font-semibold tracking-[0.08em]', light ? 'text-[#4A4744]' : 'text-[#8A857C]')}>{l}</span>
              </div>
            ))}
            <div className="num ml-4 text-[72px] font-normal leading-none">{clock(w.t)}</div>
          </header>
        )}
        <div className="relative min-h-0 flex-1">
          <AnimatePresence mode="popLayout">
            <motion.div key={page.key} className="absolute inset-0" initial={{ clipPath: 'inset(0 0 0 100%)' }} animate={{ clipPath: 'inset(0 0 0 0%)' }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
              {page.kind === 'timeline' && <TimelinePage ms={ms} page={page.page!} light={light} />}
              {page.kind === 'reasons' && <ReasonsPage ms={ms} light={light} />}
              {page.kind === 'avail' && <AvailPage ms={ms} light={light} />}
              {page.kind === 'trucks' && <TrucksPage unitId={unitId} light={light} />}
              {page.kind === 'production' && <ProductionPage ms={ms} light={light} />}
              {page.kind === 'single' && <SinglePage m={w.machine[single!]} light={light} />}
            </motion.div>
          </AnimatePresence>
        </div>
        {/* truck strip (9c) on timeline pages */}
        {page.kind === 'timeline' && <TruckStrip unitId={unitId} light={light} />}
        {/* footer: playlist */}
        <footer className={cx('flex h-[64px] shrink-0 items-center gap-4 px-12', light ? 'bg-white' : 'bg-[#1F2022]')}>
          {pages.map((p, k) => (
            <button key={p.key} onClick={() => (setI(k), setElapsed(0))} className={cx('num h-10 rounded-[8px] px-4 text-[22px] font-semibold', k === i % pages.length ? (light ? 'bg-[#1F2022] text-white' : 'bg-white text-[#18191B]') : light ? 'bg-[#E3E1DE] text-[#4A4744]' : 'bg-[#2E2F32] text-[#A8A298]')}>
              {p.l}
            </button>
          ))}
          <div className={cx('relative ml-4 h-2 flex-1 overflow-hidden rounded-full', light ? 'bg-[#E3E1DE]' : 'bg-[#2E2F32]')}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#FE4B1E]" style={{ width: `${(elapsed / DURATION) * 100}%` }} />
          </div>
          <span className={cx('num text-[22px]', light ? 'text-[#4A4744]' : 'text-[#8A857C]')}>{singleDown ? 'rotation paused · machine down' : paused ? 'paused' : `next in ${Math.ceil(DURATION - elapsed)} s`}</span>
          <span className={cx('text-[20px] opacity-50', light ? 'text-[#4A4744]' : 'text-[#8A857C]')}>Powered by AGG Technology</span>
        </footer>
      </div>
      {/* controls (not part of the TV canvas) */}
      <div className="fixed right-3 top-3 z-10 flex gap-2 opacity-30 transition hover:opacity-100">
        <button className="btn btn-ghost !h-8 !bg-black/50 !text-white" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
        <button className="btn btn-ghost !h-8 !bg-black/50 !text-white" onClick={() => setLight((l) => !l)}>{light ? 'Dark' : 'Light'}</button>
        <button className="btn btn-ghost !h-8 !bg-black/50 !text-white" onClick={() => (useSim.getState().entered ? nav(-1) : nav('/home'))} aria-label="Exit TV"><X size={14} />Exit</button>
      </div>
    </div>
  );
}

const sub = (light: boolean) => (light ? 'text-[#4A4744]' : 'text-[#8A857C]');

function stageColor(w: ReturnType<typeof useWorld>, m: Machine) {
  const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
  if (m.state === 'RUN') return tk?.stage === 'verify' ? '#D6B56E' : '#7DB08F';
  if (m.state === 'IDLE') return '#D6B56E';
  if (m.state === 'MC') return '#8AA6CF';
  if (m.state === 'OFF') return '#4A4744';
  return tk?.team ? TEAMS[tk.team].color : '#E0826B';
}
function stageText(w: ReturnType<typeof useWorld>, m: Machine) {
  const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
  if (m.state === 'RUN') return tk?.stage === 'verify' ? 'RUNNING · VERIFY FIX' : 'RUNNING';
  if (m.state === 'IDLE') return `IDLE · ${Math.round((w.t - m.since) / 60)} min`;
  if (m.state === 'MC') return `MOULD CHANGE · ${Math.round((w.t - m.since) / 60)} / ${w.mould[m.nextMouldId ?? '']?.stdChangeMin ?? 30} min`;
  if (m.state === 'OFF') return 'NO DATA';
  return `${stageLabel(tk?.stage ?? 'unassigned', tk?.team)} · ${Math.round((w.t - (tk?.stageAt ?? m.since)) / 60)} min`;
}

function TimelinePage({ ms, page, light }: { ms: Machine[]; page: number; light: boolean }) {
  const w = useWorld();
  const s0 = shiftStartOf(w.t);
  const sorted = [...ms].sort((a, b) => availability(a) - availability(b));
  const rows = sorted.slice(page * 8, page * 8 + 8);
  const top = sorted.filter((m) => m.state === 'DOWN' || (m.ticketId && w.ticket[m.ticketId]?.stage === 'verify')).slice(0, 4);
  return (
    <div className="flex h-full flex-col gap-4 px-12 py-6">
      {page === 0 && top.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {top.map((m) => {
            const lost = m.plannedSec - m.runSec;
            const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
            return (
              <div key={m.id} className={cx('rounded-[12px] border-l-[8px] p-4', light ? 'bg-white' : 'bg-[#212225]')} style={{ borderColor: stageColor(w, m) }}>
                <div className="flex items-baseline justify-between">
                  <span className="num text-[36px] font-bold leading-10">{m.code}</span>
                  <span className="num text-[30px] font-bold text-[#E0826B]">{dur(lost)}</span>
                </div>
                <div className="truncate text-[22px] font-semibold" style={{ color: stageColor(w, m) }}>{stageText(w, m)}</div>
                <div className={cx('truncate text-[22px]', sub(light))}>{m.reasonLogged ? m.reason : 'New stop · production to assign'}{tk?.assignee ? ` · ${tk.assignee}` : ''}</div>
              </div>
            );
          })}
        </div>
      )}
      <div className={cx('grid grid-cols-[180px_minmax(0,1fr)_380px] items-center gap-6 text-[22px] font-semibold tracking-[0.06em]', sub(light))}>
        <span>MACHINE</span>
        <div className="relative h-7">
          {Array.from({ length: 9 }, (_, k) => (
            <span key={k} className={cx('num absolute', k > 0 && '-translate-x-1/2', k === 8 && '!-translate-x-full', k === hourIdx(w.t) && 'text-[#FE4B1E]')} style={{ left: `${(k / 8) * 100}%` }}>
              {clock(s0 + k * 3600).slice(0, 2)}
            </span>
          ))}
        </div>
        <span className="text-right">NOW · AVAIL</span>
      </div>
      <div className="flex flex-1 flex-col justify-around gap-2">
        {rows.map((m) => {
          const av = availability(m);
          return (
            <div key={m.id} className="grid grid-cols-[180px_minmax(0,1fr)_380px] items-center gap-6">
              <div>
                <div className="num text-[36px] font-bold leading-10" style={{ color: m.state === 'DOWN' ? '#E0826B' : undefined }}>{m.code}</div>
                <div className={cx('num text-[22px]', sub(light))}>lost {dur(m.plannedSec - m.runSec)}</div>
              </div>
              <TimelineBar segs={m.timeline} t0={s0} t1={s0 + SHIFT_LEN} now={w.t} h={48} />
              <div className="flex items-center justify-end gap-4">
                <span className="truncate text-right text-[22px] font-semibold" style={{ color: stageColor(w, m) }}>{stageText(w, m)}</span>
                <span className="num w-[90px] text-right text-[36px] font-bold" style={{ color: av >= 80 ? '#7DB08F' : av >= 65 ? '#D6B56E' : '#E0826B' }}>{av.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className={cx('flex gap-8 text-[22px]', sub(light))}>
        <span className="inline-flex items-center gap-2"><span className="h-5 w-8 rounded bg-[#7DB08F]" />Running</span>
        <span className="inline-flex items-center gap-2"><span className="pat-unassigned h-5 w-8 rounded" />Not assigned</span>
        <span className="inline-flex items-center gap-2"><span className="pat-assigned h-5 w-8 rounded" style={{ ['--team' as string]: '#A8A298' }} />Team assigned</span>
        <span className="inline-flex items-center gap-2"><span className="h-5 w-8 rounded bg-[#A8A298]" />Team working</span>
        <span className="inline-flex items-center gap-2"><span className="pat-spare h-5 w-8 rounded" style={{ ['--team' as string]: '#A8A298' }} />Waiting spare</span>
      </div>
    </div>
  );
}

function ReasonsPage({ ms, light }: { ms: Machine[]; light: boolean }) {
  const w = useWorld();
  const p = downtimeByReason(w, ms);
  const list = p.list.slice(0, 8);
  const max = Math.max(1, ...list.map((x) => x.sec));
  const open = ms.filter((m) => m.ticketId && w.ticket[m.ticketId] && w.ticket[m.ticketId].stage !== 'closed');
  const unassigned = list.find((x) => x.team === 'unassigned');
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_480px] gap-10 px-12 py-8">
      <div className="flex flex-col gap-5">
        <div className={cx('text-[26px]', sub(light))}>Shift {shiftOf(w.t)} · {dur(p.total)} lost across {ms.length} machines</div>
        {list.map((r) => (
          <div key={r.label} className="grid grid-cols-[420px_minmax(0,1fr)_200px] items-center gap-6">
            <div>
              <div className="text-[30px] font-semibold" style={{ color: r.team === 'unassigned' ? '#E0826B' : undefined }}>{r.label}</div>
              <div className={cx('text-[22px]', sub(light))}>{r.team === 'unassigned' ? 'Production to log' : TEAMS[r.team]?.label}</div>
            </div>
            <div className={cx('h-10 rounded-[6px]', light ? 'bg-[#E3E1DE]' : 'bg-[#27282B]')}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${(r.sec / max) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className={cx('h-full rounded-[6px]', r.team === 'unassigned' && 'pat-unassigned')} style={{ background: r.team === 'unassigned' ? undefined : TEAMS[r.team]?.color }} />
            </div>
            <div className="num text-right text-[34px] font-bold">{dur(r.sec)} <span className={cx('text-[24px]', sub(light))}>{Math.round((r.sec / p.total) * 100)}%</span></div>
          </div>
        ))}
        <div className="mt-auto rounded-[12px] border border-[#FE4B1E]/50 bg-[#FE4B1E]/10 p-5 text-[26px]">
          Biggest lever: {list[0]?.label.toLowerCase()} is {Math.round(((list[0]?.sec ?? 0) / Math.max(1, p.total)) * 100)}% of downtime.{unassigned && ` ${dur(unassigned.sec)} was never assigned to a team.`}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className={cx('text-[22px] font-semibold tracking-[0.08em]', sub(light))}>OPEN TICKETS BY TEAM</div>
        {open.slice(0, 6).map((m) => {
          const tk = w.ticket[m.ticketId!];
          return (
            <div key={m.id} className={cx('rounded-[12px] border-l-[8px] p-4', light ? 'bg-white' : 'bg-[#212225]')} style={{ borderColor: tk.team ? TEAMS[tk.team].color : '#E0826B' }}>
              <div className="text-[22px] font-semibold" style={{ color: tk.team ? TEAMS[tk.team].color : '#E0826B' }}>{tk.team ? TEAMS[tk.team].label.toUpperCase() : 'NOT ASSIGNED'}</div>
              <div className="num text-[30px] font-bold">{m.code} · {dur(w.t - tk.createdAt)}</div>
              <div className={cx('text-[22px]', sub(light))}>{stageLabel(tk.stage, tk.team).toLowerCase()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AvailPage({ ms, light }: { ms: Machine[]; light: boolean }) {
  const sorted = [...ms].sort((a, b) => availability(a) - availability(b));
  const unitAv = ms.reduce((a, m) => a + m.runSec, 0) / Math.max(1, ms.reduce((a, m) => a + m.plannedSec, 0)) * 100;
  return (
    <div className="flex h-full flex-col gap-4 px-12 py-8">
      <div className={cx('text-[26px]', sub(light))}>Target 80% · unit {unitAv.toFixed(0)}% · worst first</div>
      <div className="relative grid flex-1 grid-cols-2 gap-x-16 gap-y-3">
        {sorted.map((m, k) => {
          const av = availability(m);
          const c = av >= 80 ? '#7DB08F' : av >= 65 ? '#D6B56E' : '#E0826B';
          return (
            <div key={m.id} className="grid grid-cols-[150px_minmax(0,1fr)_110px] items-center gap-4">
              <span className="num text-[30px] font-bold">{m.code}</span>
              <div className={cx('relative h-8 rounded-[6px]', light ? 'bg-[#E3E1DE]' : 'bg-[#27282B]')}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${av}%` }} transition={{ delay: k * 0.03, duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-[6px]" style={{ background: c }} />
                <div className="absolute -bottom-1 -top-1 w-[3px] bg-white/80" style={{ left: '80%' }} />
              </div>
              <span className="num text-right text-[32px] font-bold" style={{ color: c }}>{av.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
      <div className={cx('flex gap-8 text-[22px]', sub(light))}>
        <span className="inline-flex items-center gap-2"><span className="h-5 w-8 rounded bg-[#7DB08F]" />≥ 80%</span>
        <span className="inline-flex items-center gap-2"><span className="h-5 w-8 rounded bg-[#D6B56E]" />65–80%</span>
        <span className="inline-flex items-center gap-2"><span className="h-5 w-8 rounded bg-[#E0826B]" />&lt; 65%</span>
        <span className="inline-flex items-center gap-2"><span className="h-6 w-[3px] bg-white/80" />Target</span>
      </div>
    </div>
  );
}

function TrucksPage({ unitId, light }: { unitId: string; light: boolean }) {
  const w = useWorld();
  const inside = w.trucks.filter((k) => k.unitId === unitId && k.phase < 3).sort((a, b) => a.gateIn - b.gateIn);
  const left = w.trucks.filter((k) => k.unitId === unitId && k.phase === 3 && k.out !== null).sort((a, b) => (b.out ?? 0) - (a.out ?? 0)).slice(0, 5);
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_460px] gap-10 px-12 py-8">
      <div className="flex flex-col gap-3">
        <div className={cx('grid grid-cols-[110px_360px_minmax(0,1fr)_300px_160px] gap-4 text-[22px] font-semibold tracking-[0.06em]', sub(light))}>
          <span>DIR</span>
          <span>VEHICLE</span>
          <span>CUSTOMER / SUPPLIER</span>
          <span>STATUS</span>
          <span className="text-right">WAITING</span>
        </div>
        {inside.slice(0, 8).map((k) => {
          const min = Math.round((w.t - k.gateIn) / 60);
          const c = min > 60 ? '#E0826B' : min > 30 ? '#D6B56E' : '#7DB08F';
          return (
            <div key={k.id} className={cx('grid grid-cols-[110px_360px_minmax(0,1fr)_300px_160px] items-center gap-4 rounded-[10px] px-2 py-3', min > 60 && 'bg-[#E0826B]/10')}>
              <span className={cx('w-fit rounded-[6px] px-3 py-1 text-[24px] font-bold', k.dir === 'OUT' ? 'bg-white text-[#18191B]' : 'bg-[#8AA6CF] text-white')}>{k.dir}</span>
              <span className="plate w-fit !text-[30px]">{k.plate}</span>
              <span className="truncate text-[28px]">{k.party}</span>
              <span className="truncate text-[24px]" style={{ color: min > 60 ? '#E0826B' : undefined }}>{k.status}</span>
              <span className="num text-right text-[44px] font-bold" style={{ color: c }}>{min}′</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-3">
        <div className={cx('text-[22px] font-semibold tracking-[0.08em]', sub(light))}>LEFT IN LAST 2 H</div>
        {left.map((k) => (
          <div key={k.id} className={cx('rounded-[10px] p-3', light ? 'bg-white' : 'bg-[#212225]')}>
            <span className="plate !text-[24px]">{k.plate}</span>
            <div className={cx('mt-1 text-[22px]', sub(light))}>{k.dir} · {k.party.split(',')[0]} · out {clock(k.out ?? 0)}</div>
          </div>
        ))}
        <div className={cx('mt-auto text-[22px]', sub(light))}>Today · {left.length + 14} trucks out · avg turnaround 46 min</div>
      </div>
    </div>
  );
}

function ProductionPage({ ms, light }: { ms: Machine[]; light: boolean }) {
  const w = useWorld();
  const A = aggMachines(w, ms);
  const D = derive(A);
  const h = hourly(w, ms);
  const hi = hourIdx(w.t);
  const need = requiredRate(w, A);
  const thisHour = h.out[hi];
  const frac = (w.t - shiftStartOf(w.t) - hi * 3600) / 3600;
  return (
    <div className="flex h-full flex-col gap-6 px-12 py-8">
      <div className="grid grid-cols-4 gap-6">
        {[
          ['OUTPUT VS PLAN', fmt(A.good), `/ ${fmt(A.planParts)} · ${pct(D.plan)}`, D.plan >= 95 ? '#7DB08F' : D.plan >= 88 ? '#D6B56E' : '#E0826B'],
          ['OEE', pct(D.oee), 'target 75%', D.oee >= 75 ? '#7DB08F' : '#D6B56E'],
          ['REJECT', pct(D.rej), `${fmt(A.bad)} parts · limit 3%`, D.rej > 3 ? '#E0826B' : undefined],
          ['THIS HOUR', fmt(thisHour), `needed ${fmt(h.planH * frac)} · ${fmt(need)} / h to close`, thisHour >= h.planH * frac * 0.9 ? '#7DB08F' : '#E0826B'],
        ].map(([l, v, s, c]) => (
          <div key={l} className={cx('rounded-[14px] p-6', light ? 'bg-white' : 'bg-[#212225]')}>
            <div className={cx('text-[22px] font-semibold tracking-[0.08em]', sub(light))}>{l}</div>
            <div className="num text-[96px] font-bold leading-[100px]" style={{ color: c }}>{v}</div>
            <div className={cx('text-[24px]', sub(light))}>{s}</div>
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-5 gap-4">
        {ms.slice(0, 20).map((m) => {
          const k = machineKpis(w, m);
          const p = k.target ? (k.good / k.target) * 100 : 0;
          return (
            <div key={m.id} className={cx('flex flex-col justify-center rounded-[12px] border-l-[8px] px-4', light ? 'bg-white' : 'bg-[#212225]', m.state === 'DOWN' && '!bg-[#E0826B]/15')} style={{ borderColor: stageColor(w, m) }}>
              <div className="flex items-baseline justify-between">
                <span className="num text-[32px] font-bold">{m.code}</span>
                <span className="num text-[26px] font-bold" style={{ color: p >= 95 ? '#7DB08F' : p >= 88 ? '#D6B56E' : '#E0826B' }}>{p.toFixed(0)}%</span>
              </div>
              <div className={cx('truncate text-[22px]', sub(light))}>{m.state === 'RUN' ? `${k.ct.toFixed(1)} s · ${fmt(k.good)}` : stageText(w, m).toLowerCase()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SinglePage({ m, light }: { m: Machine; light: boolean }) {
  const w = useWorld();
  const k = machineKpis(w, m);
  const tk = m.ticketId ? w.ticket[m.ticketId] : undefined;
  if (m.state === 'DOWN')
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#B9533F] text-white">
        <motion.div animate={{ opacity: [1, 0.85, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-[60px] font-bold tracking-[0.1em]">
          {m.code} · DOWN
        </motion.div>
        <div className="num text-[320px] font-bold leading-[300px] tracking-[-0.02em]">{timer(w.t - m.since)}</div>
        <div className="text-[48px] font-semibold">{m.reasonLogged ? m.reason : 'No reason logged yet'}</div>
        <div className="rounded-[16px] bg-black/25 px-8 py-4 text-[40px]">{tk?.assignee ? `${tk.team ? TEAMS[tk.team].label : ''} · ${tk.assignee} ${tk.stage === 'assigned' ? 'is coming' : 'is working on it'}` : 'Supervisor to assign a team'}</div>
        <div className="text-[28px] opacity-80">{u2(w, m)} · rotation paused until it runs again</div>
      </div>
    );
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="num text-[120px] font-bold">{m.code}</div>
      <div className="text-[48px] font-semibold" style={{ color: stageColor(w, m) }}>{stageText(w, m)}</div>
      <div className="grid grid-cols-3 gap-10">
        {[
          ['PARTS', `${fmt(k.good)} / ${fmt(k.target)}`],
          ['CYCLE', `${k.ct.toFixed(1)} / ${k.std.toFixed(1)} s`],
          ['REJECT', pct(k.rej)],
        ].map(([l, v]) => (
          <div key={l} className="text-center">
            <div className={cx('text-[26px] font-semibold tracking-[0.08em]', sub(light))}>{l}</div>
            <div className="num text-[72px] font-bold">{v}</div>
          </div>
        ))}
      </div>
      <div className={cx('text-[28px]', sub(light))}>{m.wo} · {w.part[w.mould[m.mouldId].positions[0].partId]?.name} · {m.operator}</div>
    </div>
  );
}
const u2 = (w: ReturnType<typeof useWorld>, m: Machine) => `${w.unit[m.unitId].name} · ${m.hall} · ${m.tonnage} T`;

function TruckStrip({ unitId, light }: { unitId: string; light: boolean }) {
  const w = useWorld();
  const inside = w.trucks.filter((k) => k.unitId === unitId && k.phase < 3).sort((a, b) => a.gateIn - b.gateIn);
  return (
    <div className={cx('flex h-[84px] shrink-0 items-center gap-6 border-t px-12', light ? 'border-[#E3E1DE] bg-[#FAFAF9]' : 'border-[#38393C] bg-[#212225]')}>
      <div className="shrink-0">
        <div className={cx('text-[20px] font-semibold tracking-[0.08em]', sub(light))}>TRUCKS INSIDE</div>
        <div className="num text-[34px] font-bold leading-9">{inside.length} <span className="text-[22px] text-[#E0826B]">· {inside.filter((k) => w.t - k.gateIn > 3600).length} over 60′</span></div>
      </div>
      {inside.slice(0, 4).map((k) => {
        const min = Math.round((w.t - k.gateIn) / 60);
        const c = min > 60 ? '#E0826B' : min > 30 ? '#D6B56E' : '#7DB08F';
        return (
          <div key={k.id} className="flex items-center gap-3">
            <span className="plate !text-[22px]">{k.plate}</span>
            <span className={cx('text-[22px]', sub(light))}>{k.dir} · {k.partyShort}</span>
            <span className="num text-[30px] font-bold" style={{ color: c }}>{min}′</span>
          </div>
        );
      })}
    </div>
  );
}
