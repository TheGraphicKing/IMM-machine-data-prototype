import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronsLeft, ChevronsRight, Lock, MonitorPlay } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NAV } from './nav';
import { ROLES, useSim, type Scope } from '../sim/store';
import { useWorld } from '../sim/store';
import { TENANT } from '../sim/catalog';
import { cx } from '../lib/format';
import { EASE } from '../ui/primitives';

export function Wordmark({ className, size = 17 }: { className?: string; size?: number }) {
  return (
    <span className={cx('num font-bold uppercase', className)} style={{ fontSize: size, letterSpacing: '0.06em', lineHeight: 1 }}>
      IMMDATA
    </span>
  );
}
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="6" y="18" width="5" height="8" rx="1.5" fill="currentColor" opacity="0.35" />
      <rect x="13.5" y="12" width="5" height="14" rx="1.5" fill="currentColor" opacity="0.6" />
      <rect x="21" y="6" width="5" height="20" rx="1.5" fill="#FE4B1E" />
    </svg>
  );
}

export function scopeTitle(w: ReturnType<typeof useWorld>, s: Scope) {
  if (s.kind === 'corp') return { title: 'Corporate', sub: `${w.orgs.length} organisations · ${w.units.length} units` };
  if (s.kind === 'org') {
    const o = w.org[s.id];
    return { title: o.name, sub: `${o.unitIds.length} units · ${o.city}` };
  }
  const u = w.unit[s.id];
  return { title: u.name, sub: `${w.org[u.orgId].name} · ${u.machineIds.length} machines` };
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const w = useWorld();
  const loc = useLocation();
  const nav = useNavigate();
  const { modules, scope, role, sidebarCollapsed: collapsed, set } = useSim();
  const [scopeOpen, setScopeOpen] = useState(false);
  const openAlerts = w.alerts.filter((a) => a.status === 'open').length;
  const st = scopeTitle(w, scope);
  const r = ROLES[role];
  const heroUnit = scope.kind === 'unit' ? scope.id : 'MN1';

  const isActive = (match: string | undefined, to: string) => (match ?? to).split('|').some((m) => loc.pathname.startsWith(m));

  const body = (
    <div className={cx('flex h-full flex-col gap-4 bg-panel px-3 py-4 text-fg2', collapsed ? 'w-[72px]' : 'w-[248px]')}>
      <div className={cx('flex items-center gap-2.5 border-b border-line px-1.5 pb-3.5', collapsed && 'justify-center')}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-line bg-panel2 text-[13px] font-bold tracking-wide text-fg" title={TENANT.name}>
          {TENANT.initials}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-1.5 text-fg">
              <Mark size={16} />
              <Wordmark />
            </div>
            <span className="truncate text-[11px] font-medium text-fg3">{TENANT.name}</span>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="relative">
          <button onClick={() => setScopeOpen((v) => !v)} className="flex w-full flex-col gap-1 rounded-md border border-line bg-panel2 px-3 py-2.5 text-left transition hover:border-line2" aria-expanded={scopeOpen}>
            <span className="text-[10px] font-semibold tracking-[0.12em] text-fg3">SCOPE</span>
            <span className="flex items-center justify-between text-[13.5px] font-semibold text-fg">
              {st.title}
              <ChevronDown size={14} className={cx('text-fg3 transition', scopeOpen && 'rotate-180')} />
            </span>
            <span className="text-[12px] text-fg3">{st.sub}</span>
          </button>
          <AnimatePresence>
            {scopeOpen && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: EASE }} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[420px] overflow-y-auto rounded-md border border-line bg-panel p-1.5 shadow-2xl">
                <ScopeRow label="Corporate" sub={`${w.units.length} units`} active={scope.kind === 'corp'} onClick={() => (set({ scope: { kind: 'corp' } }), setScopeOpen(false), nav('/home'))} />
                {w.orgs.map((o) => (
                  <div key={o.id}>
                    <ScopeRow label={o.name} sub={o.city} indent={1} active={scope.kind === 'org' && scope.id === o.id} onClick={() => (set({ scope: { kind: 'org', id: o.id } }), setScopeOpen(false), nav('/home'))} />
                    {o.unitIds.map((uid) => (
                      <ScopeRow key={uid} label={w.unit[uid].name} sub={`${w.unit[uid].machineIds.length} m/c`} indent={2} active={scope.kind === 'unit' && scope.id === uid} onClick={() => (set({ scope: { kind: 'unit', id: uid } }), setScopeOpen(false), nav(`/unit/${uid}`))} />
                    ))}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <nav className="no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1" aria-label="Main">
        {NAV.map((n, i) => {
          const locked = n.mod && !modules[n.mod];
          let to = n.to.replace('/MN1', `/${heroUnit}`);
          if (n.label === 'Machines') to = `/machine/${w.unit[heroUnit].machineIds[4] ?? w.unit[heroUnit].machineIds[0]}`;
          const active = isActive(n.match, n.to);
          const showGroup = n.group && NAV[i - 1]?.group !== n.group && !collapsed;
          const Icon = n.icon;
          return (
            <div key={n.label}>
              {showGroup && <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold tracking-[0.12em] text-fg4">{n.group?.toUpperCase()}</div>}
              <Link
                to={locked ? `/locked/${n.mod}` : to}
                onClick={onClose}
                title={collapsed ? n.label : undefined}
                className={cx('group relative flex h-9 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors', active ? 'bg-panel3 text-fg' : 'text-fg2 hover:bg-panel3 hover:text-fg', locked && 'opacity-50', collapsed && 'justify-center px-0')}
              >
                {active && <motion.span layoutId="nav-active" className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r bg-brand" transition={{ duration: 0.3, ease: EASE }} />}
                <Icon size={17} strokeWidth={1.75} className={cx('shrink-0', active && 'text-brand')} />
                {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
                {!collapsed && locked && <Lock size={13} className="text-fg3" />}
                {!collapsed && n.label === 'Alerts' && openAlerts > 0 && <span className="num rounded-full bg-down px-1.5 text-[11px] font-semibold text-fg">{openAlerts}</span>}
                {collapsed && n.label === 'Alerts' && openAlerts > 0 && <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-down" />}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2.5">
        <Link
          to={modules.tv ? '/tv' : '/locked/tv'}
          className={cx('flex h-10 items-center justify-between rounded-md border border-line px-3 text-[13px] font-medium text-fg2 transition hover:border-brand hover:text-fg', collapsed && 'justify-center px-0')}
          title="Shopfloor TV mode"
        >
          {collapsed ? <MonitorPlay size={17} /> : (<><span className="flex items-center gap-2"><MonitorPlay size={16} />Shopfloor TV mode</span><span>↗</span></>)}
        </Link>
        {!collapsed && (
          <Link to={modules.tv ? '/tv-ui' : '/locked/tv'} className="-mt-1 flex h-8 items-center justify-between rounded-md px-3 text-[12px] text-fg3 transition hover:bg-panel3 hover:text-fg" title="Shopfloor TV for United Industries (UI design)">
            <span className="flex items-center gap-2"><span className="grid h-4 w-6 place-items-center rounded-[4px] bg-[#F26A21] text-[9px] font-bold text-[#15171A]">UI</span>Shopfloor TV for UI</span>
            <span>↗</span>
          </Link>
        )}
        <div className={cx('flex items-center gap-2.5 px-1', collapsed && 'justify-center')}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel3 text-[12px] font-semibold text-fg">{r.ini}</div>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold text-fg">{r.name}</span>
              <span className="truncate text-[11px] text-fg3">{r.title}</span>
            </div>
          )}
          <button className="hidden h-7 w-7 place-items-center rounded text-fg3 hover:bg-panel3 hover:text-fg lg:grid" onClick={() => set({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>
        </div>
        {!collapsed && <div className="px-1 text-[10px] text-fg4">Powered by AGG Technology</div>}
      </div>
    </div>
  );

  return (
    <>
      <motion.aside className="relative z-40 hidden h-full shrink-0 border-r border-line lg:block" animate={{ width: collapsed ? 72 : 248 }} transition={{ duration: 0.3, ease: EASE }}>
        {body}
      </motion.aside>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-[55] bg-black/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.aside className="fixed bottom-0 left-0 top-0 z-[56] lg:hidden" initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ duration: 0.3, ease: EASE }}>
              {body}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ScopeRow({ label, sub, indent = 0, active, onClick }: { label: string; sub: string; indent?: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx('flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[13px] transition', active ? 'bg-panel3 text-fg' : 'text-fg2 hover:bg-panel3')} style={{ paddingLeft: 8 + indent * 14 }}>
      <span className={cx(indent === 0 && 'font-semibold', indent === 1 && 'font-semibold')}>{label}</span>
      <span className="text-[11px] text-fg3">{sub}</span>
    </button>
  );
}
