import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Download, FileText, Plus, ScanLine, Search } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorld } from '../sim/store';
import { aggMachines, derive, machinesOfUnit } from '../sim/kpi';
import { latestParts, paramsAtShot, type PartRec } from '../sim/records';
import { hourIdx } from '../sim/engine';
import { DEFECTS, shiftStartOf } from '../sim/catalog';
import { clock, cx, fmt, fmt1, pct } from '../lib/format';
import { Drawer, EASE, Modal, Panel, Segmented } from '../ui/primitives';
import { notify } from '../shell/Toasts';

const PAGE = 14;

function WeightBar({ r }: { r: PartRec }) {
  const dev = (r.weight - r.nominal) / r.tol; // -1..1 = within
  const pos = Math.max(3, Math.min(97, 50 + dev * 30));
  const out = Math.abs(dev) > 1;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2.5 w-[140px] rounded-full bg-line/60">
        <div className="absolute inset-y-0 rounded-full bg-run/30" style={{ left: '20%', right: '20%' }} />
        <div className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-sm" style={{ left: `${pos}%`, background: out ? 'rgb(var(--down))' : 'rgb(var(--fg))' }} />
      </div>
      <span className="num w-14 text-right" style={{ color: out ? 'rgb(var(--down-t))' : undefined }}>
        {fmt1(r.weight)} g
      </span>
    </div>
  );
}

