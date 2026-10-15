import { AnimatePresence, motion } from 'framer-motion';
import { BellOff, Check, ChevronUp, ClipboardList, ExternalLink, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWorld } from '../sim/store';
import { ackAlert, escalateAlert, resolveAlert, snoozeAlert } from '../sim/actions';
import { machineKpis } from '../sim/kpi';
import { SHIFT_LEN, TEAMS, shiftStartOf } from '../sim/catalog';
import { clock, cx, fmt, timer } from '../lib/format';
import { EASE, Panel, Segmented, StageBadge, TimelineBar } from '../ui/primitives';
import { LineChart } from '../ui/charts';
import LogReason from '../ui/LogReason';
import { notify } from '../shell/Toasts';
import type { Alert, AlertType, Severity } from '../sim/types';

const SEV: Record<Severity, { label: string; v: string }> = { critical: { label: 'CRITICAL', v: 'down' }, warning: { label: 'WARNING', v: 'idle' }, info: { label: 'INFO', v: 'mould' } };

export default function Alerts() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'rules' ? 'rules' : 'inbox';
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="num text-[24px] font-bold leading-9">{tab === 'inbox' ? 'Alerts' : 'Alert rules'}</h1>
          <div className="text-[13px] text-fg3">{tab === 'inbox' ? 'Open, acknowledged and resolved alerts with evidence, timeline and actions' : 'One rule per alert type · corporate default, overridable per org or unit'}</div>
        </div>
        <Segmented<'inbox' | 'rules'> options={[{ v: 'inbox', l: 'Inbox' }, { v: 'rules', l: 'Rules (admin)' }]} value={tab} onChange={(v) => setSp(v === 'rules' ? { tab: 'rules' } : {})} />
      </div>
      {tab === 'inbox' ? <Inbox /> : <Rules />}
    </div>
  );
}

