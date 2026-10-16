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

Stack: Vite + React 18 + TypeScript (strict) + Tailwind, three.js via @react-three/fiber / drei / postprocessing, framer-motion, Zustand, lucide-react, Inter + JetBrains Mono self-hosted via @fontsource. HashRouter, so static hosts never 404.

## Deploy

- **Vercel** — import the GitHub repo at vercel.com/new (framework: Vite, build `npm run build`, output `dist`). `vercel.json` is included. Or from a terminal: `npx vercel --prod`.
- **Netlify** — "Add new site → Import from Git"; `netlify.toml` sets build + SPA fallback. Or drag `dist/` onto app.netlify.com/drop.
- **GitHub Pages** — `npm run deploy` (uses `gh-pages`), then enable Pages on the `gh-pages` branch. `base: './'` makes it work under any sub-path.
- **Anywhere / email** — send `dist-single/index.html`; it opens by double-click.

## Screens (all routes work)

| Route | Screen |
|---|---|
| (first load) | Cinematic intro: 3D factory assembles, sign-in (any input), 5 role cards with 3D tilt |
| `/home` | Home — four headline numbers, an orbitable 3D group network (HQ → regions → plant towers: height = output, cap = plan status), a short “needs attention” list and one quiet line per plant |
| `/rollup` | 3D India roll-up — pillars (height = metric, colour = plan status), arcs to customer plants, metric switcher, unit preview |
| `/twin/:unit` | Digital twin — orbitable 3D plant, status halos, DOWN timers, mould-change gantry, heatmap / people / trucks toggles, fly-in panel |
| `/unit/:unit`, `/unit/:unit/timeline` | Unit dashboard — A × P × Q rings, a “where the shift's time went” flow (planned time → running / idle / mould change / down → good parts / slow cycles / rejects), an isometric floor map (Map ↔ Tiles), hourly vs plan, Pareto, shift comparison — and the machine timeline (status bars with ticket-stage patterns) |
| `/machine/:id` | Machine dashboard — 3D machine (heater zones glow by temperature; click a zone), Production / Process (SPC) / Quality / Energy / History |
| `/records` | Production records — weight-vs-tolerance bars, part drawer with process data at that shot, by hour / by machine, manual record |
| `/alerts` | Alert inbox with evidence + timeline + actions; `?tab=rules` rules editor with scope overrides |
| `/breakdowns` | Kanban with drag-and-drop between stages; `?view=phones` live supervisor + technician PWAs |
| `/moulds`, `/mould-setup` | Mould health (shots to PM rings, cavity map block/unblock, SMED timers) and setup queue + 5-step wizard with “Promote” animation |
| `/money`, `/briefing` | CEO money view (₹ waterfall that reconciles to the rupee, a loss flow from loss type to owning team, leaks, dispatch at risk) and morning briefing |
| `/planning` | Gantt with draggable jobs, changeover blocks, Auto-schedule, Capacity & RFQ calculator |
| `/people`, `/energy`, `/dispatch` | Roster/skills/leaderboard · power flow + peak-demand gauge · trucks with number plates + dispatch at risk |
| `/ask` | Ask IMMDATA — scripted streaming answers computed from the live simulator, with charts and links |
| `/mobile` | Four live phone frames (CEO, plant head, supervisor, technician) |
| `/modules` | Modular SaaS: plans + per-module toggles that update the sidebar live; locked modules show an “Unlock” state |
| `/tv` | Shopfloor TV, 1920×1080 scaled, auto-rotating playlist (timeline 1–3, reasons, availability, trucks, production); `?m=<machine>` adds the red single-machine DOWN screen |
| `/tv-ui` | **Shopfloor TV for UI (United Industries)** — the UI “Shopfloor TV v3” design system: Barlow / Barlow Condensed, UI logo, dark header, sized for a 65″ screen at 5–10 m (key numbers ≥ 60 px, labels ≥ 24 px, colour never the only signal). Rotation ≈ 3 min: Timeline 1–3 → OEE summary (this hour + month, A/P/Q, energy kWh/kg, last 12 h, top 3 losses) → Hourly OEE by machine 1–3 (hatched stop hours in the team colour, M/C tags) → Machines worst first (OEE + A/P/Q loss bar) → Reasons → Availability → Trucks (waiting to load → at dock → waiting to unload → left). Truck band on every page. Light/dark, OEE target and truck limits in the settings (gear, top right); landscape 1920×1080 or portrait 1080×1920 (auto, or O). Live from the simulator. Open from the sidebar (“Shopfloor TV for UI”) or the “UI version” button on `/tv` |

