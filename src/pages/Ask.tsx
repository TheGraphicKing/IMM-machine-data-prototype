import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Send, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSim } from '../sim/store';
import { aggMachines, derive, downtimeByReason, machinesOfUnit, moneyOf, orderRisk } from '../sim/kpi';
import { buildMoney } from './Money';
import { TEAMS } from '../sim/catalog';
import type { World } from '../sim/engine';
import { clock, cx, fmt, inr, pct } from '../lib/format';
import { EASE } from '../ui/primitives';
import { notify } from '../shell/Toasts';

interface Answer {
  text: string;
  chart: { l: string; v: number; c?: string; fmt?: (n: number) => string }[];
  link: { to: string; l: string };
  how: string[];
}

const QS = [
  'Why is Manesar U1 behind plan today?',
  'Which machine is costing us the most right now?',
  'Will the Orion Motors 18:00 truck leave full?',
  'Which mould has the worst reject rate this shift?',
  'Compare the last 4 shifts at Manesar U1',
  'How much have heater faults cost us this month?',
];

function answer(w: World, q: string): Answer {
  const s = q.toLowerCase();
  const basis = useSim.getState().basis;
  const hero = w.unit.MN1;
  const hms = machinesOfUnit(w, hero);
  if (s.includes('behind') || s.includes('why') && s.includes('manesar')) {
    const a = aggMachines(w, hms);
    const d = derive(a);
    const p = downtimeByReason(w, hms);
    const top = p.list.slice(0, 3);
    const down = hms.filter((m) => m.state === 'DOWN');
    return {
      text: `Manesar U1 is at ${pct(d.plan)} of plan to ${clock(w.t)} (${fmt(a.good)} of ${fmt(a.planParts)} good parts), so it is ${d.plan >= 95 ? 'on track' : d.plan >= 88 ? 'at risk' : 'behind'}. Availability is the main gap at ${d.A.toFixed(0)}% — ${Math.round(p.total / 60)} machine-minutes were lost to stops this shift. The top three causes are ${top.map((t) => `${t.label.toLowerCase()} (${Math.round(t.sec / 60)} min)`).join(', ')}. Right now ${down.length} machines are down: ${down.map((m) => `${m.code} (${m.reasonLogged ? m.reason.toLowerCase() : 'no reason logged'})`).join(', ')}. Performance is ${d.P.toFixed(0)}% and quality ${d.Q.toFixed(1)}%, so fixing stops and assigning the unassigned one is the fastest lever.`,
      chart: top.map((t) => ({ l: t.label, v: t.sec / 60, c: t.team === 'unassigned' ? '#B9533F' : TEAMS[t.team]?.color, fmt: (n) => `${Math.round(n)} min` })),
      link: { to: '/unit/MN1', l: 'Open Manesar U1 dashboard' },
      how: ['kpis(scope=unit:MN1, window=shift:A, metrics=[plan, oee, A, P, Q])', 'downtime_pareto(scope=unit:MN1, window=shift:A)', 'machines(state=DOWN, scope=unit:MN1)'],
    };
  }
  if (s.includes('costing') || s.includes('most') || s.includes('leak')) {
    const M = buildMoney(w, basis);
    const l = M.leaks;
    const t = l[0];
    return {
      text: t
        ? `${t.m.code} at ${w.unit[t.m.unitId].name} is the biggest leak right now at ${inr(t.v.value)} — ${t.v.cause}${t.m.state === 'DOWN' ? ` for ${Math.round(t.v.dur / 60)} min` : ''}. Status: ${t.v.owner.toLowerCase()}. The next four are ${l.slice(1).map((x) => `${x.m.code} ${w.unit[x.m.unitId].name} (${inr(x.v.value)})`).join(', ')}. Together the top five are ${inr(l.reduce((a, x) => a + x.v.value, 0))} of today’s ${inr(M.all.lost)} loss.`
        : 'No significant leaks right now · every machine is running near standard.',
      chart: l.map((x) => ({ l: `${x.m.code} ${w.unit[x.m.unitId].name}`, v: x.v.value, c: x.v.color, fmt: (n) => inr(n) })),
      link: { to: t ? `/machine/${t.m.id}` : '/money', l: t ? `Open ${t.m.code}` : 'Open Money view' },
      how: [`money_leaks(scope=corporate, window=today, basis=${basis})`, 'tickets(open=true)'],
    };
  }
  if (s.includes('truck') || s.includes('orion') || s.includes('dispatch')) {
    const o = w.orders.find((x) => x.customer === 'Orion Motors' && x.unitId === 'MN1') ?? w.orders[0];
    const r = orderRisk(w, o);
    const ms = o.machineIds.map((id) => w.machine[id]);
    return {
      text: r.short > 0
        ? `Not yet. The ${o.truck} for ${o.customer} needs ${fmt(o.qty)} ${r.part?.name.toLowerCase()}s. We have ${fmt(o.stock)} in FG stock and project ${fmt(r.projected - o.stock)} more at the live run rate, so it is ${fmt(r.short)} short (${inr(r.value)} sales value). ${ms.filter((m) => m.state !== 'RUN').map((m) => `${m.code} is ${m.state === 'DOWN' ? 'down' : m.state.toLowerCase()} (${m.reason.toLowerCase()})`).join('; ') || 'Both machines are running but below rate'}. Getting ${ms[0].code} back within 30 min closes most of the gap.`
        : `Yes. The ${o.truck} needs ${fmt(o.qty)}; stock ${fmt(o.stock)} plus projected ${fmt(r.projected - o.stock)} covers it with ${fmt(-r.short + (r.projected - o.qty))} to spare.`,
      chart: [
        { l: 'FG stock', v: o.stock, c: '#A8A298', fmt },
        { l: 'Projected output', v: r.projected - o.stock, c: '#7DB08F', fmt },
        { l: 'Shortfall', v: r.short, c: '#E0826B', fmt },
      ],
      link: { to: '/dispatch', l: 'Open Dispatch & Gate' },
      how: [`orders(customer=Orion Motors, unit=MN1, due≤18:00)`, `run_rate(machines=[${o.machineIds.join(', ')}])`, 'fg_stock(part)'],
    };
  }
  if (s.includes('mould') || s.includes('reject')) {
    const list = w.machines.filter((m) => m.parts > 200).map((m) => ({ m, r: (m.bad / m.parts) * 100 })).sort((a, b) => b.r - a.r).slice(0, 5);
    const t = list[0];
    const md = w.mould[t.m.mouldId];
    return {
      text: `Mould ${md.id} (${md.name}) on ${t.m.code}, ${w.unit[t.m.unitId].name}, has the worst reject rate this shift at ${pct(t.r)} — ${fmt(t.m.bad)} NOT OK parts against a 3.0% limit. Most are ${t.m.hot ? 'heavy parts (flash) as barrel zone 4 runs hot' : 'light parts (short shots), consistent with low cushion'}. ${list.slice(1, 3).map((x) => `${x.m.mouldId} on ${x.m.code} is next at ${pct(x.r)}`).join('; ')}.`,
      chart: list.map((x) => ({ l: `${x.m.mouldId} · ${x.m.code}`, v: x.r, c: x.r > 3 ? '#E0826B' : '#A8A298', fmt: (n) => pct(n) })),
      link: { to: `/machine/${t.m.id}`, l: `Open ${t.m.code} quality` },
      how: ['records(window=shift:A, group_by=mould, metric=reject_rate)', 'process_params(machine, window=last 60 shots)'],
    };
  }
  if (s.includes('shift') || s.includes('compare')) {
    const a = aggMachines(w, hms);
    const d = derive(a);
    const prev = w.prevShifts.MN1 ?? [];
    const rows = [{ label: 'Shift A today (live)', out: a.good, oee: d.oee, rej: d.rej }, ...prev.slice(0, 3)];
    return {
      text: `Live Shift A is at ${pct(d.oee)} OEE with ${fmt(a.good)} good parts so far (${pct(d.rej)} reject). ${prev.map((p) => `${p.label}: ${pct(p.oee)} OEE, ${fmt(p.out)} parts, ${pct(p.rej)} reject`).join('; ')}. Today’s shift is pacing ${d.oee < (prev[0]?.oee ?? 0) ? 'below' : 'above'} last night, mainly because of the heater and water-leak stops on IMM-07 and IMM-02.`,
      chart: rows.map((r) => ({ l: r.label, v: r.oee, c: r.label.includes('live') ? '#FE4B1E' : '#A8A298', fmt: (n) => pct(n) })),
      link: { to: '/unit/MN1', l: 'Open shift comparison' },
      how: ['kpis(scope=unit:MN1, window=shift:A..C, metrics=[oee, good, reject])'],
    };
  }
  if (s.includes('heater')) {
    const M = buildMoney(w, basis);
    const mtdK = M.mtd / Math.max(1, M.all.lost);
    const heater = (M.all.byOwner.maintenance ?? 0) * mtdK * 0.45;
    return {
      text: `Heater-band and thermocouple failures have cost about ${inr(heater)} this month across 4 units, almost all on 450 T machines in Hall B. Median repair time is 41 min and 38% of those stops waited more than 10 min for a team. A preventive heater check on every 450 T machine costs about ₹1.8 L and would pay back in under a month at this rate.`,
      chart: M.past.slice(-7).map((v, i) => ({ l: `${w.day - 7 + i} Oct`, v: v * 0.09, c: '#C47A55', fmt: (n) => inr(n) })),
      link: { to: '/briefing', l: 'Open morning briefing' },
      how: ['tickets(root_cause in [MM-04, MM-07], window=month)', `money(owner=maintenance, window=mtd, basis=${basis})`],
    };
  }
  const all = derive(aggMachines(w, w.machines));
  const m = moneyOf(w, w.machines, basis);
  return {
    text: `I can answer questions about output, OEE, downtime, quality, money, moulds and dispatch for any scope. Right now the group is at ${pct(all.plan)} of plan with ${pct(all.oee)} OEE and ${inr(m.lost)} lost today. Try one of the suggested questions below.`,
    chart: [],
    link: { to: '/home', l: 'Open Home' },
    how: ['kpis(scope=corporate, window=today)'],
  };
}