function Inbox() {
  const w = useWorld();
  const nav = useNavigate();
  const [status, setStatus] = useState<'open' | 'ack' | 'resolved'>('open');
  const [type, setType] = useState<AlertType | 'All'>('All');
  const [unit, setUnit] = useState('all');
  const [selId, setSelId] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);
  const inScope = w.alerts.filter((a) => unit === 'all' || a.unitId === unit);
  const byStatus = inScope.filter((a) => a.status === status);
  const types = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of byStatus) m.set(a.type, (m.get(a.type) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [byStatus]);
  const list = byStatus.filter((a) => type === 'All' || a.type === type).sort((a, b) => (a.severity === b.severity ? b.t - a.t : a.severity === 'critical' ? -1 : b.severity === 'critical' ? 1 : a.severity === 'warning' ? -1 : 1));
  const sel = list.find((a) => a.id === selId) ?? list[0];
  const counts = { open: inScope.filter((a) => a.status === 'open').length, ack: inScope.filter((a) => a.status === 'ack').length, resolved: inScope.filter((a) => a.status === 'resolved').length };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_520px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<'open' | 'ack' | 'resolved'> options={[{ v: 'open', l: `Open ${counts.open}` }, { v: 'ack', l: `Acknowledged ${counts.ack}` }, { v: 'resolved', l: `Resolved today ${counts.resolved}` }]} value={status} onChange={(v) => (setStatus(v), setSelId(null))} />
          <select className="input !h-9 !w-auto !text-[13px]" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Scope">
            <option value="all">All units</option>
            {w.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={cx('chip', type === 'All' && 'chip-on')} onClick={() => setType('All')}>All · {byStatus.length}</button>
          {types.map(([t, n]) => (
            <button key={t} className={cx('chip', type === t && 'chip-on')} onClick={() => setType(t as AlertType)}>
              {t} · {n}
            </button>
          ))}
        </div>
        <div className="glass flex flex-col overflow-hidden !rounded-[12px]">
          <AnimatePresence initial={false}>
            {list.slice(0, 40).map((a) => (
              <motion.button
                key={a.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                onClick={() => setSelId(a.id)}
                className={cx('flex items-center gap-3 border-b border-line/50 px-3 py-3 text-left transition', sel?.id === a.id ? 'bg-brand/10' : 'hover:bg-panel3/40')}
              >
                <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: `rgb(var(--${SEV[a.severity].v}))` }} />
                <span className="w-[76px] shrink-0 rounded-[3px] px-1.5 py-0.5 text-center text-[10px] font-bold tracking-[0.06em]" style={{ background: `rgb(var(--${SEV[a.severity].v}) / 0.16)`, color: `rgb(var(--${SEV[a.severity].v}-t))` }}>
                  {SEV[a.severity].label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{a.title}</span>
                  <span className="block truncate text-[12px] text-fg3">
                    {w.org[w.unit[a.unitId].orgId].name} / {w.unit[a.unitId].name}
                    {a.machineId && ` / ${w.machine[a.machineId].code}`} · {a.type}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="num text-[13px] font-semibold">{clock(a.t)}</span>
                  <span className={cx('text-[11px]', a.status === 'ack' ? 'text-run-t' : a.escalated ? 'text-down-t' : 'text-fg3')}>{a.status === 'ack' ? `Ack · ${a.ackBy}` : a.status === 'resolved' ? 'Resolved' : a.escalated ? 'Open · escalated' : 'Open'}</span>
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
          {list.length === 0 && <div className="py-12 text-center text-[13px] text-fg3">All clear · No {status === 'open' ? 'open' : status === 'ack' ? 'acknowledged' : 'resolved'} alerts in this scope</div>}
        </div>
      </div>
      <AnimatePresence mode="wait">{sel && <Detail key={sel.id} a={sel} onLog={(id) => setLogFor(id)} onOpen={(p) => nav(p)} />}</AnimatePresence>
      {logFor && <LogReason machineId={logFor} open onClose={() => setLogFor(null)} />}
    </div>
  );
}

function Detail({ a, onLog, onOpen }: { a: Alert; onLog: (id: string) => void; onOpen: (p: string) => void }) {
  const w = useWorld();
  const m = a.machineId ? w.machine[a.machineId] : undefined;
  const u = w.unit[a.unitId];
  const k = m ? machineKpis(w, m) : null;
  const tk = m?.ticketId ? w.ticket[m.ticketId] : undefined;
  const stoppedFor = m && m.state === 'DOWN' ? w.t - m.since : 0;
  const lost = m && k ? (stoppedFor / k.std) * k.cavTotal : 0;
  const s0 = shiftStartOf(w.t);
  return (
    <motion.div data-tour="alert-detail" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.3, ease: EASE }} className="glass flex h-fit flex-col gap-4 !rounded-[12px] p-5 xl:sticky xl:top-4">
      <div className="flex items-center gap-2">
        <span className="rounded-[3px] px-2 py-0.5 text-[11px] font-bold tracking-[0.06em]" style={{ background: `rgb(var(--${SEV[a.severity].v}) / 0.16)`, color: `rgb(var(--${SEV[a.severity].v}-t))` }}>{SEV[a.severity].label}</span>
        <span className="text-[12px] text-fg3">{a.type} · {a.id}</span>
      </div>
      <div>
        <h2 className="num text-[19px] font-semibold leading-7">{a.title}</h2>
        <div className="mt-1 text-[13px] text-fg3">
          {w.org[u.orgId].name} / {u.name}
          {m && ` / ${m.hall} · ${m.make} ${m.tonnage} T`}
        </div>
      </div>
      {m && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[8px] bg-panel2/70 p-3">
            <div className="eyebrow">{m.state === 'DOWN' ? 'Stopped' : 'State'}</div>
            <div className="num text-[19px] font-bold" style={{ color: m.state === 'DOWN' ? 'rgb(var(--down-t))' : 'rgb(var(--run-t))' }}>{m.state === 'DOWN' ? timer(stoppedFor) : 'Running'}</div>
          </div>
          <div className="rounded-[8px] bg-panel2/70 p-3">
            <div className="eyebrow">Parts lost</div>
            <div className="num text-[19px] font-bold">≈ {fmt(lost)}</div>
          </div>
          <div className="rounded-[8px] bg-panel2/70 p-3">
            <div className="eyebrow">Reason</div>
            <div className="truncate text-[13.5px] font-semibold">{m.state === 'DOWN' ? (m.reasonLogged ? m.reason : 'Not logged') : '—'}</div>
          </div>
        </div>
      )}
      {m && (
        <div>
          <div className="eyebrow mb-2">Evidence</div>
          {a.type === 'Cycle time drift' || a.type === 'Process param' ? (
            <LineChart data={m.cycleHist.slice(-60).length > 2 ? m.cycleHist.slice(-60) : [k!.std, k!.ct]} height={120} refs={[{ v: k!.std, label: 'std', tone: 'rgb(var(--run-t))' }, { v: k!.std * 1.05, label: '+5%', tone: 'rgb(var(--down-t))' }]} />
          ) : (
            <>
              <TimelineBar segs={m.timeline} t0={s0} t1={s0 + SHIFT_LEN} now={w.t} h={22} />
              <div className="num mt-1 flex justify-between text-[10px] text-fg3">
                <span>{clock(s0)}</span>
                <span>now {clock(w.t)}</span>
                <span>{clock(s0 + SHIFT_LEN)}</span>
              </div>
            </>
          )}
          {tk && tk.stage !== 'closed' && (
            <div className="mt-2">
              <StageBadge stage={tk.stage} team={tk.team} />
            </div>
          )}
        </div>
      )}
      <div>
        <div className="eyebrow mb-2">Timeline</div>
        <div className="relative flex flex-col gap-2.5 pl-4">
          <div className="absolute bottom-1 left-[5px] top-1 w-px bg-line" />
          {[...a.timeline, ...(tk ? tk.history.filter((h) => h.t > a.t).map((h) => ({ t: h.t, tone: 'muted' as const, msg: `${h.by}: ${h.note || h.stage}` })) : [])]
            .sort((x, y) => x.t - y.t)
            .map((e, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex gap-3 text-[13px]">
                <span className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-panel" style={{ background: e.tone === 'muted' ? 'rgb(var(--fg4))' : `rgb(var(--${e.tone}))` }} />
                <span className="num w-11 shrink-0 font-semibold text-fg2">{clock(e.t)}</span>
                <span>{e.msg}</span>
              </motion.div>
            ))}
        </div>
      </div>
      <div className="rounded-[8px] border border-line/60 p-3 text-[12px]">
        <span className="eyebrow">Notified</span>
        <div className="mt-1 text-fg2">{a.notified}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={a.status !== 'open'} style={{ opacity: a.status !== 'open' ? 0.5 : 1 }} onClick={() => ackAlert(a.id)}>
          <Check size={14} />Acknowledge
        </button>
        {m && (
          <button className="btn btn-ghost" onClick={() => (tk ? onOpen(`/breakdowns?t=${tk.id}`) : notify({ tone: 'info', title: 'Assigned to Supervisor R. Tomar' }))}>
            <UserPlus size={14} />Assign
          </button>
        )}
        {m && (
          <button className="btn btn-ghost" onClick={() => onLog(m.id)}>
            <ClipboardList size={14} />Log reason
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => escalateAlert(a.id)}>
          <ChevronUp size={14} />Escalate
        </button>
        <button className="btn btn-ghost" onClick={() => snoozeAlert(a.id, 30)}>
          <BellOff size={14} />Snooze 30 min
        </button>
        {m && (
          <button className="btn btn-ghost" onClick={() => onOpen(`/machine/${m.id}`)}>
            <ExternalLink size={14} />Open machine
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => resolveAlert(a.id)}>Resolve</button>
      </div>
    </motion.div>
  );
}

interface Rule {
  on: boolean;
  l: string;
  src: string;
  pre: string;
  val: string;
  post: string;
  sev: Severity;
  who: string;
  ch: string[];
  esc: string;
}
const DEFAULT_RULES: Rule[] = [
  { on: true, l: 'Machine stopped', src: 'Status from OPC UA', pre: 'stopped longer than', val: '15 min', post: '', sev: 'critical', who: 'Supervisor, Maintenance', ch: ['App', 'SMS', 'TV'], esc: 'Unit head at 30 min' },
  { on: true, l: 'Cycle time drift', src: 'Actual vs mould standard', pre: 'avg of 20 shots >', val: '+5%', post: 'over std', sev: 'warning', who: 'Supervisor, Process eng.', ch: ['App'], esc: 'Unit head at 60 min' },
  { on: true, l: 'Reject rate', src: 'Production records', pre: 'last 60 min >', val: '3.0%', post: '', sev: 'critical', who: 'Quality, Supervisor', ch: ['App', 'Email'], esc: 'Unit head at 30 min' },
  { on: true, l: 'Part weight out of tolerance', src: 'Weight vs mould threshold', pre: 'consecutive parts ≥', val: '3', post: '', sev: 'warning', who: 'Quality inspector', ch: ['App', 'TV'], esc: '—' },
  { on: true, l: 'Process parameter out of range', src: 'Per-parameter limits', pre: 'outside limit for', val: '10 shots', post: '', sev: 'warning', who: 'Process engineer', ch: ['App'], esc: 'Supervisor at 30 min' },
  { on: true, l: 'Mould maintenance due', src: 'Shot counter', pre: 'remaining shots ≤', val: '5,000', post: '', sev: 'info', who: 'Tool room', ch: ['App', 'Email'], esc: '—' },
  { on: false, l: 'Behind hourly target', src: 'Output vs hourly plan', pre: 'hour closes below', val: '90%', post: 'of plan', sev: 'warning', who: 'Supervisor, Unit head', ch: ['App'], esc: 'Org head daily digest' },
  { on: true, l: 'Truck waiting', src: 'Gate entry', pre: 'inside longer than', val: '60 min', post: '', sev: 'warning', who: 'Dispatch, Unit head', ch: ['App', 'WhatsApp'], esc: 'Unit head at 90 min' },
  { on: true, l: 'Data gap', src: 'Gateway heartbeat', pre: 'no data for', val: '5 min', post: '', sev: 'critical', who: 'Sys admin, Maintenance', ch: ['App', 'Email'], esc: 'AGG support at 30 min' },
];
const CHANNELS = ['App', 'SMS', 'Email', 'WhatsApp', 'TV'];

function Rules() {
  const w = useWorld();
  const [scope, setScope] = useState('corp');
  const [rules, setRules] = useState<Record<string, Rule[]>>({ corp: DEFAULT_RULES });
  const cur = rules[scope] ?? rules.corp;
  const edit = (i: number, p: Partial<Rule>) => setRules((r) => ({ ...r, [scope]: (r[scope] ?? r.corp).map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  const overridden = (i: number) => scope !== 'corp' && rules[scope] && JSON.stringify(rules[scope][i]) !== JSON.stringify(rules.corp[i]);
  return (
    <Panel
      title="Editing rules for"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <select className="input !h-8 !w-auto !text-[13px]" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Rule scope">
            <option value="corp">Corporate default</option>
            {w.orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name} (org override)</option>
            ))}
            {w.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name} (unit override)</option>
            ))}
          </select>
          <button className="btn btn-primary !h-8" onClick={() => notify({ tone: 'run', title: 'Rules saved', body: 'Applied within 1 min · every alert stores the rule version that fired it' })}>
            Save changes
          </button>
        </div>
      }
      bodyClass="!p-0"
    >
      <div className="overflow-x-auto">
        <table className="tbl w-full min-w-[1100px] text-[13px]">
          <thead>
            <tr>
              <th>On</th>
              <th>Alert</th>
              <th>Trigger when</th>
              <th>Severity</th>
              <th>Notify</th>
              <th>Channels</th>
              <th>Escalate</th>
            </tr>
          </thead>
          <tbody>
            {cur.map((r, i) => (
              <tr key={r.l} className={cx(!r.on && 'opacity-55')}>
                <td>
                  <button onClick={() => edit(i, { on: !r.on })} className={cx('relative h-5 w-9 rounded-full transition', r.on ? 'bg-run' : 'bg-line2')} aria-label={`Toggle ${r.l}`} aria-pressed={r.on}>
                    <motion.span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow" animate={{ left: r.on ? 18 : 2 }} transition={{ duration: 0.2 }} />
                  </button>
                </td>
                <td className="!h-auto py-2">
                  <div className="font-semibold">
                    {r.l} {overridden(i) && <span className="ml-1 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">OVERRIDE</span>}
                  </div>
                  <div className="text-[11px] text-fg3">{r.src}</div>
                </td>
                <td>
                  <span className="text-fg2">{r.pre}</span> <input className="input num !inline-block !h-7 !w-[84px] !px-2 font-semibold" value={r.val} onChange={(e) => edit(i, { val: e.target.value })} aria-label={`${r.l} threshold`} /> <span className="text-fg2">{r.post}</span>
                </td>
                <td>
                  <select className="input !h-7 !w-auto !px-2 !text-[12px]" value={r.sev} onChange={(e) => edit(i, { sev: e.target.value as Severity })} style={{ color: `rgb(var(--${SEV[r.sev].v}-t))` }}>
                    <option value="critical">CRITICAL</option>
                    <option value="warning">WARNING</option>
                    <option value="info">INFO</option>
                  </select>
                </td>
                <td className="text-fg2">{r.who}</td>
                <td>
                  <div className="flex gap-1">
                    {CHANNELS.map((c) => (
                      <button key={c} onClick={() => edit(i, { ch: r.ch.includes(c) ? r.ch.filter((x) => x !== c) : [...r.ch, c] })} className={cx('rounded px-1.5 py-0.5 text-[11px] font-semibold transition', r.ch.includes(c) ? 'bg-fg text-bg' : 'border border-line2 text-fg3')}>
                        {c}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="text-fg2">
                  {r.esc}
                  {overridden(i) && (
                    <button className="ml-2 text-[11px] font-semibold text-brand hover:underline" onClick={() => setRules((x) => ({ ...x, [scope]: (x[scope] ?? x.corp).map((y, j) => (j === i ? x.corp[i] : y)) }))}>
                      Reset to default
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line/60 px-4 py-3 text-[12px] text-fg3">
        Orgs and units inherit the corporate default unless they override a rule. Overrides are marked on the rule. Quiet hours 22:00–06:00 route to on-shift roster only. Daily digest at 08:00 for unit and org heads. Team colours: {Object.values(TEAMS).slice(0, 6).map((t) => t.label).join(' · ')}.
      </div>
    </Panel>
  );
}
