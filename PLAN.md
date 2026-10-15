# Build plan

- **Shell**: collapsible dark sidebar (tenant mark + IMMDATA wordmark, scope switcher, module-gated nav), glass top bar (live indicator, shift + time left, sim clock, ⌘K search, alerts, theme, calm, role, tour).
- **Simulator** (`src/sim`): seeded world (orgs/units/machines/moulds/parts/orders/employees/jobs), engine tick (state machine, tickets, alerts, trucks, energy, shift rollover), KPI service (`kpi.ts`), part-record generator, user actions.
- **Motion system**: ease [0.22, 1, 0.36, 1], 250–450 ms; route transitions with scale + blur; shared layout ids (unit title, machine title, ticket cards); number tickers; staggered reveals; cursor spotlight on glass panels.
- **3D**: procedural IMM model (bed, clamp + tie bars, moving platen, barrel + 5 heater bands, hopper, cabinet, light tower, halo); factory floor; India extruded map with pillars + arcs; intro assembly; single-machine viewer. Shared `Stage` caps DPR at 1.75, pauses off-screen, bloom/vignette unless calm.
- **Milestones**: M1 scaffold → M2 intro/home/roll-up → M3 twin/unit/machine → M4 records/alerts/breakdowns/moulds/wizard → M5 money/planning/people/energy/dispatch/AI → M6 TV/mobile/modules/tour/demo/light → M7 polish + builds.
