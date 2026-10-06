# Chrae Lab

A collection of small, free tools and games that run entirely in the browser —
no accounts, no server, everything stored on your device. Three sites, built
from this one repo:

- **[fire.chraegames.cloud](https://fire.chraegames.cloud/)** — the FIRE retirement planner and its guides
- **[games.chraegames.cloud](https://games.chraegames.cloud/)** — browser games
- **[tools.chraegames.cloud](https://tools.chraegames.cloud/)** — everyday tools

| Site  | Tool | Live |
|-------|------|------|
| fire  | **FIRE Planner** — retirement / FIRE projection with US federal tax, three account types and a withdrawal optimizer | [fire.chraegames.cloud](https://fire.chraegames.cloud/) |
| fire  | Guides: [Coast FIRE calculator](https://fire.chraegames.cloud/coast-fire-calculator/) · [The 4% rule](https://fire.chraegames.cloud/4-percent-rule/) · [Retirement withdrawal strategy](https://fire.chraegames.cloud/retirement-withdrawal-strategy/) · [How the planner works](https://fire.chraegames.cloud/how-it-works/) | |
| tools | Unit converter (length, weight, volume, area, speed, temperature) | [/unit-converter/](https://tools.chraegames.cloud/unit-converter/) |
| tools | Calculator (basic + scientific, history) | [/calculator/](https://tools.chraegames.cloud/calculator/) |
| tools | TV buying guide — 2026 panel technologies with animated diagrams, brand-name decoder, comparison, "help me choose" | [/tv-guide/](https://tools.chraegames.cloud/tv-guide/) · [Technologies](https://tools.chraegames.cloud/tv-guide/technologies/) · [Brands](https://tools.chraegames.cloud/tv-guide/brands/) · [Decoder](https://tools.chraegames.cloud/tv-guide/decoder/) · [Compare](https://tools.chraegames.cloud/tv-guide/compare/) |
| tools | To-do list (multiple lists, due dates) | [/todo/](https://tools.chraegames.cloud/todo/) |
| games | Sudoku (easy–expert, notes, hints, undo) | [/sudoku/](https://games.chraegames.cloud/sudoku/) |
| games | Bingo caller (75/90/30-ball, flashboard, history, auto-call, voice) | [/bingo/](https://games.chraegames.cloud/bingo/) |
| games | Go — two-player online Go (quick match or room code, 9×9/13×13/19×19, peer-to-peer over WebRTC) | [/go/](https://games.chraegames.cloud/go/) |
| games | Magic Tower 魔塔 — seeded puzzle-RPG, ten loops × 99 generated floors | [/magic-tower/](https://games.chraegames.cloud/magic-tower/) |
| games | City — 3D SimCity-style city builder with a per-tile statistical simulation | [/city/](https://games.chraegames.cloud/city/) |

Every page is its own static HTML entry (Vite multi-page, one build per
site); the landing pages and the FIRE content guides are prerendered at build time, and each
tool mounts its own small React root. See `CLAUDE.md` for the architecture
and `DEPLOY.md` for hosting.

## FIRE Planner

A free, browser-only retirement and long-term financial projection tool. Model
income, expenses, investments, taxes, and withdrawals across a customizable
horizon. Everything runs locally; no account, no server, no tracking.

> Educational tool &mdash; not financial, tax, or legal advice.

### What it models

- US federal income tax — **illustrative 2026 Married Filing Jointly brackets only** (not a substitute for tax-prep software)
- Long-term capital gains (2026 MFJ thresholds)
- Brokerage, Roth IRA, and Traditional IRA accounts
- Configurable birth year for the 10% early-withdrawal penalty cutoff
- Brokerage cost basis (only the gain portion of a withdrawal is taxed)
- Inflation on selected expenses
- An LP-based optimizer that picks a tax-efficient withdrawal schedule
- Year-by-year "actuals" overrides that refine the projection

### What it does NOT model

Filing statuses other than MFJ (Single, HoH, MFS), state / local tax, Social
Security, pensions, RMDs, NIIT, Medicare IRMAA, the Roth 5-year rule, return
variability, or sequence-of-returns risk. See the in-app **About** dialog
for details.

### City

A 3D city-building simulation at `/city/` in the SimCity tradition. Zone residential, commercial and industrial land at three densities, lay roads, power lines and pipes, place any of thirty-one facilities (six kinds of power plant, pumps and a treatment plant, landfill, incinerator and recycling, fire and police stations and headquarters, clinics and a hospital, schools, a library and a university, parks, a bus depot, city hall, a stadium and a landmark), set taxes, funding and eight ordinances, and climb nine population milestones that unlock buildings and pay grants. Underneath runs a per-tile statistical model: demand by zone and wealth tier, desirability, land value, air and water pollution, crime, fire risk and spread, power, water and garbage networks, road-distance service coverage, monthly traffic assignment with congestion, and a ledger with loans. Every troubled building shows what it is missing, fourteen data views paint the layers onto the terrain, and a day/night cycle lights the windows. The map, every building and every car are generated from code; the simulation runs in a Web Worker and the city autosaves in your browser.

### Magic Tower 魔塔

A Tower of the Sorcerer / 魔塔 puzzle-RPG at `/magic-tower/`: ten playthroughs of 99 generated floors, deterministic combat with a live damage manual, keys, gems, potions, Breach Stones that punch through floors into sealed vaults, and a blessing after every boss. Every tower is generated from a seed and proven solvable before you play it; saves stay in your browser.

## Local development

```bash
npm install
npm run dev      # FIRE site dev server (also dev:games, dev:tools)
npm test         # unit tests (Vitest)
npm run lint     # ESLint
npm run build    # type-check + all three sites → dist/{fire,games,tools}
```

## Deploying

Each of `dist/fire`, `dist/games` and `dist/tools` is a self-contained static
site for its subdomain. `deploy/nginx.conf` serves all three from one container —
see `DEPLOY.md`. On a generic static host, point each subdomain at its folder.

### Cloudflare Pages

1. Push the repo to GitHub.
2. In the Cloudflare dashboard: **Pages → Create application → Connect to Git**.
3. Build settings: build command `npm run build`, output directory `dist/<site>` — one Pages project per site.
4. Save. Subsequent pushes to `main` auto-deploy.

### Netlify

1. **Add new site → Import an existing project → GitHub**.
2. Build command `npm run build`, publish directory `dist`.

### Vercel

1. **Add New → Project → Import** the GitHub repo.
2. Framework preset: **Vite**. Output directory: `dist`. Build command: `npm run build`.

No environment variables are required. The app is fully client-side &mdash; all
state lives in the visitor&apos;s browser `localStorage`.

## CI

`.github/workflows/ci.yml` runs lint + tests + build on every push and pull
request.

## License

[MIT](LICENSE). The tools are educational — nothing here is financial, tax or legal advice.
