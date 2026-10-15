// en-IN conventions: lakh/crore grouping, ₹ with L / Cr, 24 h time, British spelling in copy.

const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmt = (n: number) => nf0.format(Math.round(n));
export const fmt1 = (n: number) => nf1.format(n);
export const pct = (n: number, d = 1) => `${(Number.isFinite(n) ? n : 0).toFixed(d)}%`;

/** ₹ summary: ₹7.6 L, ₹2.04 Cr, ₹48,200 */
export function inr(n: number, opts: { compact?: boolean } = {}) {
  const compact = opts.compact ?? true;
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (!compact) return `${sign}₹${nf0.format(Math.round(a))}`;
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(1)} L`;
  if (a >= 1e3) return `${sign}₹${nf0.format(Math.round(a))}`;
  return `${sign}₹${Math.round(a)}`;
}

/** seconds since shop-floor day start (06:00) -> "11:42" */
export function clock(daySec: number, withSec = false) {
  const t = ((daySec + 6 * 3600) % 86400 + 86400) % 86400;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return withSec ? `${base}:${String(s).padStart(2, '0')}` : base;
}

/** "2h 10m" / "38m" */
export function dur(sec: number) {
  const m = Math.max(0, Math.round(sec / 60));
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  return `${m}m`;
}
/** "2 h 18 m" */
export function durLong(sec: number) {
  const m = Math.max(0, Math.round(sec / 60));
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} m`;
  return `${m} min`;
}
/** live timer "38:12" or "1:04:12" */
export function timer(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type PlanStatus = 'on' | 'risk' | 'behind';
export function planStatus(p: number): PlanStatus {
  if (p >= 95) return 'on';
  if (p >= 88) return 'risk';
  return 'behind';
}
export const planLabel: Record<PlanStatus, string> = { on: 'ON TRACK', risk: 'AT RISK', behind: 'BEHIND' };
export const planVar: Record<PlanStatus, string> = { on: 'run', risk: 'idle', behind: 'down' };

export function cx(...a: (string | number | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}
