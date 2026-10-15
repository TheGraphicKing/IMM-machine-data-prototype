import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSim } from '../sim/store';
import { NAV } from './nav';
import { STATE_META } from '../sim/catalog';
import { cx } from '../lib/format';
import { EASE, StatePill } from '../ui/primitives';
import type { MState } from '../sim/types';

interface Res {
  group: string;
  label: string;
  sub: string;
  to: string;
  state?: MState;
}

export default function CommandPalette() {
  const open = useSim((s) => s.paletteOpen);
  const set = useSim((s) => s.set);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo<Res[]>(() => {
    if (!open) return [];
    const w = useSim.getState().world;
    const s = q.trim().toLowerCase();
    const out: Res[] = [];
    const has = (...xs: string[]) => !s || xs.some((x) => x.toLowerCase().includes(s));
    for (const n of NAV) if (has(n.label)) out.push({ group: 'Screens', label: n.label, sub: 'Go to screen', to: n.to });
    if (has('shopfloor tv mode')) out.push({ group: 'Screens', label: 'Shopfloor TV mode', sub: 'Fullscreen playlist', to: '/tv' });
    for (const u of w.units) if (has(u.name, u.code, u.city)) out.push({ group: 'Units', label: u.name, sub: `${w.org[u.orgId].name} · ${u.machineIds.length} machines`, to: `/unit/${u.id}` });
    if (s)
      for (const m of w.machines)
        if (has(`${m.code} ${w.unit[m.unitId].name}`, m.id, m.mouldId, m.wo, m.operator))
          out.push({ group: 'Machines', label: `${m.code} · ${w.unit[m.unitId].name}`, sub: `${m.tonnage} T ${m.make} · ${m.mouldId} · ${m.operator}`, to: `/machine/${m.id}`, state: m.state });
    if (s)
      for (const md of w.moulds)
        if (has(md.id, md.name)) out.push({ group: 'Moulds', label: `${md.id} · ${md.name}`, sub: `${md.positions.length} cav · ${md.status === 'production' ? 'on ' + (w.machine[md.location]?.code ?? md.location) : md.location}`, to: `/moulds?m=${md.id}` });
    if (s && s.length >= 2)
      for (const p of w.parts)
        if (has(p.number, p.name, p.erp)) out.push({ group: 'Parts', label: `${p.number} · ${p.name}`, sub: `${p.customer} · ${p.model} · ${p.colour} · ${p.erp}`, to: `/records?q=${encodeURIComponent(p.name)}` });
    if (s) for (const t of w.tickets) if (has(t.id, t.symptom)) out.push({ group: 'Tickets', label: t.id, sub: `${w.machine[t.machineId].code} · ${t.symptom} · ${t.stage}`, to: `/breakdowns?t=${t.id}` });
    if (s) for (const k of w.trucks) if (has(k.plate.replace(/ /g, ''), k.plate, k.party)) out.push({ group: 'Vehicles', label: k.plate, sub: `${k.dir} · ${k.party} · ${k.status}`, to: '/dispatch' });
    if (s && /^[a-z]{2}\d-\d{2}-\d{3,}/i.test(s)) out.unshift({ group: 'Serial', label: q.toUpperCase(), sub: 'Trace part serial', to: `/records?q=${encodeURIComponent(q.toUpperCase())}` });
    const seen = new Map<string, number>();
    return out.filter((r) => {
      const n = (seen.get(r.group) ?? 0) + 1;
      seen.set(r.group, n);
      return n <= (r.group === 'Screens' && !s ? 20 : 6);
    });
  }, [q, open]);

  const go = (r: Res) => {
    set({ paletteOpen: false });
    nav(r.to);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => set({ paletteOpen: false })}>
          <motion.div
            className="glass-strong w-full max-w-[640px] overflow-hidden rounded-[14px] shadow-[var(--shadow)]"
            initial={{ y: -16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -10, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Search"
          >
            <div className="flex items-center gap-3 border-b border-line/60 px-4">
              <Search size={18} className="text-fg3" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => (setQ(e.target.value), setSel(0))}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') (e.preventDefault(), setSel((v) => Math.min(results.length - 1, v + 1)));
                  else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((v) => Math.max(0, v - 1)));
                  else if (e.key === 'Enter' && results[sel]) go(results[sel]);
                  else if (e.key === 'Escape') set({ paletteOpen: false });
                }}
                placeholder="Search units, machines (IMM-07), moulds (M-1420), parts, tickets, vehicles, serials…"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg4"
                aria-label="Search query"
              />
              <kbd className="num rounded border border-line2 px-1.5 text-[11px] text-fg3">ESC</kbd>
            </div>
            <div className="max-h-[56vh] overflow-y-auto p-2">
              {results.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-fg3">No match for “{q}”. Try “IMM-07”, “Manesar”, “M-1420” or “HR 55”.</div>}
              {results.map((r, i) => (
                <div key={r.group + r.label + i}>
                  {(i === 0 || results[i - 1].group !== r.group) && <div className="overline px-3 pb-1 pt-2">{r.group}</div>}
                  <button onMouseEnter={() => setSel(i)} onClick={() => go(r)} className={cx('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left', i === sel ? 'bg-brand/12 ring-1 ring-brand/40' : '')}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">{r.label}</div>
                      <div className="truncate text-[12px] text-fg3">{r.sub}</div>
                    </div>
                    {r.state && <StatePill s={r.state} label={STATE_META[r.state].label} />}
                    {i === sel && <CornerDownLeft size={14} className="text-fg3" />}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
