import { motion } from 'framer-motion';
import { AlertTriangle, Medal, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorld } from '../sim/store';
import { machineKpis } from '../sim/kpi';
import { SKILLS, shiftOf } from '../sim/catalog';
import { cx, fmt, inr, pct } from '../lib/format';
import { EASE, Panel, Segmented } from '../ui/primitives';
import { notify } from '../shell/Toasts';
import type { Employee } from '../sim/types';

const REQ: Record<Employee['role'], number> = { Operator: 20, Setter: 3, 'QC inspector': 3, Maintenance: 3, 'Tool room': 2, Supervisor: 2 };

export default function People() {
  const w = useWorld();
  const nav = useNavigate();
  const [shift, setShift] = useState<'A' | 'B' | 'C'>(shiftOf(w.t));
  const emps = w.employees.filter((e) => e.shift === shift);
  const roles = Object.keys(REQ) as Employee['role'][];
  const present = emps.filter((e) => e.present).length;
  const late = emps.filter((e) => e.late).length;
  const contract = emps.filter((e) => e.contract).length;
  const shortOps = REQ.Operator - emps.filter((e) => e.role === 'Operator' && e.present).length;
  const ops = w.employees
    .filter((e) => e.shift === 'A' && e.machineId)
    .map((e) => {
      const m = w.machine[e.machineId!];
      const k = machineKpis(w, m);
      const norm = k.target ? (k.good / k.target) * 100 : 0;
      return { e, m, k, norm };
    })
    .sort((a, b) => b.norm - a.norm);
  const skillOps = emps.filter((e) => e.role !== 'Supervisor').slice(0, 16);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] text-fg3">Manesar U1 · People & shift</div>
          <h1 className="num text-[24px] font-bold leading-9">Right people, right skills, every shift</h1>
          <div className="text-[13px] text-fg3">Who was there, were they enough, were they the right people, and how productive were they</div>
        </div>
        <Segmented<'A' | 'B' | 'C'> options={[{ v: 'A', l: 'Shift A' }, { v: 'B', l: 'Shift B' }, { v: 'C', l: 'Shift C' }]} value={shift} onChange={setShift} />
      </div>
      {shortOps > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-idle/50 bg-idle/10 px-4 py-3 text-[13px]">
          <AlertTriangle size={18} className="text-idle-t" />
          <span className="font-semibold">Shift {shift} short {shortOps} operator{shortOps > 1 ? 's' : ''} and 1 QC inspector</span>
          <span className="text-fg2">· 2 machines will run without a dedicated operator · alert sent 30 min before shift start</span>
          <button className="btn btn-ghost ml-auto !h-8" onClick={() => notify({ tone: 'run', title: 'Overtime requested', body: '2 operators from Shift C · approval sent to plant head' })}>Request overtime</button>
        </motion.div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Present', `${present} / ${emps.length}`, `${late} late`],
          ['Required', fmt(Object.values(REQ).reduce((a, b) => a + b, 0)), 'per shift · all roles'],
          ['Contract', `${Math.round((contract / emps.length) * 100)}%`, `${contract} contract · ${emps.length - contract} permanent`],
          ['Machines per operator', (20 / Math.max(1, 20 - shortOps)).toFixed(2), 'target 1.00'],
          ['Labour cost / shift', inr(emps.length * 8 * 265), `${inr((emps.length * 8 * 265) / 26000)} per good part`],
        ].map(([l, v, s], i) => (
          <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass !rounded-[10px] p-4">
            <div className="eyebrow">{l}</div>
            <div className="num mt-1 text-[20px] font-bold">{v}</div>
            <div className="text-[12px] text-fg3">{s}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title={`Roster · Shift ${shift}`} sub="Required vs rostered vs present">
          <div className="flex flex-col gap-3">
            {roles.map((r, i) => {
              const ros = emps.filter((e) => e.role === r).length;
              const pre = emps.filter((e) => e.role === r && e.present).length;
              const req = REQ[r];
              return (
                <div key={r} className="grid grid-cols-[120px_minmax(0,1fr)_90px] items-center gap-3 text-[13px]">
                  <span className="font-semibold">{r}</span>
                  <div className="relative flex h-6 gap-[2px]">
                    {Array.from({ length: Math.max(req, ros) }).map((_, k) => (
                      <motion.span key={k} initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ delay: i * 0.05 + k * 0.01 }} className={cx('h-full flex-1 rounded-[2px]', k < pre ? 'bg-run' : k < req ? 'pat-unassigned' : 'bg-line2')} title={k < pre ? 'Present' : k < req ? 'Gap' : 'Spare'} />
                    ))}
                  </div>
                  <span className="num text-right" style={{ color: pre < req ? 'rgb(var(--down-t))' : 'rgb(var(--run-t))' }}>
                    {pre} / {req}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-fg3">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-run" />Present</span>
            <span className="inline-flex items-center gap-1.5"><span className="pat-unassigned h-2.5 w-4 rounded-[2px]" />Gap vs required</span>
          </div>
        </Panel>
        <Panel title="Machine assignment · who runs what" sub="Supervisor PWA or badge-in at the machine · gives traceability of who ran which machine when">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {w.unit.MN1.machineIds.map((id) => {
              const m = w.machine[id];
              const op = w.employees.find((e) => e.machineId === id && e.shift === 'A');
              const absent = op && !op.present;
              return (
                <button key={id} onClick={() => (absent ? notify({ tone: 'run', title: `${m.code} reassigned`, body: 'B. Yadav (setter) covers until 14:00' }) : nav(`/machine/${id}`))} className={cx('rounded-[8px] border p-2 text-left text-[12px] transition hover:border-fg3', absent ? 'border-down/50 bg-down/10' : 'border-line/70')}>
                  <div className="num font-semibold">{m.code}</div>
                  <div className={cx('truncate', absent ? 'font-semibold text-down-t' : 'text-fg2')}>{absent ? 'Absent · tap to cover' : op?.name ?? m.operator}</div>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Skills matrix" sub="Levels 0–4 · gaps highlighted · planning respects it" bodyClass="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-[12px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-fg3">Employee</th>
                  {SKILLS.map((s) => (
                    <th key={s} className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-fg3">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skillOps.map((e, i) => (
                  <tr key={e.id} className="border-t border-line/40">
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span className="font-semibold">{e.name}</span> <span className="text-fg3">· {e.role}</span>
                    </td>
                    {e.skills.map((lv, k) => (
                      <td key={k} className="px-1 py-1">
                        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (i * 8 + k) * 0.004, ease: EASE }} className={cx('num mx-auto grid h-7 w-full max-w-[64px] place-items-center rounded-[4px] text-[12px] font-semibold', lv === 0 && 'text-fg4')} style={{ background: lv === 0 ? 'rgb(var(--line) / 0.4)' : `rgb(var(--fg) / ${0.08 + lv * 0.16})`, color: lv >= 3 ? 'rgb(var(--bg))' : undefined }}>
                          {lv}
                        </motion.div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line/60 px-4 py-2 text-[12px] text-fg3">Gap: only 2 people at level ≥ 3 for “Process tuning” on Shift {shift}. Certification expiries: 3 crane licences in 30 days.</div>
        </Panel>
        <Panel title="Operator leaderboard · Shift A" sub="Normalised by mould difficulty (output vs std-cycle target) so it’s fair; DOWN time for non-operator reasons excluded" right={<Medal size={16} className="text-brand" />}>
          <div className="flex flex-col">
            {ops.slice(0, 10).map(({ e, m, k, norm }, i) => (
              <motion.button key={e.id} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} onClick={() => nav(`/machine/${m.id}`)} className="grid grid-cols-[28px_minmax(0,1fr)_64px_56px_56px] items-center gap-2 border-b border-line/40 py-2 text-left text-[13px] hover:bg-panel3/40">
                <span className={cx('num grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold', i < 3 ? 'bg-brand text-ink' : 'bg-panel3')}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{e.name}</span>
                  <span className="block truncate text-[11px] text-fg3">{m.code} · {e.reasonsOnTime}% reasons on time</span>
                </span>
                <span className="num text-right font-semibold">{norm.toFixed(0)}%</span>
                <span className="num text-right text-fg2">{pct(k.oee, 0)}</span>
                <span className="num text-right" style={{ color: k.rej > 3 ? 'rgb(var(--down-t))' : undefined }}>{pct(k.rej)}</span>
              </motion.button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-fg3"><UserCheck size={12} />Columns: normalised output · OEE of assigned machine · reject. Incentive export available monthly.</div>
        </Panel>
      </div>
    </div>
  );
}
