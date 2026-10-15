import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, Menu, Moon, Play, Search, Sparkles, Sun, Volume2, VolumeX, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES, useSim, useWorld } from '../sim/store';
import { SHIFT_WINDOWS, shiftOf } from '../sim/catalog';
import { shiftRemaining } from '../sim/kpi';
import { clock, cx, durLong } from '../lib/format';
import { EASE } from '../ui/primitives';
import type { RoleId } from '../sim/types';

export function useStaleness() {
  const lastTick = useSim((s) => s.lastTick);
  const paused = useSim((s) => s.paused);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ago = Math.max(1, Math.round((now - lastTick) / 1000) + 1);
  return { ago, stale: paused || ago > 60 };
}

export function LiveIndicator({ className }: { className?: string }) {
  const { ago, stale } = useStaleness();
  const paused = useSim((s) => s.paused);
  return (
    <span className={cx('inline-flex items-center gap-2 whitespace-nowrap', className)} title={paused ? 'Simulator paused' : 'Live machine data (simulated)'}>
      <span className="relative inline-flex h-2 w-2">
        {!stale && <span className="absolute inset-0 animate-pulseRing rounded-full bg-run" />}
        <span className={cx('relative h-2 w-2 rounded-full', stale ? 'bg-idle' : 'bg-run')} />
      </span>
      {paused ? 'Paused' : `Live · updated ${ago} s ago`}
    </span>
  );
}

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const w = useWorld();
  const nav = useNavigate();
  const { theme, calm, sound, role, speed, set } = useSim();
  const [roleOpen, setRoleOpen] = useState(false);
  const sh = shiftOf(w.t);
  const open = w.alerts.filter((a) => a.status === 'open');
  const crit = open.filter((a) => a.severity === 'critical').length;

  const pickRole = (r: RoleId) => {
    setRoleOpen(false);
    set({ role: r, scope: r === 'planthead' || r === 'supervisor' || r === 'technician' ? { kind: 'unit', id: 'MN1' } : { kind: 'corp' } });
    nav(ROLES[r].home);
  };

  return (
    <header className="glass-strong relative z-30 flex h-14 shrink-0 items-center gap-3 border-x-0 border-t-0 px-3 sm:px-5" style={{ borderRadius: 0 }}>
      <button className="btn btn-ghost !h-9 !w-9 !p-0 lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu size={18} />
      </button>
      <div className="flex min-w-0 items-center gap-3 text-[13px] font-medium text-fg2">
        <LiveIndicator className="hidden md:inline-flex" />
        <span className="hidden h-[18px] w-px bg-line md:block" />
        <span className="truncate whitespace-nowrap" title={`Shift ${sh} · ${SHIFT_WINDOWS[sh]}`}>
          <span className="num font-semibold text-fg">Shift {sh}</span>
          <span className="hidden 2xl:inline"> · {SHIFT_WINDOWS[sh]}</span> · <span className="num">{durLong(shiftRemaining(w))}</span> left
        </span>
        <span className="hidden h-[18px] w-px bg-line xl:block" />
        <span className="hidden items-center gap-1.5 whitespace-nowrap xl:inline-flex" title={`Simulated shop-floor time · Thu, ${w.day} Oct 2026`}>
          <span className="num text-[15px] font-semibold text-fg">{clock(w.t, true)}</span>
          <span className="hidden text-fg3 2xl:inline">Thu, {w.day} Oct</span>
          {speed > 1 && <span className="num rounded bg-brand/15 px-1.5 text-[11px] font-semibold text-brand">{speed}×</span>}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button onClick={() => set({ paletteOpen: true })} className="hidden h-9 w-[200px] items-center gap-2 rounded-md border xl:w-[250px] border-line2/70 bg-panel2/60 px-3 text-[13px] text-fg3 transition hover:border-fg3 md:flex" aria-label="Search">
          <Search size={15} />
          <span className="flex-1 truncate text-left">Search machine, mould, serial…</span>
          <kbd className="num rounded border border-line2 px-1.5 text-[11px]">⌘K</kbd>
        </button>
        <button onClick={() => set({ paletteOpen: true })} className="btn btn-ghost !h-9 !w-9 !p-0 md:hidden" aria-label="Search">
          <Search size={16} />
        </button>
        <button onClick={() => nav('/alerts')} className="btn btn-ghost relative !h-9 !px-2.5" aria-label={`Alerts, ${open.length} open`}>
          <Bell size={16} />
          <span className="hidden sm:inline">Alerts</span>
          {open.length > 0 && (
            <motion.span key={open.length} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className={cx('num rounded-full px-1.5 text-[11px] font-semibold text-white', crit ? 'bg-[#B9533F]' : 'bg-[#B8954A] text-ink')}>
              {open.length}
            </motion.span>
          )}
        </button>
        <button className="btn btn-ghost hidden !h-9 !w-9 !p-0 sm:inline-flex" onClick={() => set({ sound: !sound })} aria-label={sound ? 'Mute alert chime' : 'Unmute alert chime'} title={sound ? 'Chime on' : 'Chime muted'}>
          {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button className={cx('btn btn-ghost hidden !h-9 !w-9 !p-0 sm:inline-flex', calm && '!border-brand !text-brand')} onClick={() => set({ calm: !calm })} aria-label="Calm mode" title={calm ? 'Calm mode on (heavy effects off)' : 'Calm mode off'}>
          <Wind size={16} />
        </button>
        <button className="btn btn-ghost !h-9 !w-9 !p-0" onClick={() => set({ theme: theme === 'dark' ? 'light' : 'dark' })} aria-label="Toggle theme">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </motion.span>
          </AnimatePresence>
        </button>
        <div className="relative">
          <button className="btn btn-ghost !h-9" onClick={() => setRoleOpen((v) => !v)} aria-expanded={roleOpen} aria-label="Switch role">
            <span className="hidden sm:inline">{ROLES[role].label}</span>
            <span className="sm:hidden">{ROLES[role].ini}</span>
            <ChevronDown size={14} />
          </button>
          <AnimatePresence>
            {roleOpen && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: EASE }} className="glass-strong absolute right-0 top-11 z-50 w-64 rounded-[10px] p-1.5 shadow-[var(--shadow)]">
                <div className="overline px-2 py-1.5">View as role</div>
                {(Object.keys(ROLES) as RoleId[]).map((r) => (
                  <button key={r} onClick={() => pickRole(r)} className={cx('flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition hover:bg-panel3', r === role && 'bg-brand/10')}>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-panel3 text-[11px] font-semibold">{ROLES[r].ini}</span>
                    <span className="flex flex-col">
                      <span className="text-[13px] font-semibold">{ROLES[r].label}</span>
                      <span className="text-[11px] text-fg3">{ROLES[r].name}</span>
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button className="btn btn-primary !h-9" onClick={() => set({ tourOn: true })}>
          <Play size={14} fill="currentColor" />
          <span className="hidden sm:inline">Play tour</span>
        </button>
        <button className="btn btn-ghost hidden !h-9 !w-9 !p-0 2xl:inline-flex" onClick={() => nav('/ask')} aria-label="Ask IMMDATA">
          <Sparkles size={16} />
        </button>
      </div>
    </header>
  );
}