## Demo controls cheat sheet

| Key / control | Does |
|---|---|
| **D** | Toggle presenter panel: Break IMM-07 · Spike rejects on IMM-12 · Truck delay · Fix all · speed 1× / 10× / 60× · pause · reset to 11:42 |
| **⌘K / Ctrl+K** or **/** | Search units, machines (IMM-07), moulds (M-1420), parts, tickets, vehicles (HR 55), serials |
| Top bar | Theme (dark / light paper), Calm mode (turns heavy effects off; also follows `prefers-reduced-motion`), alert chime (muted by default), role switcher, Play tour |
| TV mode | ← / → pages · Space pause · T light/dark · Esc exit |

## Guided walkthrough (≈ 3 min, “Play tour”)

A play gate opens first (chapters, optional narration, Play / Skip). Each step dims the screen, cuts out the element being explained with a pulsing orange ring, and places a short callout beside it with a live count-up number. A rail at the top shows every step: click any segment to jump, ← / → to step, Space to pause, **Esc or “Skip tour” to leave at any time**.

Narration is optional and free: it uses the browser's built-in speech engine (Web Speech API), preferring Google voices in Chrome. Steps wait for the sentence to finish; with narration off they advance on a reading-time timer.

| # | Chapter | Step |
|---|---|---|
| 1–3 | Group | Four headline numbers · the 3D plant network · plants sorted behind-plan first |
| 4 | Group | 3D India roll-up |
| 5–6 | Plant | Where every minute of the shift went (time flow) · isometric floor map |
| 7 | Plant | Digital twin |
| 8–12 | A breakdown | IMM-16 trips on a heater fault · alert with evidence · supervisor assigns Maintenance in two taps · technician “I'm on it” · fixed, verified and booked |
| 13 | Machine | 3D machine with heater zones glowing by temperature |
| 14–15 | Money | Who owns every rupee lost (loss flow) · one decision for today |
| 16 | Planning | 30-hour Gantt, auto-schedule runs live |
| 17 | Shopfloor | TV playlist |
| 18 | Explore | Back home, hand-off to free exploration |

## How the numbers stay honest

The simulator (`src/sim`) starts at 06:00, warms up to 11:42 and then ticks every second. Machines change state with seeded probabilities, shots accumulate at the actual cycle, rejects follow per-machine rates, tickets move through stages, trucks arrive and leave. KPIs follow `01_CONTEXT.md §7`: OEE = A × P × Q, roll-ups sum numerators and denominators, plan = standard capacity × 82% (PPC factor), and the ₹ waterfall is value-at-standard − downtime − mould change − speed − rejects = actual, exactly.

## Visual system

Colour and type follow the Lyzr brand system (logos and illustrations not used): warm greyscale from Off-white `#FAFAF9` to Black `#1F2022`, Orange `#FE4B1E` as the single accent (now marker, plan line, active nav, focus), Navy as a supporting data colour. Charts are drawn in ink tints; status hues are muted (sage, ochre, steel, brick) and appear as dots, thin edges and chips rather than large fills. Type: Inter (stand-in for Aeonik, which is licensed) for everything read, JetBrains Mono uppercase for labels and table headers. Light (Off-white) is the default theme; dark uses the Black ramp.

Wherever a number has a shape, it is drawn rather than written: towers for plant output (`src/three/GroupNetwork.tsx`), flows for where time and money went, isometric blocks for the floor, rings for A × P × Q (`src/ui/diagrams.tsx`, `src/ui/charts.tsx`). Text is kept to one line per idea, with generous whitespace and a 13 px base size.