interface Msg {
  id: number;
  q: string;
  a: Answer;
}

export default function Ask() {
  const [sp] = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const ask = (q: string) => {
    const w = useSim.getState().world;
    setMsgs((m) => [...m, { id: Date.now(), q, a: answer(w, q) }]);
    setInput('');
  };
  useEffect(() => {
    const q = sp.get('q');
    if (q === 'heater') ask(QS[5]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [msgs.length]);

  return (
    <div className="mx-auto flex h-full max-w-[980px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-brand/15 text-brand">
          <Sparkles size={22} />
        </div>
        <div>
          <h1 className="num text-[30px] font-bold leading-9">Ask IMMDATA</h1>
          <div className="text-[13px] text-fg3">Grounded answers from your live factory data · cites scope and window · never invents numbers</div>
        </div>
      </div>
      <div className="flex min-h-[50vh] flex-col gap-5">
        {msgs.length === 0 && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {QS.map((q, i) => (
              <motion.button key={q} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease: EASE }} whileHover={{ y: -2 }} onClick={() => ask(q)} className="glass flex items-center justify-between gap-3 !rounded-[12px] p-4 text-left text-[14px] font-semibold">
                {q}
                <ArrowRight size={16} className="shrink-0 text-brand" />
              </motion.button>
            ))}
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className="flex flex-col gap-3">
            <div className="ml-auto max-w-[80%] rounded-[14px] rounded-br-[4px] bg-fg px-4 py-2.5 text-[14px] font-medium text-bg">{m.q}</div>
            <Stream a={m.a} />
          </div>
        ))}
        <div ref={end} />
      </div>
      {msgs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {QS.filter((q) => !msgs.some((m) => m.q === q)).slice(0, 4).map((q) => (
            <button key={q} className="chip" onClick={() => ask(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        className="glass sticky bottom-3 flex items-center gap-2 !rounded-[14px] p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) ask(input.trim());
        }}
      >
        <input className="h-11 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-fg4" placeholder="Ask about output, downtime, money, moulds, trucks…" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Ask a question" />
        <button className="btn btn-primary !h-10" type="submit">
          <Send size={15} />
          Ask
        </button>
      </form>
    </div>
  );
}

function Stream({ a }: { a: Answer }) {
  const calm = useSim((s) => s.calm);
  const [n, setN] = useState(calm ? a.text.length : 0);
  const [how, setHow] = useState(false);
  const [fb, setFb] = useState<null | 'up' | 'down'>(null);
  useEffect(() => {
    if (n >= a.text.length) return;
    const id = setTimeout(() => setN((x) => Math.min(a.text.length, x + 5)), 16);
    return () => clearTimeout(id);
  }, [n, a.text.length]);
  const done = n >= a.text.length;
  const max = Math.max(1, ...a.chart.map((c) => c.v));
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass flex max-w-[92%] flex-col gap-3 !rounded-[14px] !rounded-bl-[4px] p-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-brand">
        <Sparkles size={14} />
        IMMDATA
        {!done && <span className="h-1.5 w-1.5 animate-blink rounded-full bg-brand" />}
      </div>
      <p className="text-[15px] leading-[23px]">
        {a.text.slice(0, n)}
        {!done && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-blink bg-brand" />}
      </p>
      <AnimatePresence>
        {done && a.chart.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-col gap-1.5 rounded-[10px] bg-panel2/60 p-3">
            {a.chart.map((c, i) => (
              <div key={c.l + i} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_80px] items-center gap-3 text-[12px]">
                <span className="truncate text-fg2">{c.l}</span>
                <div className="h-2.5 overflow-hidden rounded-[2px] bg-line/50">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(c.v / max) * 100}%` }} transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }} className={cx('h-full rounded-[2px]')} style={{ background: c.c ?? 'rgb(var(--fg2))' }} />
                </div>
                <span className="num text-right font-semibold">{c.fmt ? c.fmt(c.v) : fmt(c.v)}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {done && (
        <div className="flex flex-wrap items-center gap-3">
          <Link to={a.link.to} className="btn btn-primary !h-8">
            {a.link.l} <ArrowRight size={14} />
          </Link>
          <button className="flex items-center gap-1 text-[12px] text-fg3 hover:text-fg" onClick={() => setHow((v) => !v)}>
            How I got this <ChevronDown size={12} className={cx('transition', how && 'rotate-180')} />
          </button>
          <span className="ml-auto flex gap-1">
            {(['up', 'down'] as const).map((k) => (
              <button key={k} aria-label={k === 'up' ? 'Helpful' : 'Not helpful'} onClick={() => (setFb(k), notify({ tone: 'info', title: 'Thanks for the feedback', body: 'Used to improve answers for Apex Polymers only' }))} className={cx('grid h-7 w-7 place-items-center rounded', fb === k ? 'bg-brand/15 text-brand' : 'text-fg3 hover:text-fg')}>
                {k === 'up' ? <ThumbsUp size={13} /> : <ThumbsDown size={13} />}
              </button>
            ))}
          </span>
        </div>
      )}
      {how && (
        <div className="rounded-[8px] border border-line/60 p-2.5 font-mono text-[11px] text-fg3">
          {a.how.map((h) => (
            <div key={h}>→ {h}</div>
          ))}
          <div className="mt-1 font-ui">Confidence: high · data live to {clock(useSim.getState().world.t)}</div>
        </div>
      )}
    </motion.div>
  );
}

