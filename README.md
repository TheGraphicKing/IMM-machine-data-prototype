# IMMDATA — interactive prototype

Frontend-only, fully clickable prototype of **IMMDATA**, the factory-visibility platform for plastic injection moulding plants (built by AGG Technology). Everything runs in the browser on a deterministic, seeded factory simulator — no backend, no API calls, no keys.

Fictional tenant: **Apex Polymers Group** · 4 organisations · 12 units · 178 machines · 300+ moulds · 424 parts · customers Orion Motors, Nova Appliances, Kestrel Two-Wheelers. The hero unit is **Manesar U1** (20 machines, 2 halls).

## Run

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # dist/ (code-split; 3D scenes lazy-loaded)
npm run build:single   # dist-single/index.html — one self-contained file, works offline / from file://
npm run preview
npm run deploy         # builds and pushes dist/ to a gh-pages branch
```

Stack: Vite + React 18 + TypeScript (strict) + Tailwind, three.js via @react-three/fiber / drei / postprocessing, framer-motion, Zustand, lucide-react, Barlow + Barlow Condensed self-hosted via @fontsource. HashRouter, so static hosts never 404.

## Deploy

- **Vercel** — import the GitHub repo at vercel.com/new (framework: Vite, build `npm run build`, output `dist`). `vercel.json` is included. Or from a terminal: `npx vercel --prod`.
- **Netlify** — "Add new site → Import from Git"; `netlify.toml` sets build + SPA fallback. Or drag `dist/` onto app.netlify.com/drop.
- **GitHub Pages** — `npm run deploy` (uses `gh-pages`), then enable Pages on the `gh-pages` branch. `base: './'` makes it work under any sub-path.
- **Anywhere / email** — send `dist-single/index.html`; it opens by double-click.

## Screens (all routes work)

| Route | Screen |
|---|---|
| (first load) | Cinematic intro: 3D factory assembles, sign-in (any input), 5 role cards with 3D tilt |
| `/home` | Home — greeting, live KPI strip, org sections with unit tiles, live alerts rail; Tiles ↔ hierarchy table |
| `/rollup` | 3D India roll-up — pillars (height = metric, colour = plan status), arcs to customer plants, metric switcher, unit preview |
| `/twin/:unit` | Digital twin — orbitable 3D plant, status halos, DOWN timers, mould-change gantry, heatmap / people / trucks toggles, fly-in panel |
| `/unit/:unit`, `/unit/:unit/timeline` | Unit dashboard (KPIs, hourly vs plan, tiles, Pareto, shift comparison) and machine timeline (status bars with ticket-stage patterns) |
| `/machine/:id` | Machine dashboard — 3D machine (heater zones glow by temperature; click a zone), Production / Process (SPC) / Quality / Energy / History |
| `/records` | Production records — weight-vs-tolerance bars, part drawer with process data at that shot, by hour / by machine, manual record |
| `/alerts` | Alert inbox with evidence + timeline + actions; `?tab=rules` rules editor with scope overrides |
| `/breakdowns` | Kanban with drag-and-drop between stages; `?view=phones` live supervisor + technician PWAs |
| `/moulds`, `/mould-setup` | Mould health (shots to PM rings, cavity map block/unblock, SMED timers) and setup queue + 5-step wizard with “Promote” animation |
| `/money`, `/briefing` | CEO money view (₹ waterfall that reconciles to the rupee, loss by owner, leaks, dispatch at risk) and morning briefing |
| `/planning` | Gantt with draggable jobs, changeover blocks, Auto-schedule, Capacity & RFQ calculator |
| `/people`, `/energy`, `/dispatch` | Roster/skills/leaderboard · power flow + peak-demand gauge · trucks with number plates + dispatch at risk |
| `/ask` | Ask IMMDATA — scripted streaming answers computed from the live simulator, with charts and links |
| `/mobile` | Four live phone frames (CEO, plant head, supervisor, technician) |
| `/modules` | Modular SaaS: plans + per-module toggles that update the sidebar live; locked modules show an “Unlock” state |
| `/tv` | Shopfloor TV, 1920×1080 scaled, auto-rotating playlist (timeline 1–3, reasons, availability, trucks, production); `?m=<machine>` adds the red single-machine DOWN screen |

## Demo controls cheat sheet

| Key / control | Does |
|---|---|
| **D** | Toggle presenter panel: Break IMM-07 · Spike rejects on IMM-12 · Truck delay · Fix all · speed 1× / 10× / 60× · pause · reset to 11:42 |
| **⌘K / Ctrl+K** or **/** | Search units, machines (IMM-07), moulds (M-1420), parts, tickets, vehicles (HR 55), serials |
| Top bar | Theme (dark / light paper), Calm mode (turns heavy effects off; also follows `prefers-reduced-motion`), alert chime (muted by default), role switcher, Play tour |
| TV mode | ← / → pages · Space pause · T light/dark · Esc exit |

## Guided tour (≈ 95 s, “Play tour”)

1. **Home** — every unit live, every number with a comparison.
2. **Digital twin** — Manesar U1 in 3D, machines glow in their status.
3. **A machine goes down** — IMM-16 trips on a heater fault (machine signal is the truth).
4. **Alerts** — critical alert with evidence and timeline.
5. **Two taps to assign** — supervisor PWA sends it to Maintenance with a photo.
6. **“I’m on it”** — technician accepts; repair clock starts.
7. **Fixed and verified** — root cause + spares, production accepts, downtime booked.
8. **Money view** — losses in ₹ by owner; waterfall reconciles.
9. **Morning briefing** — “one decision for today”.
10. **Shopfloor TV** — the whole hall sees it.

## How the numbers stay honest

The simulator (`src/sim`) starts at 06:00, warms up to 11:42 and then ticks every second. Machines change state with seeded probabilities, shots accumulate at the actual cycle, rejects follow per-machine rates, tickets move through stages, trucks arrive and leave. KPIs follow `01_CONTEXT.md §7`: OEE = A × P × Q, roll-ups sum numerators and denominators, plan = standard capacity × 82% (PPC factor), and the ₹ waterfall is value-at-standard − downtime − mould change − speed − rejects = actual, exactly.

Status colours are reserved for status; brand orange is used only for selection, primary actions, the “now” marker and focus.