export default function Records() {
  const w = useWorld();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const unit = w.unit[w.machine[sp.get('m') ?? '']?.unitId ?? 'MN1'];
  const ms = machinesOfUnit(w, unit);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [shift, setShift] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [mach, setMach] = useState(sp.get('m') ?? 'all');
  const [mould, setMould] = useState('all');
  const [nok, setNok] = useState(!sp.get('m') && !sp.get('q'));
  const [outTol, setOutTol] = useState(false);
  const [view, setView] = useState<'parts' | 'hour' | 'machine'>('parts');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<PartRec | null>(null);
  const [manual, setManual] = useState<PartRec[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { ok: boolean; reason: string }>>({});
  const [addOpen, setAddOpen] = useState(false);
  const bucket = Math.floor(w.t / 4);

  const all = useMemo(() => {
    const list: PartRec[] = [...manual];
    for (const m of ms) list.push(...latestParts(w, m, 70));
    list.sort((a, b) => b.t - a.t);
    return list.map((r) => (overrides[r.serial] ? { ...r, ...overrides[r.serial], auto: false } : r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, manual, overrides, unit.id]);

  const filtered = all.filter((r) => {
    if (shift !== 'all' && r.shift !== shift) return false;
    if (mach !== 'all' && r.machineId !== mach) return false;
    if (mould !== 'all' && r.mouldId !== mould) return false;
    if (nok && r.ok) return false;
    if (outTol && Math.abs(r.weight - r.nominal) <= r.tol) return false;
    if (q) {
      const s = q.toLowerCase();
      const p = w.part[r.partId];
      if (!(r.serial.toLowerCase().includes(s) || r.mouldId.toLowerCase().includes(s) || w.machine[r.machineId].code.toLowerCase().includes(s) || w.machine[r.machineId].wo.toLowerCase().includes(s) || p?.name.toLowerCase().includes(s))) return false;
    }
    return true;
  });
  const A = aggMachines(w, ms.filter((m) => mach === 'all' || m.id === mach));
  const D = derive(A);
  const top = [...ms].sort((a, b) => b.bad - a.bad)[0];
  const outCount = Math.round(A.bad * 0.58);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] text-fg3">
            <Link to="/home" className="hover:text-fg">Corporate</Link> / {w.org[unit.orgId].name} / <Link to={`/unit/${unit.id}`} className="hover:text-fg">{unit.name}</Link>
          </div>
          <h1 className="num mt-1 text-[30px] font-bold leading-9">Production records</h1>
          <div className="text-[13px] text-fg3">Per-part traceability · weight vs tolerance on every row · click a part for the shot’s process data</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => notify({ tone: 'run', title: 'Export ready', body: `${unit.code}_records_${clock(w.t).replace(':', '')}.xlsx · ${fmt(filtered.length)} rows` })}>
            <Download size={14} />Export Excel
          </button>
          <button className="btn btn-ghost" onClick={() => notify({ tone: 'run', title: 'Shift handover PDF generated', body: `${unit.name} · Shift A · ${fmt(A.good)} OK · ${fmt(A.bad)} NOT OK` })}>
            <FileText size={14} />Shift handover PDF
          </button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={14} />Add manual record
          </button>
        </div>
      </div>

      <div className="glass flex flex-wrap items-center gap-2 !rounded-[12px] p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
          <input className="input !pl-9" placeholder="Search serial, job, mould, part…" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} aria-label="Search records" />
        </div>
        <button className="btn btn-ghost" onClick={() => { const r = all[Math.floor(all.length / 3)]; setQ(r.serial); notify({ tone: 'info', title: 'Scanned', body: r.serial }); }}>
          <ScanLine size={14} />Scan
        </button>
        <span className="chip !cursor-default">{w.day} Oct 2026</span>
        <Segmented<'all' | 'A' | 'B' | 'C'> size="sm" options={[{ v: 'all', l: 'All shifts' }, { v: 'A', l: 'A' }, { v: 'B', l: 'B' }, { v: 'C', l: 'C' }]} value={shift} onChange={(v) => (setShift(v), setPage(0))} />
        <select className="input !h-8 !w-auto !text-[13px]" value={mach} onChange={(e) => (setMach(e.target.value), setPage(0))} aria-label="Machine">
          <option value="all">Machine: All</option>
          {ms.map((m) => (
            <option key={m.id} value={m.id}>{m.code}</option>
          ))}
        </select>
        <select className="input !h-8 !w-auto !text-[13px]" value={mould} onChange={(e) => (setMould(e.target.value), setPage(0))} aria-label="Mould">
          <option value="all">Mould: All</option>
          {ms.map((m) => (
            <option key={m.mouldId} value={m.mouldId}>{m.mouldId}</option>
          ))}
        </select>
        <button className={cx('chip !h-8', nok && 'chip-on')} onClick={() => (setNok((v) => !v), setPage(0))}>NOT OK only {nok && '✕'}</button>
        <button className={cx('chip !h-8', outTol && 'chip-on')} onClick={() => (setOutTol((v) => !v), setPage(0))}>Weight out of tolerance</button>
        <Segmented<'parts' | 'hour' | 'machine'> size="sm" className="ml-auto" options={[{ v: 'parts', l: 'Parts' }, { v: 'hour', l: 'By hour' }, { v: 'machine', l: 'By machine' }]} value={view} onChange={setView} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Records (filtered)', fmt(view === 'parts' ? filtered.length : A.parts), 'sample of live parts'],
          ['NOT OK', `${fmt(A.bad)} · ${pct(D.rej)}`, 'this shift', D.rej > 3],
          ['Weight out of tol.', fmt(outCount), 'auto-classified', true],
          ['Top machine', `${top.code} · ${fmt(top.bad)}`, 'NOT OK parts'],
        ].map(([l, v, s, red], i) => (
          <motion.div key={l as string} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass !rounded-[10px] p-4">
            <div className="overline">{l}</div>
            <div className="num mt-1 text-[26px] font-bold" style={{ color: red ? 'rgb(var(--down-t))' : undefined }}>{v}</div>
            <div className="text-[12px] text-fg3">{s}</div>
          </motion.div>
        ))}
      </div>

      {view === 'parts' && (
        <Panel bodyClass="!p-0">
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[980px] text-[13px]">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Time</th>
                  <th>Machine</th>
                  <th>Shift</th>
                  <th>Mould · part</th>
                  <th>Weight vs tolerance</th>
                  <th>Reason</th>
                  <th className="!text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((r) => (
                    <motion.tr key={r.serial} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: EASE }} className={cx('row-click', sel?.serial === r.serial && '!bg-brand/10 shadow-[inset_3px_0_0_#F26A21]')} onClick={() => setSel(r)}>
                      <td className="font-mono text-[12px]">
                        {r.serial} {r.manual && <span className="ml-1 rounded bg-mould/15 px-1 text-[10px] font-semibold text-mould-t">MANUAL</span>}
                      </td>
                      <td className="num">{clock(r.t, true)}</td>
                      <td className="num font-semibold">{w.machine[r.machineId].code}</td>
                      <td>{r.shift}</td>
                      <td className="max-w-[220px] truncate">
                        {r.mouldId} · {w.part[r.partId]?.name}
                      </td>
                      <td>
                        <WeightBar r={r} />
                      </td>
                      <td className="text-fg2">{r.reason || '—'}</td>
                      <td className="!text-right">
                        <span className={cx('rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold', r.ok ? 'bg-run/15 text-run-t' : 'bg-down/15 text-down-t')}>{r.ok ? 'OK' : 'NOT OK'}</span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {rows.length === 0 && <div className="py-10 text-center text-[13px] text-fg3">No parts match these filters. Clear “NOT OK only” or pick another machine.</div>}
          </div>
          <div className="flex items-center justify-between border-t border-line/60 px-4 py-2.5 text-[12px] text-fg3">
            <span>
              {filtered.length ? page * PAGE + 1 : 0}–{Math.min(filtered.length, (page + 1) * PAGE)} of {fmt(filtered.length)} {nok ? 'NOT OK ' : ''}parts
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(pages, 6) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} className={cx('num h-7 w-7 rounded', page === i ? 'bg-fg text-bg' : 'hover:bg-panel3')}>
                  {i + 1}
                </button>
              ))}
              {pages > 6 && <span className="px-1">… {pages}</span>}
            </div>
          </div>
        </Panel>
      )}
      {view === 'hour' && <ByHour ms={ms.filter((m) => mach === 'all' || m.id === mach)} all={all} onPick={setSel} />}
      {view === 'machine' && <ByMachine ms={ms} onOpen={(id) => nav(`/machine/${id}`)} />}

      <PartDrawer r={sel} onClose={() => setSel(null)} onStatus={(ok, reason) => {
        if (!sel) return;
        setOverrides((o) => ({ ...o, [sel.serial]: { ok, reason } }));
        setSel({ ...sel, ok, reason, auto: false });
        notify({ tone: 'info', title: `${sel.serial} marked ${ok ? 'OK' : 'NOT OK'}`, body: `Reason: ${reason || 'released after re-inspection'} · audited` });
      }} />
      <AddManual open={addOpen} onClose={() => setAddOpen(false)} ms={ms} onAdd={(r) => { setManual((l) => [r, ...l]); setNok(false); setPage(0); notify({ tone: 'run', title: 'Manual record added', body: `${r.serial} · flagged MANUAL · excluded from SPC` }); }} />
    </div>
  );
}

