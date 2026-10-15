import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Lock, Minus, Plus, Rocket } from 'lucide-react';
import { useState } from 'react';
import { useSim, useWorld } from '../sim/store';
import { cx, fmt } from '../lib/format';
import { EASE, Panel } from '../ui/primitives';
import { notify } from '../shell/Toasts';
import type { HeldIngest } from '../sim/types';

const POS = [
  { code: 'LH', label: 'LH' },
  { code: 'RH', label: 'RH' },
  { code: 'CTR', label: 'Center' },
  { code: 'TOP', label: 'Top' },
  { code: 'BTM', label: 'Bottom' },
];
type Status = 'machine_missing' | 'mould_missing' | 'part_missing' | 'mapping_missing' | 'ready_to_promote' | 'complete';
const META: Record<Status, { label: string; v: string; next: string; n: number }> = {
  machine_missing: { label: 'Machine missing', v: 'mould', next: 'Select machine', n: 1 },
  mould_missing: { label: 'Mould missing', v: 'idle', next: 'Add mould details', n: 2 },
  part_missing: { label: 'Part missing', v: 'down', next: 'Create part(s)', n: 3 },
  mapping_missing: { label: 'Mapping missing', v: 'down', next: 'Confirm mapping', n: 4 },
  ready_to_promote: { label: 'Ready to promote', v: 'run', next: 'Promote', n: 5 },
  complete: { label: 'Complete', v: 'run', next: 'Done', n: 5 },
};
const STEPS = ['Machine', 'Mould', 'Part', 'Mapping', 'Promote'];

const partsComplete = (it: HeldIngest) => {
  if (!it.mould) return false;
  if (it.mould.type === 'family') return it.mould.positions.every((p) => it.parts[p.code]?.partNumber && it.parts[p.code]?.partName);
  return !!(it.parts.single?.partNumber && it.parts.single?.partName);
};
export const statusOf = (it: HeldIngest): Status => (!it.machine ? 'machine_missing' : !it.mould ? 'mould_missing' : !partsComplete(it) ? 'part_missing' : !it.mapped ? 'mapping_missing' : !it.promoted ? 'ready_to_promote' : 'complete');
const maxStep = (it: HeldIngest) => META[statusOf(it)].n;

