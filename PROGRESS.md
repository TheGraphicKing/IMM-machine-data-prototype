# Progress

## Done
- M1–M7 complete: all 21 screens, simulator, motion system, 3D scenes (intro, twin, India map, machine viewer), TV mode, mobile preview, modules page, guided tour, demo controls, dark + light themes, calm mode.
- `npm run build` and `npm run build:single` succeed; TypeScript strict passes; no console errors on any route (checked with Playwright at 1440 and 390).
- Single-file build verified offline from `file://`.

## Known issues / next
- India outline is stylised (≈100 points), not survey-grade.
- Week / month windows on Home and Money blend live data with deterministic history; only the live shift is fully simulated.
- 3D twin lays out any unit, but is tuned for 10–20 machines; phones get a 2D tile fallback.
- Initial JS (without lazy 3D chunks) ≈ 215 KB gzipped; three.js chunk ≈ 176 KB gzipped loads on first 3D screen.
