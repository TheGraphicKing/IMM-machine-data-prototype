import { AnimatePresence, motion } from 'framer-motion';
import { Search, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSim, useWorld } from '../sim/store';
import { goMC } from '../sim/engine';
import { machinesOfUnit } from '../sim/kpi';
import { toast } from '../sim/engine';
import { clock, cx, fmt, timer } from '../lib/format';
import { Drawer, EASE, Panel, StatePill } from '../ui/primitives';
import { Ring } from '../ui/charts';
import { notify } from '../shell/Toasts';
import type { Mould } from '../sim/types';

const STATUS_L: Record<Mould['status'], string> = { production: 'In production', storage: 'In storage', toolroom: 'In tool room', customer: 'At customer' };

export default function Moulds() {
  const w = useWorld();
  const [sp, setSp] = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'production' | 'storage' | 'toolroom' | 'pm'>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(48);
  const sel = sp.get('m');
  const list = useMemo(
    () =>
      w.moulds
        .filter((m) => (filter === 'all' ? true : filter === 'pm' ? m.pmInterval - m.shotsSincePM < 5000 : m.status === filter))
        .filter((m) => !q || m.id.toLowerCase().includes(q.toLowerCase()) || m.name.toLowerCase().includes(q.toLowerCase()) || m.customer.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.shotsSincePM / b.pmInterval - a.shotsSincePM / a.pmInterval),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(w.t / 10), filter, q],
  );
  const pmDue = w.moulds.filter((m) => m.pmInterval - m.shotsSincePM < 5000).length;
  const hero = machinesOfUnit(w, w.unit.MN1);
  const inMC = w.machines.filter((m) => m.state === 'MC');
  const mcDone = w.machines.reduce((a, m) => a + m.mcDone, 0);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="num text-[30px] font-bold leading-9">Mould health</h1>
          <div className="text-[13px] text-fg3">Moulds maintained by shots · changeovers measured against standard</div>
        </div>
        <Link to="/mould-setup" className="btn btn-ghost">Mould setup queue →</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Moulds', fmt(w.moulds.length), `${w.moulds.filter((m) => m.owner === 'customer').length} customer-owned`],
          ['In production', w.moulds.filter((m) => m.status === 'production').length, `${w.machines.length} machines`],
          ['PM due ≤ 5,000 shots', pmDue, 'tool room queue', pmDue > 0],
          ['In tool room', w.moulds.filter((m) => m.status === 'toolroom').length, 'repairs & PM'],
          ['Mould changes', `${mcDone} / ${mcDone + inMC.length + 6}`, 'done / planned today'],
          ['Avg change', '38 min', 'vs 30 min std', true],
        ].map(([l, v, s, warn], i) => (
          <motion.div key={l as string} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass !rounded-[10px] p-4">
            <div className="overline">{l}</div>
            <div className="num mt-1 text-[26px] font-bold" style={{ color: warn ? 'rgb(var(--idle-t))' : undefined }}>{v}</div>
            <div className="text-[12px] text-fg3">{s}</div>
          </motion.div>
        ))}
      </div>

      <Panel title="Mould changes in progress · SMED" sub="Remove → Mount → Heat → First-off approved · timer vs standard" right={<StartMC machines={hero.filter((m) => m.state === 'RUN')} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {inMC.slice(0, 6).map((m) => {
            const el = w.t - m.since;
            const next = w.mould[m.nextMouldId ?? ''];
            const std = (next?.stdChangeMin ?? 30) * 60;
            const ph = Math.min(3, Math.floor((el / std) * 4));
            const over = el > std;
            return (
              <motion.div key={m.id} layout className={cx('rounded-[10px] border p-3', over ? 'border-down/50 bg-down/[0.06]' : 'border-line/70')}>
                <div className="flex items-center justify-between">
                  <span className="num text-[18px] font-bold">{m.code} <span className="text-[12px] font-normal text-fg3">{w.unit[m.unitId].name}</span></span>
                  <span className="num flex items-center gap-1 text-[20px] font-bold" style={{ color: over ? 'rgb(var(--down-t))' : 'rgb(var(--mould-t))' }}>
                    <Timer size={16} />
                    {timer(el)}
                  </span>
                </div>
                <div className="text-[12px] text-fg3">{m.reason} · std {Math.round(std / 60)} min {over && `· overrun ${Math.round((el - std) / 60)} min`}</div>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {['Remove', 'Mount', 'Heat', 'First-off'].map((p, i) => (
                    <div key={p} className="flex flex-col gap-1">
                      <div className={cx('h-1.5 rounded-full', i < ph ? 'bg-mould' : i === ph ? 'animate-blink bg-mould' : 'bg-line')} />
                      <span className={cx('text-[10px]', i <= ph ? 'text-fg2' : 'text-fg4')}>{p}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
          {inMC.length === 0 && <div className="py-6 text-[13px] text-fg3">No mould changes running right now. Start one from a running machine.</div>}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
          <input className="input !pl-9" placeholder="Search mould, part, customer…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search moulds" />
        </div>
        {([
          ['all', 'All'],
          ['production', 'In production'],
          ['storage', 'In storage'],
          ['toolroom', 'Tool room'],
          ['pm', 'PM due'],
        ] as const).map(([k, l]) => (
          <button key={k} className={cx('chip !h-9', filter === k && 'chip-on')} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>

      <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {list.slice(0, limit).map((md, i) => {
          const pct = (md.shotsSincePM / md.pmInterval) * 100;
          const due = md.pmInterval - md.shotsSincePM < 5000;
          const m = w.machine[md.location];
          return (
            <motion.button key={md.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 16) * 0.02, ease: EASE }} whileHover={{ y: -2 }} onClick={() => setSp({ m: md.id })} className="glass flex items-center gap-3 !rounded-[10px] p-3 text-left">
              <Ring v={pct} size={64} stroke={6} color={due ? 'rgb(var(--idle))' : pct > 95 ? 'rgb(var(--down))' : 'rgb(var(--run))'}>
                <span className="num text-[13px] font-bold">{Math.round(pct)}%</span>
              </Ring>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-[17px] font-semibold">{md.id}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-fg3">{md.type === 'family' ? 'Family' : `${md.positions.length} cav`}</span>
                </div>
                <div className="truncate text-[12px] text-fg2">{md.name}</div>
                <div className="truncate text-[11px] text-fg3">
                  {md.status === 'production' && m ? `On ${m.code} · ${w.unit[m.unitId].name}` : `${STATUS_L[md.status]} · ${md.location}`}
                </div>
                <div className="num text-[11px]" style={{ color: due ? 'rgb(var(--idle-t))' : 'rgb(var(--fg3))' }}>
                  {fmt(md.pmInterval - md.shotsSincePM)} shots to PM
                </div>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
      {list.length > limit && (
        <button className="btn btn-ghost mx-auto" onClick={() => setLimit((l) => l + 48)}>
          Show more · {list.length - limit} remaining
        </button>
      )}
      <MouldDrawer id={sel} onClose={() => setSp({})} />
    </div>
  );
}

function StartMC({ machines }: { machines: ReturnType<typeof machinesOfUnit> }) {
  const [mid, setMid] = useState(machines[0]?.id ?? '');
  if (!machines.length) return null;
  return (
    <div className="flex items-center gap-2">
      <select className="input !h-8 !w-auto !text-[13px]" value={mid} onChange={(e) => setMid(e.target.value)} aria-label="Machine for mould change">
        {machines.map((m) => (
          <option key={m.id} value={m.id}>{m.code} · {m.mouldId}</option>
        ))}
      </select>
      <button
        className="btn btn-primary !h-8"
        onClick={() =>
          useSim.getState().act((w) => {
            const m = w.machine[mid];
            if (!m || m.state !== 'RUN') return;
            goMC(w, m);
            toast(w, { tone: 'mould', title: `Mould change started on ${m.code}`, body: `${m.reason} · timer running vs ${w.mould[m.nextMouldId ?? '']?.stdChangeMin ?? 30} min std` });
          })
        }
      >
        Start mould change
      </button>
    </div>
  );
}

function MouldDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const w = useWorld();
  const md = id ? w.mould[id] : undefined;
  const [blockFor, setBlockFor] = useState<number | null>(null);
  const toggle = (i: number, reason: string) => {
    useSim.getState().act((w) => {
      const x = w.mould[id!];
      x.blocked[i] = !x.blocked[i];
      toast(w, { tone: x.blocked[i] ? 'idle' : 'run', title: `Cavity ${x.positions[i].code} ${x.blocked[i] ? 'blocked' : 'unblocked'} on ${x.id}`, body: `${reason} · parts per shot now ${x.blocked.filter((b) => !b).length}` });
    });
    setBlockFor(null);
  };
  const allowed = md ? w.machines.filter((m) => m.tonnage >= md.tonnage).slice(0, 5) : [];
  const m = md ? w.machine[md.location] : undefined;
  return (
    <Drawer open={!!md} onClose={onClose} title={md ? `Mould ${md.id}` : ''} width={560}>
      {md && (
        <div className="flex flex-col gap-4 p-5 text-[13px]">
          <div>
            <div className="num text-[24px] font-bold">{md.name}</div>
            <div className="text-fg3">
              {md.serial} · {md.type === 'family' ? 'Family mould' : 'Multicavity mould'} · {md.tonnage} T min · {md.owner === 'customer' ? `customer-owned (${md.customer})` : 'own tool'}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {m ? <StatePill s={m.state} label={`On ${m.code} · ${m.state === 'RUN' ? 'running' : m.state.toLowerCase()}`} /> : <span className="chip !h-6 !cursor-default">{STATUS_L[md.status]} · {md.location}</span>}
            </div>
          </div>
          <div>
            <div className="overline mb-2">Cavity map · click to block / unblock</div>
            <div className="grid gap-2 rounded-[12px] border border-line/70 bg-[linear-gradient(135deg,rgb(var(--panel3)),rgb(var(--panel2)))] p-4" style={{ gridTemplateColumns: `repeat(${Math.min(4, md.positions.length)}, minmax(0,1fr))` }}>
              {md.positions.map((p, i) => (
                <motion.button key={i} whileTap={{ scale: 0.95 }} onClick={() => (md.blocked[i] ? toggle(i, 'Cavity repaired') : setBlockFor(i))} className={cx('relative grid h-20 place-items-center rounded-[10px] border-2 transition', md.blocked[i] ? 'border-down bg-down/15' : 'border-run/50 bg-run/10 hover:border-run')}>
                  <span className="num text-[22px] font-bold">{p.code}</span>
                  <span className="absolute bottom-1.5 text-[10px] font-semibold uppercase" style={{ color: md.blocked[i] ? 'rgb(var(--down-t))' : 'rgb(var(--run-t))' }}>
                    {md.blocked[i] ? 'Blocked' : 'Active'}
                  </span>
                  {md.blocked[i] && <span className="pat-unassigned absolute inset-0 rounded-[8px] opacity-20" />}
                </motion.button>
              ))}
            </div>
            <AnimatePresence>
              {blockFor !== null && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex flex-wrap items-center gap-1.5 overflow-hidden">
                  <span className="text-fg3">Block cavity {md.positions[blockFor].code} because:</span>
                  {['Short shot in cavity', 'Damaged insert', 'Customer request'].map((r) => (
                    <button key={r} className="chip" onClick={() => toggle(blockFor, r)}>
                      {r}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-2 text-fg3">Parts per shot: <b className="num text-fg">{md.blocked.filter((b) => !b).length}</b> of {md.positions.length} · blocked cavities show as speed & cavity loss</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[8px] bg-panel2/70 p-3"><div className="overline">Shots since PM</div><div className="num text-[20px] font-bold">{fmt(md.shotsSincePM)} / {fmt(md.pmInterval)}</div></div>
            <div className="rounded-[8px] bg-panel2/70 p-3"><div className="overline">Lifetime shots</div><div className="num text-[20px] font-bold">{fmt(md.lifetime)}</div></div>
            <div className="rounded-[8px] bg-panel2/70 p-3"><div className="overline">Std cycle</div><div className="num text-[20px] font-bold">{md.stdCycle.toFixed(1)} s</div></div>
            <div className="rounded-[8px] bg-panel2/70 p-3"><div className="overline">Std change</div><div className="num text-[20px] font-bold">{md.stdChangeMin} min</div></div>
          </div>
          <div>
            <div className="overline mb-2">Allowed machines</div>
            {allowed.map((x) => (
              <div key={x.id} className="flex justify-between border-b border-line/50 py-1.5">
                <span className="num font-semibold">{x.code} · {w.unit[x.unitId].name}</span>
                <span className="text-fg3">{x.tonnage} T · std {md.stdCycle.toFixed(1)} s · validated ✓</span>
              </div>
            ))}
          </div>
          <div>
            <div className="overline mb-2">History</div>
            {[
              [`${w.day - 2} Oct`, 'PM completed · checklist 14/14 · V. Shetty'],
              [`${w.day - 6} Oct`, 'Mould change · 34 min (std 30)'],
              [`${w.day - 11} Oct`, 'Repair · cooling line O-ring · ₹2,400'],
            ].map(([d, t]) => (
              <div key={d} className="flex gap-3 py-1"><span className="num w-14 text-fg3">{d}</span><span>{t}</span></div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => notify({ tone: 'run', title: `PM scheduled for ${md.id}`, body: `Tool room work order created · next window ${clock(w.t + 3 * 3600)}` })}>Schedule PM</button>
            <button className="btn btn-ghost" onClick={() => notify({ tone: 'info', title: `${md.id} moved`, body: 'Scan confirmed · Rack R-11' })}>Move to rack</button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