export default function MouldSetup() {
  const w = useWorld();
  const [active, setActive] = useState<string | null>(null);
  const items = w.held;
  const counts = (Object.keys(META) as Status[]).filter((s) => s !== 'complete').map((s) => ({ s, n: items.filter((i) => statusOf(i) === s).length }));
  const held = items.filter((i) => !i.promoted).reduce((a, i) => a + i.heldShots, 0);
  const item = items.find((i) => i.id === active);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 sm:p-6">
      <AnimatePresence mode="wait">
        {!item ? (
          <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE }} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[13px] text-fg3">Masters / Mould master</div>
                <h1 className="num text-[30px] font-bold leading-9">Mould master · setup queue</h1>
                <div className="text-[13px] text-fg3">Fix records in order: Machine → Mould → Part → Mapping → Promote. Every held shot promotes once its record is complete. No shot is ever dropped.</div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const id = `ING-${1001 + items.length}`;
                  useSim.getState().act((w) => w.held.unshift({ id, machine: null, mould: null, parts: {}, mapped: false, promoted: false, heldShots: 1 + Math.floor(Math.random() * 40) }));
                  setActive(id);
                }}
              >
                <Plus size={14} />New record
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {counts.map(({ s, n }, i) => (
                <motion.div key={s} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass !rounded-[10px] p-4" style={{ borderTop: `3px solid rgb(var(--${META[s].v}))` }}>
                  <div className="num text-[30px] font-bold">{n}</div>
                  <div className="text-[12px] font-semibold text-fg2">{META[s].label}</div>
                </motion.div>
              ))}
              <div className="glass !rounded-[10px] p-4" style={{ borderTop: '3px solid rgb(var(--brand))' }}>
                <div className="num text-[30px] font-bold">{fmt(held)}</div>
                <div className="text-[12px] font-semibold text-fg2">Shots held</div>
              </div>
            </div>
            <Panel bodyClass="!p-0">
              <table className="tbl w-full text-[13px]">
                <thead>
                  <tr>
                    <th>Blocked by</th>
                    <th>Machine</th>
                    <th>Ingest ID</th>
                    <th className="!text-right">Held shots</th>
                    <th>Next step</th>
                    <th className="!text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const s = statusOf(it);
                    return (
                      <tr key={it.id} className="row-click" onClick={() => setActive(it.id)}>
                        <td>
                          <span className="rounded-[3px] px-2 py-0.5 text-[11px] font-semibold" style={{ background: `rgb(var(--${META[s].v}) / 0.15)`, color: `rgb(var(--${META[s].v}-t))` }}>{META[s].label}</span>
                        </td>
                        <td>{it.machine?.name ?? <span className="text-fg3">—</span>}</td>
                        <td className="num font-semibold">{it.id}</td>
                        <td className="num !text-right">{fmt(it.heldShots)}</td>
                        <td className="text-fg2">{META[s].n}. {META[s].next}</td>
                        <td className="!text-right">
                          <span className="btn btn-primary !h-7 !px-3 !text-[12px]">{s === 'complete' ? 'View' : 'Fix →'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          </motion.div>
        ) : (
          <Wizard key={item.id} item={item} onBack={() => setActive(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Wizard({ item, onBack }: { item: HeldIngest; onBack: () => void }) {
  const w = useWorld();
  const act = useSim((s) => s.act);
  const [step, setStep] = useState(Math.min(5, maxStep(item)));
  const max = maxStep(item);
  const upd = (fn: (it: HeldIngest) => void) => act((w) => fn(w.held.find((h) => h.id === item.id)!));
  const s = statusOf(item);

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease: EASE }} className="flex flex-col gap-4">
      <button className="flex w-fit items-center gap-1.5 text-[13px] text-fg3 hover:text-fg" onClick={onBack}>
        <ArrowLeft size={14} />Back to mould master
      </button>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="num text-[28px] font-bold">{item.id}</h1>
        <span className="text-[13px] text-fg3">· {fmt(item.heldShots)} shot(s) held</span>
        <span className="rounded-[3px] px-2 py-0.5 text-[11px] font-semibold" style={{ background: `rgb(var(--${META[s].v}) / 0.15)`, color: `rgb(var(--${META[s].v}-t))` }}>{META[s].label}</span>
      </div>
      <div className="glass flex flex-wrap items-center gap-2 !rounded-[12px] p-3">
        {STEPS.map((l, i) => {
          const n = i + 1;
          const done = n < max || s === 'complete';
          const locked = n > max;
          return (
            <div key={l} className="flex items-center gap-2">
              <button disabled={locked} onClick={() => setStep(n)} className={cx('flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold transition', step === n ? 'bg-fg text-bg' : done ? 'text-run-t' : locked ? 'text-fg4' : 'text-fg2 hover:text-fg')}>
                <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[11px]', step === n ? 'bg-brand text-ink' : done ? 'bg-run/20' : 'border border-line2')}>{done ? <Check size={12} /> : locked ? <Lock size={10} /> : n}</span>
                {l}
              </button>
              {i < 4 && <span className="text-fg4">→</span>}
            </div>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: EASE }}>
          {step === 1 && <StepMachine item={item} onPick={(m) => (upd((it) => (it.machine = m)), setStep(2))} />}
          {step === 2 && <StepMould item={item} onSave={(md) => (upd((it) => (it.mould = md)), setStep(3))} />}
          {step === 3 && item.mould && <StepPart item={item} onSave={(parts) => (upd((it) => (it.parts = parts)), setStep(4))} />}
          {step === 4 && <StepMap item={item} onConfirm={() => (upd((it) => (it.mapped = true)), setStep(5))} />}
          {step === 5 && <StepPromote item={item} onPromote={() => upd((it) => (it.promoted = true))} onBack={onBack} />}
        </motion.div>
      </AnimatePresence>
      <div className="text-[12px] text-fg3">Held shots: {w.held.filter((h) => !h.promoted).reduce((a, h) => a + h.heldShots, 0)} across the queue</div>
    </motion.div>
  );
}

function StepMachine({ item, onPick }: { item: HeldIngest; onPick: (m: { id: string; name: string }) => void }) {
  const w = useWorld();
  const opts = w.unit.MN1.machineIds.slice(14).map((id) => w.machine[id]);
  const [sel, setSel] = useState(item.machine?.id ?? '');
  return (
    <Panel title="1. Select machine" sub="Choose the machine this record belongs to. This can’t be changed later.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {opts.map((m) => (
          <button key={m.id} onClick={() => setSel(m.id)} className={cx('flex items-center justify-between rounded-[10px] border p-3 text-left transition', sel === m.id ? 'border-brand bg-brand/10' : 'border-line2 hover:border-fg3')}>
            <span>
              <span className="num block text-[17px] font-semibold">{m.code} · {m.tonnage} T</span>
              <span className="text-[12px] text-fg3">{m.hall} · {m.make} · {m.id}</span>
            </span>
            {sel === m.id && <Check size={16} className="text-brand" />}
          </button>
        ))}
      </div>
      <button className="btn btn-primary mt-4" disabled={!sel || !!item.machine} style={{ opacity: !sel || item.machine ? 0.5 : 1 }} onClick={() => onPick({ id: sel, name: `${w.machine[sel].code} · ${w.machine[sel].tonnage} T · ${w.machine[sel].hall}` })}>
        {item.machine ? 'Saved ✓' : '2. Save machine →'}
      </button>
    </Panel>
  );
}

