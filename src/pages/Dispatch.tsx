import { AnimatePresence, motion } from 'framer-motion';
import { LogIn, LogOut, Truck as TruckIcon } from 'lucide-react';
import { useState } from 'react';
import { useSim, useWorld } from '../sim/store';
import { newTruck, toast } from '../sim/engine';
import { orderRisk } from '../sim/kpi';
import { clock, cx, fmt, inr } from '../lib/format';
import { EASE, Modal, Panel } from '../ui/primitives';

export const waitTone = (min: number) => (min > 60 ? 'down' : min > 30 ? 'idle' : 'run');

export default function Dispatch() {
  const w = useWorld();
  const [unit, setUnit] = useState('MN1');
  const [gateOpen, setGateOpen] = useState(false);
  const inside = w.trucks.filter((k) => k.unitId === unit && k.phase < 3).sort((a, b) => a.gateIn - b.gateIn);
  const left = w.trucks.filter((k) => k.unitId === unit && k.phase === 3 && k.out !== null && w.t - k.out < 7200).sort((a, b) => (b.out ?? 0) - (a.out ?? 0));
  const outToday = w.trucks.filter((k) => k.unitId === unit && k.phase === 3).length + 14;
  const over60 = inside.filter((k) => w.t - k.gateIn > 3600).length;
  const risks = w.orders.filter((o) => o.unitId === unit).map((o) => ({ o, r: orderRisk(w, o) }));

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] text-fg3">{w.unit[unit].name} · Gate & dispatch · from security gate entry</div>
          <h1 className="num text-[30px] font-bold leading-9">Every truck on time and full</h1>
        </div>
        <div className="flex gap-2">
          <select className="input !h-9 !w-auto !text-[13px]" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
            {w.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setGateOpen(true)}><LogIn size={14} />Gate entry</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Inside', inside.length, 'vehicles at the gate', ''],
          ['Over 30 min', inside.filter((k) => w.t - k.gateIn > 1800).length, 'amber limit', 'idle'],
          ['Over 60 min', over60, 'red limit · alerts dispatch + unit head', 'down'],
          ['Left today', outToday, 'avg turnaround 46 min', 'run'],
        ].map(([l, v, s, tone], i) => (
          <motion.div key={l as string} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass !rounded-[10px] p-4" style={{ borderTop: tone ? `3px solid rgb(var(--${tone}))` : '3px solid #F4E3A1' }}>
            <div className="overline">{l}</div>
            <div className="num mt-1 text-[30px] font-bold">{v}</div>
            <div className="text-[12px] text-fg3">{s}</div>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Trucks inside · longest waiting first" sub="Waiting turns amber at 30 min and red at 60 min (limits per unit in Settings)" bodyClass="!p-0">
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[860px] text-[13px]">
              <thead>
                <tr>
                  <th>Dir</th>
                  <th>Vehicle · transporter</th>
                  <th>Customer / supplier</th>
                  <th>Status</th>
                  <th>Invoice / DC</th>
                  <th>Gate-in</th>
                  <th className="!text-right">Waiting</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {inside.map((k) => {
                    const min = Math.round((w.t - k.gateIn) / 60);
                    const tone = waitTone(min);
                    return (
                      <motion.tr key={k.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.35, ease: EASE }} className={cx(tone === 'down' && 'bg-down/[0.07]', tone === 'idle' && 'bg-idle/[0.05]')}>
                        <td>
                          <span className={cx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold', k.dir === 'OUT' ? 'bg-fg text-bg' : 'bg-mould text-white')}>
                            {k.dir === 'OUT' ? <LogOut size={11} /> : <LogIn size={11} />}
                            {k.dir}
                          </span>
                        </td>
                        <td className="!h-auto py-2">
                          <span className="plate text-[15px]">{k.plate}</span>
                          <div className="mt-1 text-[11px] text-fg3">{k.transporter}</div>
                        </td>
                        <td>{k.party}</td>
                        <td className={cx(tone === 'down' && 'font-semibold text-down-t')}>{k.status}</td>
                        <td className="num">{k.doc}</td>
                        <td className="num">{clock(k.gateIn)}</td>
                        <td className="!text-right">
                          <span className="num text-[18px] font-bold" style={{ color: `rgb(var(--${tone}-t))` }}>{min}′</span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
            {inside.length === 0 && <div className="py-10 text-center text-[13px] text-fg3">No vehicles inside right now.</div>}
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="Left in last 2 h">
            {left.slice(0, 6).map((k) => {
              const stay = Math.round(((k.out ?? 0) - k.gateIn) / 60);
              return (
                <div key={k.id} className="flex items-center justify-between border-b border-line/40 py-2 text-[13px]">
                  <div>
                    <span className="plate text-[13px]">{k.plate}</span>
                    <div className="mt-0.5 text-[11px] text-fg3">{k.dir} · {k.party}</div>
                  </div>
                  <div className="text-right">
                    <div className="num">out {clock(k.out ?? 0)}</div>
                    <div className="num text-[11px]" style={{ color: stay > 60 ? 'rgb(var(--down-t))' : 'rgb(var(--fg3))' }}>stayed {stay} min</div>
                  </div>
                </div>
              );
            })}
            {left.length === 0 && <div className="text-[13px] text-fg3">No departures in the last 2 h.</div>}
          </Panel>
          <Panel title="Dispatch at risk" sub="Order due by truck time vs FG stock + projected output (live run rate)">
            {risks.map(({ o, r }) => (
              <div key={o.id} className="border-b border-line/40 py-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="font-semibold">{o.customer} · {r.part?.name}</span>
                  <span className="num font-bold" style={{ color: r.short > 0 ? 'rgb(var(--down-t))' : 'rgb(var(--run-t))' }}>{r.short > 0 ? inr(r.value) : 'Covered'}</span>
                </div>
                <div className="text-[12px] text-fg3">
                  {fmt(o.qty)} due {o.truck} · stock {fmt(o.stock)} + projected {fmt(r.projected - o.stock)} {r.short > 0 && <b className="text-down-t">· {fmt(r.short)} short</b>}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/60">
                  <motion.div className="h-full rounded-full" animate={{ width: `${Math.min(100, (r.projected / o.qty) * 100)}%` }} style={{ background: r.short > 0 ? 'rgb(var(--down))' : 'rgb(var(--run))' }} />
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
      <GateEntry open={gateOpen} onClose={() => setGateOpen(false)} unit={unit} />
    </div>
  );
}

function GateEntry({ open, onClose, unit }: { open: boolean; onClose: () => void; unit: string }) {
  const [plate, setPlate] = useState('HR 55 AN 6620');
  const [dir, setDir] = useState<'IN' | 'OUT'>('OUT');
  const [party, setParty] = useState('Orion Motors, Manesar');
  return (
    <Modal open={open} onClose={onClose} title="Security gate · new vehicle" width={480}>
      <div className="flex flex-col gap-3 p-5 text-[13px]">
        <label className="flex flex-col gap-1">
          <span className="overline">Vehicle number *</span>
          <input className="plate !h-12 !rounded-[6px] text-center text-[22px] outline-none" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['IN', 'OUT'] as const).map((d) => (
            <button key={d} onClick={() => setDir(d)} className={cx('flex h-12 items-center justify-center gap-2 rounded-[10px] border font-semibold', dir === d ? 'border-brand bg-brand/10' : 'border-line2')}>
              <TruckIcon size={16} />
              {d === 'IN' ? 'IN · supplier' : 'OUT · customer'}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="overline">Customer / supplier</span>
          <input className="input" value={party} onChange={(e) => setParty(e.target.value)} />
        </label>
        <button
          className="btn btn-primary !h-12"
          onClick={() => {
            useSim.getState().act((w) => {
              const k = newTruck(w, w.unit[unit], { plate, dir, party, partyShort: party.split(' ')[0], status: dir === 'OUT' ? 'Waiting for loading' : 'Waiting to unload' });
              toast(w, { tone: 'info', title: `Gate-in ${k.plate}`, body: `${dir} · ${party} · ${clock(w.t)}` });
            });
            onClose();
          }}
        >
          Record gate-in
        </button>
      </div>
    </Modal>
  );
}