function PartDrawer({ r, onClose, onStatus }: { r: PartRec | null; onClose: () => void; onStatus: (ok: boolean, reason: string) => void }) {
  const w = useWorld();
  const nav = useNavigate();
  const [changing, setChanging] = useState(false);
  const [reason, setReason] = useState('');
  if (!r) return <Drawer open={false} onClose={onClose}>{null}</Drawer>;
  const m = w.machine[r.machineId];
  const p = w.part[r.partId];
  const params = paramsAtShot(w, m, r.serial);
  return (
    <Drawer open={!!r} onClose={() => (onClose(), setChanging(false))} title="Part" width={520}>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <div className="font-mono text-[18px] font-semibold">{r.serial}</div>
          <div className="text-[13px] text-fg3">
            {m.code} · Shift {r.shift} · {clock(r.t, true)} · cavity {r.cavity}
          </div>
          <span className={cx('mt-2 inline-block rounded-[3px] px-2 py-1 text-[12px] font-semibold', r.ok ? 'bg-run/15 text-run-t' : 'bg-down/15 text-down-t')}>{r.ok ? 'OK' : 'NOT OK'}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass !rounded-[8px] p-3">
            <div className="overline">Weight</div>
            <div className="num text-[24px] font-bold" style={{ color: Math.abs(r.weight - r.nominal) > r.tol ? 'rgb(var(--down-t))' : undefined }}>{fmt1(r.weight)} g</div>
            <div className="text-[12px] text-fg3">std {fmt1(r.nominal)} ± {r.tol}</div>
          </div>
          <div className="glass !rounded-[8px] p-3">
            <div className="overline">Reject reason</div>
            <div className="text-[15px] font-semibold">{r.reason || '—'}</div>
            <div className="text-[12px] text-fg3">{r.ok ? 'Passed weight check' : r.auto ? `Auto: weight ${r.weight > r.nominal ? 'high' : 'low'}` : 'Manual · QC inspector'}</div>
          </div>
          <div className="glass !rounded-[8px] p-3">
            <div className="overline">Job</div>
            <div className="num text-[18px] font-semibold">{m.wo}</div>
            <div className="text-[12px] text-fg3">{p?.customer}</div>
          </div>
          <div className="glass !rounded-[8px] p-3">
            <div className="overline">Mould</div>
            <div className="num text-[18px] font-semibold">{r.mouldId}</div>
            <div className="truncate text-[12px] text-fg3">{p?.name}</div>
          </div>
        </div>
        <div>
          <div className="overline mb-2">Process data at this shot</div>
          <div className="flex flex-col">
            {params.map((x) => {
              const bad = x.v < x.lo || x.v > x.hi;
              const near = !bad && (x.v < x.lo + (x.hi - x.lo) * 0.1 || x.v > x.hi - (x.hi - x.lo) * 0.1);
              return (
                <div key={x.l} className="flex justify-between border-b border-line/50 py-1.5 text-[13px]">
                  <span className="text-fg2">{x.l}</span>
                  <span className="num font-semibold" style={{ color: bad ? 'rgb(var(--down-t))' : near ? 'rgb(var(--idle-t))' : undefined }}>
                    {x.v >= 100 ? fmt(x.v) : fmt1(x.v)} {x.u}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-[12px] text-fg3">Trace: material lot PP {2609}-{114 + (r.shot % 9)} · operator {m.operator} · inspector QA · N. Kapoor · dispatch pending</div>
        {changing ? (
          <div className="glass flex flex-col gap-2 !rounded-[10px] p-3">
            <div className="overline">Change status · reason mandatory</div>
            <div className="flex flex-wrap gap-1.5">
              {(r.ok ? DEFECTS : ['Re-inspected OK', 'Gauge error', 'Customer concession']).map((d) => (
                <button key={d} className={cx('chip', reason === d && 'chip-on')} onClick={() => setReason(d)}>
                  {d}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={!reason} style={{ opacity: reason ? 1 : 0.5 }} onClick={() => { onStatus(!r.ok, r.ok ? reason : ''); setChanging(false); setReason(''); }}>
                Mark {r.ok ? 'NOT OK' : 'OK'}
              </button>
              <button className="btn btn-ghost" onClick={() => setChanging(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => (onClose(), nav(`/machine/${m.id}`))}>Open machine {m.code}</button>
            <button className="btn btn-ghost" onClick={() => setChanging(true)}>Change status</button>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function ByHour({ ms, all, onPick }: { ms: ReturnType<typeof machinesOfUnit>; all: PartRec[]; onPick: (r: PartRec) => void }) {
  const w = useWorld();
  const [open, setOpen] = useState<number | null>(hourIdx(w.t));
  const s0 = shiftStartOf(w.t);
  const hi = hourIdx(w.t);
  const rows = Array.from({ length: hi + 1 }, (_, i) => hi - i).map((i) => {
    let total = 0;
    let bad = 0;
    for (const m of ms) {
      total += m.hourly[i];
      bad += m.hourlyBad[i];
    }
    const parts = all.filter((r) => r.t >= s0 + i * 3600 && r.t < s0 + (i + 1) * 3600);
    const causes = new Map<string, number>();
    for (const r of parts) if (!r.ok) causes.set(`${r.reason.split(' ')[0]} · ${w.machine[r.machineId].code}`, (causes.get(`${r.reason.split(' ')[0]} · ${w.machine[r.machineId].code}`) ?? 0) + 1);
    const cause = [...causes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (bad ? 'Flash · ' + ms[i % ms.length].code : '—');
    const spreadMid = ((i * 37) % 10) / 10 - 0.5;
    return { i, label: `${clock(s0 + i * 3600)}–${clock(s0 + (i + 1) * 3600)}`, total, bad, parts, cause, spreadMid, spread: 0.9 + ((i * 13) % 7) / 10 };
  });
  return (
    <Panel bodyClass="!p-0">
      <div className="overflow-x-auto">
        <table className="tbl w-full min-w-[900px] text-[13px]">
          <thead>
            <tr>
              <th>Hour</th>
              <th className="!text-right">Parts</th>
              <th>OK / NOT OK</th>
              <th className="!text-right">Reject</th>
              <th>Weight spread</th>
              <th>Top reject cause</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rej = r.total ? (r.bad / r.total) * 100 : 0;
              const lo = 50 + ((r.spreadMid - r.spread / 2) / 1.5) * 30;
              const span = (r.spread / 1.5) * 30;
              return (
                <Fragment key={r.i}>
                  <tr className={cx('row-click', open === r.i && '!bg-brand/[0.07]')} onClick={() => setOpen(open === r.i ? null : r.i)}>
                    <td className="num font-semibold">{r.label}{r.i === hourIdx(w.t) && <span className="ml-2 text-[11px] text-brand">live</span>}</td>
                    <td className="num !text-right">{fmt(r.total)}</td>
                    <td>
                      <span className="num">{fmt(r.total - r.bad)}</span> OK · <span className="num text-down-t">{fmt(r.bad)} NOT OK</span>
                    </td>
                    <td className="num !text-right font-semibold" style={{ color: rej > 3 ? 'rgb(var(--down-t))' : undefined }}>{pct(rej)}</td>
                    <td>
                      <div className="relative h-2.5 w-[160px] rounded-full bg-line/60">
                        <div className="absolute inset-y-0 rounded-full bg-run/20" style={{ left: '20%', right: '20%' }} />
                        <div className="absolute inset-y-0 rounded-full" style={{ left: `${Math.max(0, lo)}%`, width: `${span}%`, background: lo < 20 || lo + span > 80 ? 'rgb(var(--down))' : 'rgb(var(--run))' }} />
                      </div>
                    </td>
                    <td>{r.cause}</td>
                    <td>{open === r.i ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  </tr>
                  {open === r.i && (
                    <tr>
                      <td colSpan={7} className="!h-auto bg-panel2/40 !py-2">
                        {r.parts.slice(0, 6).map((p) => (
                          <button key={p.serial} onClick={() => onPick(p)} className="flex w-full items-center gap-4 rounded px-2 py-1 text-left hover:bg-panel3/60">
                            <span className="w-40 font-mono text-[12px]">{p.serial}</span>
                            <span className="num w-20">{clock(p.t, true)}</span>
                            <span className="num w-16">{w.machine[p.machineId].code}</span>
                            <span className="flex-1 text-fg2">{p.reason || '—'}</span>
                            <span className="num w-16 text-right">{fmt1(p.weight)} g</span>
                            <span className={cx('w-16 text-right text-[11px] font-semibold', p.ok ? 'text-run-t' : 'text-down-t')}>{p.ok ? 'OK' : 'NOT OK'}</span>
                          </button>
                        ))}
                        {r.parts.length === 0 && <div className="px-2 py-2 text-fg3">Part-level detail for earlier hours is in the archive · {fmt(r.total)} parts</div>}
                        {r.parts.length > 0 && <div className="px-2 pt-1 text-[12px] text-brand">Show all {fmt(r.total)} parts for this hour →</div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line/60 px-4 py-2.5 text-[12px] text-fg3">Green band = weight tolerance · rows roll up from per-shot records</div>
    </Panel>
  );
}

function ByMachine({ ms, onOpen }: { ms: ReturnType<typeof machinesOfUnit>; onOpen: (id: string) => void }) {
  const w = useWorld();
  return (
    <Panel bodyClass="!p-0">
      <table className="tbl w-full text-[13px]">
        <thead>
          <tr>
            <th>Machine</th>
            <th>Mould · part</th>
            <th className="!text-right">Parts</th>
            <th className="!text-right">NOT OK</th>
            <th className="!text-right">Reject</th>
          </tr>
        </thead>
        <tbody>
          {[...ms].sort((a, b) => b.bad / Math.max(1, b.parts) - a.bad / Math.max(1, a.parts)).map((m) => {
            const rej = m.parts ? (m.bad / m.parts) * 100 : 0;
            return (
              <tr key={m.id} className="row-click" onClick={() => onOpen(m.id)}>
                <td className="num font-semibold">{m.code}</td>
                <td>{m.mouldId} · {w.part[w.mould[m.mouldId].positions[0].partId]?.name}</td>
                <td className="num !text-right">{fmt(m.parts)}</td>
                <td className="num !text-right">{fmt(m.bad)}</td>
                <td className="num !text-right font-semibold" style={{ color: rej > 3 ? 'rgb(var(--down-t))' : undefined }}>{pct(rej)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function AddManual({ open, onClose, ms, onAdd }: { open: boolean; onClose: () => void; ms: ReturnType<typeof machinesOfUnit>; onAdd: (r: PartRec) => void }) {
  const w = useWorld();
  const stopped = ms.filter((m) => m.state !== 'RUN');
  const [mid, setMid] = useState(stopped[0]?.id ?? ms[0].id);
  const [okN, setOkN] = useState(120);
  const [ngN, setNgN] = useState(4);
  const m = w.machine[mid];
  return (
    <Modal open={open} onClose={onClose} title="Manual production entry" width={520}>
      <div className="flex flex-col gap-3 p-5 text-[13px]">
        <div className="text-fg3">For stopped / offline windows only. Manual records carry a MANUAL badge everywhere and stay out of SPC.</div>
        <label className="flex flex-col gap-1">
          <span className="overline">Machine *</span>
          <select className="input" value={mid} onChange={(e) => setMid(e.target.value)}>
            {ms.map((x) => (
              <option key={x.id} value={x.id}>{x.code} · {x.state === 'RUN' ? 'running' : 'stopped'}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="overline">Start</span>
            <input className="input" defaultValue="10:40" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="overline">End</span>
            <input className="input" defaultValue="11:10" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="overline">OK count *</span>
            <input className="input" type="number" value={okN} onChange={(e) => setOkN(+e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="overline">NOT OK count *</span>
            <input className="input" type="number" value={ngN} onChange={(e) => setNgN(+e.target.value)} />
          </label>
        </div>
        <div className="text-fg3">Shift auto-locked: A · distribution: even across hours · part {w.part[w.mould[m.mouldId].positions[0].partId]?.name}</div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              const md = w.mould[m.mouldId];
              const p = w.part[md.positions[0].partId];
              onAdd({ serial: `${w.unit[m.unitId].code}-${m.code.slice(4)}-M${Math.floor(w.t) % 100000}`, t: w.t, machineId: m.id, shot: 0, cavity: 'A', mouldId: md.id, partId: p.id, weight: p.weight, nominal: p.weight, tol: p.tol, ok: true, reason: `Manual batch · ${okN} OK / ${ngN} NOT OK`, auto: false, shift: 'A', manual: true });
              onClose();
            }}
          >
            Save · flag as manual
          </button>
        </div>
      </div>
    </Modal>
  );
}