function StepMould({ item, onSave }: { item: HeldIngest; onSave: (m: NonNullable<HeldIngest['mould']>) => void }) {
  const [f, setF] = useState(item.mould ?? { name: '', serial: '', partWeight: '', threshold: '', type: 'family' as const, positions: [] as { code: string; qty: number }[] });
  const [err, setErr] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(!item.mould);
  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Mould name is required';
    if (!f.serial.trim()) e.serial = 'Serial number is required';
    if (!/^\d*\.?\d+\s*(kg|g)?$/i.test(f.partWeight.trim())) e.partWeight = 'Enter a weight like 0.255 kg';
    if (!/^\d*\.?\d+$/.test(f.threshold.trim())) e.threshold = 'Enter a threshold like 0.02';
    if (f.type === 'family' && f.positions.length < 2) e.positions = 'Pick at least two positions for a family mould';
    setErr(e);
    return !Object.keys(e).length;
  };
  if (!editing && item.mould)
    return (
      <Panel title="2. Mould details" sub="Saved for this machine." right={<button className="btn btn-ghost !h-8" onClick={() => setEditing(true)}>Edit</button>}>
        <div className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-3">
          {[
            ['Mould name', item.mould.name],
            ['Serial number', item.mould.serial],
            ['Part weight', item.mould.partWeight],
            ['Threshold', item.mould.threshold],
            ['Mould type', item.mould.type === 'family' ? 'Family mould' : 'Multicavity mould'],
            ['Cavities / positions', item.mould.positions.map((p) => `${p.code} × ${p.qty}`).join(', ')],
          ].map(([l, v]) => (
            <div key={l}><div className="overline">{l}</div><div className="font-semibold">{v}</div></div>
          ))}
        </div>
        <button className="btn btn-primary mt-4" onClick={() => onSave(item.mould!)}>3. Continue to part →</button>
      </Panel>
    );
  const field = (k: 'name' | 'serial' | 'partWeight' | 'threshold', l: string, ph: string) => (
    <label className="flex flex-col gap-1">
      <span className="overline">{l} <span className="text-down-t">*</span></span>
      <input className={cx('input', err[k] && '!border-down')} placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      {err[k] && <span className="text-[12px] text-down-t">{err[k]}</span>}
    </label>
  );
  return (
    <Panel title="2. Mould details" sub="Family mould: multiple different parts share this mould. Multicavity mould: the same part is produced in every cavity.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {field('name', 'Mould name', 'e.g. RR bumper end cap')}
        {field('serial', 'Serial number', 'SN-2291')}
        {field('partWeight', 'Part weight', '0.255 kg')}
        {field('threshold', 'Threshold', '0.02')}
      </div>
      <div className="mt-4 overline">Mould type *</div>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        {([
          ['family', 'Family mould', 'More than one related part is produced in this same mould (e.g. LH / RH / Center).'],
          ['multicavity', 'Multicavity mould', 'The exact same part is produced in every cavity of this mould.'],
        ] as const).map(([k, l, d]) => (
          <button key={k} onClick={() => setF({ ...f, type: k, positions: k === 'multicavity' ? [{ code: 'CAV', qty: 2 }] : [] })} className={cx('rounded-[10px] border p-3 text-left', f.type === k ? 'border-brand bg-brand/10' : 'border-line2')}>
            <div className="font-semibold">{l}</div>
            <div className="text-[12px] text-fg3">{d}</div>
          </button>
        ))}
      </div>
      {f.type === 'family' ? (
        <div className="mt-4">
          <div className="overline">Cavity positions * <span className="normal-case tracking-normal text-fg4">(Cavity Position master)</span></div>
          <div className="mt-2 flex flex-wrap gap-2">
            {POS.map((p) => {
              const on = f.positions.find((x) => x.code === p.code);
              return (
                <div key={p.code} className={cx('flex items-center gap-2 rounded-[10px] border px-3 py-2', on ? 'border-brand bg-brand/10' : 'border-line2')}>
                  <button className="font-semibold" onClick={() => setF({ ...f, positions: on ? f.positions.filter((x) => x.code !== p.code) : [...f.positions, { code: p.code, qty: 1 }] })}>
                    {p.label}
                  </button>
                  {on && (
                    <>
                      <button className="grid h-6 w-6 place-items-center rounded-full border border-line2" onClick={() => setF({ ...f, positions: f.positions.map((x) => (x.code === p.code ? { ...x, qty: Math.max(1, x.qty - 1) } : x)) })} aria-label="Less"><Minus size={12} /></button>
                      <span className="num w-4 text-center font-bold">{on.qty}</span>
                      <button className="grid h-6 w-6 place-items-center rounded-full border border-line2" onClick={() => setF({ ...f, positions: f.positions.map((x) => (x.code === p.code ? { ...x, qty: x.qty + 1 } : x)) })} aria-label="More"><Plus size={12} /></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {err.positions && <div className="mt-1 text-[12px] text-down-t">{err.positions}</div>}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3">
          <span className="overline">Number of cavities *</span>
          <button className="grid h-8 w-8 place-items-center rounded-full border border-line2" onClick={() => setF({ ...f, positions: [{ code: 'CAV', qty: Math.max(1, (f.positions[0]?.qty ?? 1) - 1) }] })} aria-label="Less"><Minus size={14} /></button>
          <span className="num text-[20px] font-bold">{f.positions[0]?.qty ?? 1}</span>
          <button className="grid h-8 w-8 place-items-center rounded-full border border-line2" onClick={() => setF({ ...f, positions: [{ code: 'CAV', qty: (f.positions[0]?.qty ?? 1) + 1 }] })} aria-label="More"><Plus size={14} /></button>
          <span className="text-[12px] text-fg3">One part number will cover every cavity.</span>
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <button className="btn btn-primary" onClick={() => validate() && (onSave(f as NonNullable<HeldIngest['mould']>), setEditing(false))}>3. Save mould →</button>
        <button className="btn btn-ghost" onClick={() => setF({ name: 'Rear bumper end cap', serial: 'SN-2291', partWeight: '0.255 kg', threshold: '0.02', type: 'family', positions: [{ code: 'LH', qty: 2 }, { code: 'RH', qty: 2 }] })}>Fill example</button>
      </div>
    </Panel>
  );
}

function StepPart({ item, onSave }: { item: HeldIngest; onSave: (p: HeldIngest['parts']) => void }) {
  const md = item.mould!;
  const keys = md.type === 'family' ? md.positions.map((p) => p.code) : ['single'];
  const [f, setF] = useState<HeldIngest['parts']>(() => ({ ...item.parts }));
  const [tried, setTried] = useState(false);
  const ok = keys.every((k) => f[k]?.partNumber && f[k]?.partName);
  return (
    <Panel title="3. Create part(s)" sub={`${md.type === 'family' ? 'Family mould' : 'Multicavity mould'} — one part number per ${md.type === 'family' ? 'position' : 'mould'}.`}>
      <div className="flex flex-col gap-3">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-1 gap-3 rounded-[10px] border border-line/70 p-3 md:grid-cols-[100px_1fr_1fr]">
            <div className="num self-center text-[18px] font-bold">{k === 'single' ? 'All cavities' : POS.find((p) => p.code === k)?.label ?? k}</div>
            {(['partNumber', 'partName'] as const).map((fld) => (
              <label key={fld} className="flex flex-col gap-1">
                <span className="overline">{fld === 'partNumber' ? 'Part number' : 'Part name'} <span className="text-down-t">*</span></span>
                <input className={cx('input', tried && !f[k]?.[fld] && '!border-down')} value={f[k]?.[fld] ?? ''} placeholder={fld === 'partNumber' ? 'OM2-24301L' : 'Bumper end cap LH'} onChange={(e) => setF({ ...f, [k]: { partNumber: f[k]?.partNumber ?? '', partName: f[k]?.partName ?? '', [fld]: e.target.value } })} />
                {tried && !f[k]?.[fld] && <span className="text-[12px] text-down-t">Required</span>}
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn btn-primary" onClick={() => (setTried(true), ok && onSave(f))}>4. Save part →</button>
        <button className="btn btn-ghost" onClick={() => setF(Object.fromEntries(keys.map((k, i) => [k, { partNumber: `OM2-${24301 + i}${k === 'single' ? 'A' : k[0]}`, partName: `${md.name}${k === 'single' ? '' : ' ' + k}` }])))}>Fill example</button>
      </div>
    </Panel>
  );
}

function StepMap({ item, onConfirm }: { item: HeldIngest; onConfirm: () => void }) {
  const md = item.mould!;
  const rows = md.type === 'family' ? md.positions.map((p) => ({ ...item.parts[p.code], pos: `${p.code} × ${p.qty}` })) : [{ ...item.parts.single, pos: `All ${md.positions[0]?.qty ?? 1} cavities` }];
  return (
    <Panel title="4. Confirm mapping" sub="Link the part(s) below to this machine + mould. Held shots can’t promote until this is confirmed.">
      <table className="tbl w-full text-[13px]">
        <thead>
          <tr>
            <th>Part</th>
            <th>Position</th>
            <th>Machine · mould</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.pos}>
              <td><span className="num font-semibold">{r.partNumber}</span> · {r.partName}</td>
              <td>{r.pos}</td>
              <td>{item.machine?.name} · {md.name}</td>
              <td>{item.mapped ? <span className="text-run-t">Mapped ✓</span> : <span className="text-idle-t">Pending</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-primary mt-4" onClick={onConfirm}>5. Confirm mapping →</button>
    </Panel>
  );
}

function StepPromote({ item, onPromote, onBack }: { item: HeldIngest; onPromote: () => void; onBack: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'flying' | 'done'>(item.promoted ? 'done' : 'idle');
  const [count, setCount] = useState(item.promoted ? item.heldShots : 0);
  const dots = Array.from({ length: 24 });
  const go = () => {
    setPhase('flying');
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1400);
      setCount(Math.round(item.heldShots * k));
      if (k < 1) requestAnimationFrame(tick);
      else {
        setPhase('done');
        onPromote();
        notify({ tone: 'run', title: `${fmt(item.heldShots)} shots released to production`, body: `${item.id} · original timestamps kept · aggregates recalculated` });
      }
    };
    requestAnimationFrame(tick);
  };
  return (
    <Panel title="5. Promote" sub="Machine, mould, part and mapping are all set. Release the held shots to production.">
      <div className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-4">
        {[
          ['Machine', item.machine?.name],
          ['Mould', item.mould?.name],
          ['Parts mapped', item.mould?.type === 'family' ? item.mould.positions.length : 1],
          ['Shots held', fmt(item.heldShots)],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-[8px] bg-panel2/70 p-3"><div className="overline">{l}</div><div className="num text-[18px] font-semibold">{v}</div></div>
        ))}
      </div>
      <div className="relative mt-6 flex items-center justify-between gap-6 overflow-hidden rounded-[12px] border border-line/70 p-6">
        <div className="flex flex-col items-center gap-2">
          <div className="grid h-20 w-20 place-items-center rounded-[14px] border border-idle/50 bg-idle/10">
            <span className="num text-[22px] font-bold text-idle-t">{fmt(Math.max(0, item.heldShots - count))}</span>
          </div>
          <span className="overline">Held queue</span>
        </div>
        <div className="relative h-20 flex-1">
          {phase === 'flying' &&
            dots.map((_, i) => (
              <motion.span
                key={i}
                className="absolute left-0 top-1/2 h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_12px_#F26A21]"
                initial={{ x: 0, y: (i % 5) * 6 - 12, opacity: 0, scale: 0.6 }}
                animate={{ x: ['0%', '100%'], opacity: [0, 1, 1, 0], scale: [0.6, 1.2, 0.8] }}
                style={{ left: 0 }}
                transition={{ duration: 0.9, delay: i * 0.045, ease: EASE }}
              />
            ))}
          {phase === 'flying' &&
            dots.map((_, i) => (
              <motion.span key={`t${i}`} className="absolute top-1/2 h-1.5 w-1.5 rounded-full bg-brand" initial={{ left: '0%', opacity: 0 }} animate={{ left: '100%', opacity: [0, 1, 0] }} transition={{ duration: 0.9, delay: i * 0.045, ease: EASE }} style={{ marginTop: ((i * 7) % 20) - 10 }} />
            ))}
          <div className="absolute inset-x-0 top-1/2 h-px bg-[repeating-linear-gradient(90deg,rgb(var(--line2))_0_6px,transparent_6px_12px)]" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <motion.div animate={phase === 'done' ? { scale: [1, 1.12, 1] } : {}} className="grid h-20 w-20 place-items-center rounded-[14px] border border-run/50 bg-run/10">
            <span className="num text-[22px] font-bold text-run-t">+{fmt(count)}</span>
          </motion.div>
          <span className="overline">Production records</span>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        {phase !== 'done' ? (
          <button className="btn btn-primary !h-12 !px-6 !text-[15px]" disabled={phase === 'flying'} onClick={go}>
            <Rocket size={16} />Promote — release {fmt(item.heldShots)} shot(s) →
          </button>
        ) : (
          <>
            <span className="flex items-center gap-2 font-semibold text-run-t"><Check size={16} />Promoted · idempotent, safe to re-run</span>
            <button className="btn btn-ghost" onClick={onBack}>Back to queue</button>
          </>
        )}
      </div>
    </Panel>
  );
}
