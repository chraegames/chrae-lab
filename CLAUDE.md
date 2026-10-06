# Repo guide

**Chrae Lab** — small browser-only tools and games, published as **three sites** on subdomains of `chraegames.cloud`: `fire.` (the FIRE planner), `games.` and `tools.`. React 19 + Vite 8 + TypeScript 5.9, no backend, no env vars (except optional Umami analytics in production). All state lives in `localStorage`.

Each site is its own Vite **multi-page** build (`SITE=fire|games|tools`, root `sites/<site>/`, output `dist/<site>/`; `npm run build` does all three):

- **fire.chraegames.cloud** — the FIRE planner (the original and by far the largest tool) at `/`, its SEO content guides beneath it (`/how-it-works/`, …).
- **games.chraegames.cloud** — a games landing at `/` + `/sudoku/`, `/bingo/`, `/go/`, `/magic-tower/`, `/city/`.
- **tools.chraegames.cloud** — a tools landing at `/` + `/unit-converter/`, `/calculator/`, `/todo/`, `/tv-guide/` (a five-page guide with four content chapters beneath it).
- The bare apex `chraegames.cloud` (+ `www.`, `fireplan.`) only 301s old URLs to their new homes and serves `/migrate.html`, the one-time localStorage bridge — see [Split + legacy apex](#split--legacy-apex).

Every page derives from one manifest — see [Site manifest](#site-manifest--srcsitemanifestts).

User-facing: `README.md`. Deploy ops: `DEPLOY.md`. This file is for developers + future Claude sessions and captures the architecture, contracts, and gotchas that aren't obvious from skimming the tree. Most of it is about the FIRE planner because that's where the complexity is.

---

## Big picture

```
sites/fire/index.html              # FIRE planner app entry (src/main.tsx)
sites/fire/<slug>/index.html       # static FIRE content guides (CSS-only entry)
sites/games/index.html             # games landing (prerendered <Landing site="games"/>; src/hub/main.ts)
sites/games/<game>/index.html      # sudoku, bingo, go, magic-tower, city (src/tools/<game>/main.tsx)
sites/tools/index.html             # tools landing (<Landing site="tools"/>)
sites/tools/<tool>/index.html      # unit-converter, calculator, todo, tv-guide (+ tv-guide/<chapter>/)
legacy/migrate.html                # the apex storage bridge (copied to dist/legacy/)
deploy/nginx.conf                  # production nginx: host → dist/<site>, apex 301 map
scripts/
  head.ts                 # buildHeadTags(entry): title/canonical/OG/JSON-LD + THEME_BOOT_SCRIPT
  prerender.tsx           # renderRootForPath(site, path) + per-site sitemap/robots/404/webmanifest (build-time, Node)
src/
  site/
    manifest.ts           # THE page manifest: SITES (origins/names), CATEGORIES, PAGES + helpers
    legacyStorage.ts      # one-time localStorage import from the old apex origin
    prerenderPages.tsx    # manifest path → pure component rendered into #root at build time
    ToolStatic.tsx        # no-JS fallback prerendered for tool pages
    accent.ts             # accentFor(category): per-page --accent* overrides (category accents)
  hub/
    Landing.tsx           # pure landing for games/tools (site prop): hero + CSS motif, per-category cards, Guides band, "More from Chrae Lab", footer
    main.ts               # landing entry: styles + analytics + theme toggle + legacy import (no React)
  tools/<tool>/           # main.tsx (entry) + App.tsx + pure logic .ts + tests
  tools/go/               # online Go: go.ts (rules) + match.ts (pairing/session state machine) + net.ts (Trystero / BroadcastChannel transports) — see "Go"
  tools/magic-tower/      # 魔塔: combat.ts + floorgen.ts (generator) + zonesim.ts/solver.ts/policies.ts (verification) + game.ts (reducer) + sprites/render — see "Magic Tower"
  tools/tv-guide/         # multi-page guide: data.ts/logic.ts/pages.ts (pure) + components/ + pages/*View (pure) + Live.tsx + static.tsx/App.tsx/mount.tsx
  tools/city/             # 3D city sim: sim/ (pure, runs in a Worker) + render/ (three.js, lazy) + ui/ + protocol/save — see "City"
  site/Prose.tsx          # H2/H3/P/UL/LI/A prose primitives shared by every prerendered content tree (ContentLayout re-exports them)
  main.tsx                # FIRE planner entry: boots StrictMode + analytics, mounts <App />
  App.tsx                 # FIRE planner state owner; computes routing; passes handlers down
  engine/                 # pure FIRE simulation (no React, no DOM)
  utils/                  # persistence (all localStorage keys), formatting, analytics, env detection
  hooks/                  # useTheme, useIsMobile, useFocusTrap
  models/types.ts         # the FIRE data model — everything else types against this
  pages/                  # FIRE static SEO content guides (build-time prerendered, no app shell)
    routeMeta.ts          # FIRE's view of the manifest (CONTENT_ROUTES, FIRE_HOME_PATH)
    ContentLayout.tsx     # shared layout + prose primitives (H2/P/UL/LI/A)
    contentStyles.ts      # CSS-only entry so content pages get styling, not the app
    <slug>/Content.tsx    # per-page copy (coast-fire-calculator, 4-percent-rule, …)
  components/
    layout/               # AppBar, ToolShell, ScenarioTabs, Page, NameForm, Logo, SectionHead
    primitives/           # Button, Icon, Input variants, Popover (used everywhere)
    storyline/            # FIRE screen-level components and modals
      Intro / IntroContent (+ introStyles.ts) / Welcome / PartialPlan / PlanForecast / HistoryPage
      AboutModal / ExportModal / ImportModal / ConfirmDialog
      cards/ charts/ drawers/ sections/
  styles/
    global.ts             # the one styles entry (self-hosted fonts + tokens + base) every page imports
    tokens.css            # design tokens via CSS custom properties (light + dark) — "Night Console" palette (Design/v3)
    base.css              # element resets, selection colour, theme-bound declarations
```

Recharts (FIRE charts), Trystero (Go networking) and three.js (City, `import()`ed only on that page) are the runtime deps; Rollup keeps each out of the other pages' bundles. Three Fontsource families are bundled and self-hosted — no Google Fonts request (the site promises nothing is sent to a server): Space Grotesk (`--font-display` + `--font-sans`), Newsreader with its true italic (`--font-serif`, page h1s and the accent clause only) and IBM Plex Mono 400/500 (`--font-mono`: eyebrows, section labels, breadcrumbs, captions, numerics). No CSS framework, no UI kit, no router. There is no React Router — pages are separate HTML entries, and inside the FIRE app routing is just `useState` enums in `App.tsx`.

---

## Site manifest — `src/site/manifest.ts`

Pure data, importable from Node (vite config) and the browser alike. `SITES` holds each site's origin, brand name (`FIRE Planner`, `Chrae Games`, `Chrae Tools`; `BRAND_NAME = 'Chrae Lab'` is the umbrella) and home-link label. `PAGES: SiteEntry[]` lists every URL with `{ slug, site, path, kind: 'hub'|'app'|'content', status: 'live'|'soon', name, tagline, title, description, category?, area?, label?, ogType?, jsonLd?, verification?, about?, updated? }`. **`path` is relative to the entry's site** (so `/` exists once per site); **`slug` is the global id and equals the pre-split path** (`fire-planner/how-it-works`, `sudoku`; landings are `games`/`tools`) — the apex 301 map relies on that, `manifest.test.ts` pins it. Look entries up with `bySlug(slug)` or `byPath(site, path)`; link with `hrefFor(to, fromSite)` (relative on the same site, absolute across sites) and `absoluteUrl(entry)`. `relatedTools` never crosses sites; `otherSites(site)` gives the other two homes for "More from Chrae Lab" links. Category ↔ site: finance → fire, games → games, utilities/productivity → tools. It drives:

- **Vite inputs** — `vite.config.ts` builds `rollupOptions.input` from `livePages(SITE)`; a live entry without `sites/<site>/<path>/index.html` fails `scripts/pages.test.ts` before it fails the build. The HTML keeps root-absolute `/src/...` script URLs; an alias in `vite.config.ts` maps them to the repo's `src/`. Tests use `vitest.config.ts` (repo root), not the per-site Vite config.
- **`<head>` tags** — the `sitePages()` plugin (`vite.config.ts`) calls `buildHeadTags(entry)` (`scripts/head.ts`) for every page in dev and build: `<title>`, description, canonical, OG/Twitter, robots, verification metas, `BreadcrumbList` JSON-LD (from `breadcrumbs(entry)`: site home → parent → page, emitted only when it has 2+ items), **auto-generated `WebApplication` + `FAQPage` for any app with `about`** (FIRE keeps hand-written blocks in `entry.jsonLd` instead), `ItemList` of the site's own apps + a `WebSite` block on each landing, `og:site_name` = the site's name, the anti-flash background style, and the theme boot script. **Per-page `index.html` files therefore contain no `<title>`/meta** — only charset, viewport, icons, `<div id="root"></div>` and the module script.
- **Prerender** — `src/site/prerenderPages.tsx` maps each live path to a pure component; `renderRootForPath` (`scripts/prerender.tsx`) renders it into the literal `<div id="root"></div>` at build time. The plugin throws if that literal is missing. Landings → `Landing site=…`, FIRE home → `IntroContent`, content guides → their `Content`, tools → `ToolStatic`.
- **Per-site files** — `closeBundle` writes `dist/<site>/sitemap.xml` (`buildSitemap(site)`: that site's live pages, priority 1.0 home / 0.9 apps / 0.8 content; `<lastmod>` = `entry.updated`, else build date), `robots.txt`, `404.html` (generated, links home + the other sites) and, for fire, `manifest.webmanifest`. `public/` holds only the shared icons/OG image. Bump `updated` when a page's content materially changes.
- **Tool About/FAQ copy** — `entry.about: ToolAbout { intro, features[], faq[{q,a}], applicationCategory }` is rendered by the pure `src/site/ToolAbout.tsx` in *both* render states: inside `ToolStatic` (build-time, no-JS) and below `<main>` in `ToolShell` (live), so crawlers see identical text either way, and it's the same text the `FAQPage` JSON-LD carries (Google requires parity). `ToolAbout` also renders the "More from Chrae Lab" nav (`relatedTools(entry)`: same category first) — that's the tool→tool internal-link mesh. **Layout (2026-09-02):** the tool owns the first viewport; `ToolAbout` renders a full-width sunken band (`--bg-soft`, `ta-*` classes from `src/site/toolAboutStyles.ts`) below it — About + features left, FAQ right as native `<details>` accordions (closed by default, so the copy stays in the DOM and works without JS but doesn't dominate the page; this was the deliberate trade after tool pages looked text-heavy). Below it, a "More from <site>" row (same-site siblings + home) and an "Also from Chrae Lab" row (the other two sites, absolute URLs). It is rendered *outside* the max-width column (`ToolShell` puts it between `<main>` and the footer; `GuideShell` likewise on the overview only) so the band bleeds edge to edge.
- **Landing cards, breadcrumbs, ToolShell header, FIRE "Related" links** (`routeMeta.ts` filters content entries with `area === 'fire-planner'`).

**Adding a tool:** add a `PAGES` entry with its `site` (`status: 'soon'` until it works — a `soon` entry is invisible everywhere: no landing card, no Vite input, no sitemap; landings deliberately show no "coming soon" placeholders), create `sites/<site>/<slug>/index.html` (copy `sites/tools/calculator/index.html`), `src/tools/<slug>/main.tsx` (`import '../../styles/global'; initAnalytics(); track('tool_opened', { tool }); void importLegacyStorage(site).then(() => createRoot(...))`), wrap the UI in `ToolShell` (`entry={bySlug('<slug>')}`), declare any storage key in `persistence.ts` **and add it to `SITE_STORAGE_KEYS`** (`legacyBridge.test.ts` fails otherwise; only needed for keys that existed before the split, but the test is strict), add it to the apex map in `deploy/nginx.conf` only if it had a pre-split URL, write the `about` block (3+ features, 3+ FAQs, factual — `manifest.test.ts` enforces presence) and set `updated`, then flip to `live`. No change to `vite.config.ts`, the sitemap, or any `<head>` is needed.

**Theme boot.** `THEME_BOOT_SCRIPT` (`scripts/head.ts`) runs before CSS on every page: stored `firePlannerTheme` wins, else `prefers-color-scheme`. `useTheme.readInitial()` applies the identical rule — keep the two in lockstep or pages flip theme on mount. The landings have no React; `src/hub/main.ts` toggles `data-theme` by hand and writes the same key. The theme is per origin now: each of the three sites remembers its own.

### Split + legacy apex

Until 2026-10-05 everything lived on `https://chraegames.cloud` (hub at `/`, planner at `/fire-planner/`). Now:

- **Redirects** — `deploy/nginx.conf` serves `dist/<site>` by Host and 301s every apex/`www`/`fireplan` URL to its new home via the `$legacy_target` map (old hub → tools landing). `scripts/nginx.test.ts` replays `/<slug>/` for every live page through that map in JS and asserts it lands on `absoluteUrl(entry)`.
- **Saved data** — localStorage is per origin, so every app entry (and the landings) `await`s `importLegacyStorage(site)` before mounting: once per origin (`chraeLab.legacyImported`), it frames `https://chraegames.cloud/migrate.html` (same *site*, so storage isn't partitioned), asks for `SITE_STORAGE_KEYS[site]`, writes only keys missing locally, and times out after 2.5 s. Skipped on localhost and any non-`*.chraegames.cloud` host. The bridge answers only `https://(fire|games|tools).chraegames.cloud` and only allow-listed keys; nginx sends `frame-ancestors` for it. Keep the apex DNS + `/migrate.html` alive for months; eventually both can go along with this mechanism.
- **Dev** — `npm run dev` (fire), `dev:games`, `dev:tools`; `preview:*` likewise after a build. Cross-site links in dev point at production (they are absolute).

**First-paint colour.** `ANTI_FLASH_STYLE` (`scripts/head.ts`) paints `html` in the two `--bg` values before `tokens.css` loads; `head.test.ts` pins them. The `<meta name="theme-color">` pair (light/dark via `media`) is hand-written in every `*/index.html`, and `public/manifest.webmanifest` carries the light value — if `--bg` changes, update all three places.

---

## Data model — `src/models/types.ts`

Three nested layers persist to one localStorage key:

```
ProfilesState
  profiles: Profile[]                       # multiple personal profiles (e.g. "Me", "Spouse")
  activeProfileId: string
Profile
  plans: Scenario[]                         # scenarios within a profile
  activePlanId: string
  id, name
Scenario  (a.k.a. "plan" in code; "scenario" in UI copy)
  input: PlanInput                          # the user's assumptions
  actuals: ActualsData                      # year-by-year overrides
  touched?: boolean                         # drives the Welcome→Partial→Forecast screen ladder
  id, name
```

The `touched` flag is the single most important state bit in the app — see [Routing](#routing-the-touched-contract).

---

## Engine — `src/engine/`

Pure functions. No React imports. Reused by both the live UI (`runSimulation` on every input change) and the auto-balance optimizer.

| Module | Role |
|---|---|
| `simulation.ts` | The forward simulator. Iterates years, applies income/expenses/inflation/withdrawals/tax, returns a `SimulationResult` (one row per year). Honors `actuals` overrides — actual values fully replace projected values for the same year. |
| `tax.ts` | `calculateIncomeTax(grossTaxable)` and `calculateCapitalGainsTax(gains, ordinaryIncome)` — bracket-by-bracket. **Brackets are 2026 Married Filing Jointly, illustrative only.** See [Tax model caveats](#tax-model-caveats). |
| `constants.ts` | Bracket data + `EARLY_WITHDRAWAL_PENALTY_AGE = 60`. The 59½ IRS rule is approximated as "the calendar year you turn 60" because we don't capture birth month. |
| `resolve.ts` | `resolveAmount(periods, year)` — sums all periods that overlap the year (intentional double-count for overlapping periods). `resolveIncomeAndExpenses(input, year, actuals?)` aggregates income/expense lines for a single year, applying inflation to expenses with `applyInflation !== false`, and respecting monthly actuals (keyed `year*100 + month`). |
| `autoBalance.ts` | The withdrawal-schedule optimizer. Forward-greedy with proportional drawdown across brokerage/Roth/IRA. Binary-search shrinks `targetCash` if user's target is unsustainable. **Used to be an LP; isn't anymore** — `javascript-lp-solver` returned blatantly suboptimal solutions on long horizons (header comment explains). |
| `defaults.ts` | `buildDefaultInput()` (seed plan), `defaultActuals` (empty), `generateId()` (UUID-with-fallback). |
| `presets.ts` | The three Welcome-screen sample lives (Coast FIRE / Mid-career / Approaching retirement). |

The engine is the only place numbers come from. UI components never compute simulated values themselves — they read from `SimulationResult` or render the input.

---

## Routing — the `touched` contract

`App.tsx` derives the current screen with **two** layers:

```ts
if (!seenIntro)          → <Intro />                  // first-visit gate
                            // (nothing else renders below; AppBar is minimized)

route === 'history'      → <HistoryPage />            // sticky side-route, AppBar Back button

else, based on activePlan:
  !activePlan.touched                → <Welcome />
  touched && expenses.length === 0   → <PartialPlan />
  touched && expenses.length > 0     → <PlanForecast />
```

**Key invariant: Welcome only renders on an untouched active plan.** Welcome's preset/build buttons (`handleLoadPreset`, `handleBuild`, `handleSkipToAdvanced` in `App.tsx`) mutate the active plan in place — they're safe only because the plan they overwrite by contract has only default seed data. If a regression ever showed Welcome on a touched plan, that contract would be broken and the in-place mutation would become silent data loss. The single-source-of-truth check is the `screen` derivation; no other code re-derives it.

**`touched` gets set to true** by every input edit, preset load, scenario creation via "+ New" tab, and the `Skip to advanced` button. **It's set false** only by `freshStart()` (first visit) and `deletePlan`'s last-plan rebuild (deleting the only scenario in a profile re-creates an untouched Default).

`migratePlans` always backfills `touched: true` when missing — imported plans without the flag are treated as touched (don't bounce to Welcome).

---

## Persistence — `src/utils/persistence.ts`

### localStorage keys

| Key | Owner | Purpose |
|---|---|---|
| `financial-planner-profiles` | `PROFILES_KEY` | Current `ProfilesState` blob (the only "data" key) |
| `firePlannerIntroSeen` | `INTRO_SEEN_KEY` | `'1'` once the user dismisses the Intro |
| `firePlannerTheme` | `THEME_KEY` | `'light'` or `'dark'` — shared by every page on the site (legacy name, don't rename the value) |
| `chraeLab.unitConverter` | `UNIT_CONVERTER_KEY` | Last category + from/to units |
| `chraeLab.calculator.history` | `CALCULATOR_HISTORY_KEY` | Recent calculations (newest first, capped) |
| `chraeLab.todo` | `TODO_KEY` | To-do lists + items |
| `chraeLab.sudoku` | `SUDOKU_KEY` | Current Sudoku game (puzzle, solution, board, notes, clock) |
| `chraeLab.bingo` | `BINGO_KEY` | Current Bingo caller game (variant, ordered calls) + caller settings (auto interval, voice) |
| `chraeLab.go` | `GO_KEY` | Preferred Go board size only — games are never persisted |
| `chraeLab.magicTower` | `MAGIC_TOWER_KEY` | Magic Tower save slots (`auto`, `s1`–`s3`): seed, loop, hero, per-floor diffs — the tower is regenerated on load |
| `chraeLab.magicTower.meta` | `MAGIC_TOWER_META_KEY` | Magic Tower unlocks (`unlockedLoop`), codex, per-loop records |
| `chraeLab.magicTower.lang` | `MAGIC_TOWER_LANG_KEY` | Magic Tower UI language (`'en'` \| `'zh'`); the game shows one language at a time |
| `chraeLab.city` | `CITY_KEY` | City save: seed, tick, funds, scalars + RLE/base64 layers (`src/tools/city/save.ts`); terrain and networks are rebuilt on load |
| `chraeLab.city.prefs` | `CITY_PREFS_KEY` | City view prefs (`ui/prefs.ts`): day/night cycle, problem icons, seed whose getting-started checklist was dismissed |
| `chraeLab.legacyImported` | `LEGACY_DONE_KEY` (`site/legacyStorage.ts`) | Timestamp: this origin already ran the one-time import from the old apex |
| `financial-planner-scenarios` | legacy | Pre-profiles "single profile, many scenarios" shape |
| `financial-planner-input` | legacy | Pre-scenarios "one plan" shape |
| `financial-planner-plans` | legacy | Withdrawal schedules from the pre-scenarios shape |

`loadProfiles()` reads modern → falls back through each legacy shape → ultimately returns `freshStart()`. Legacy keys are deleted after a successful migration.

`migratePlans(plans)` is **idempotent** and **mutates in place**. Tests pin this. It backfills missing fields, renames `brokerageReturnRate` → `returnRate`, splits the legacy `retirementBalance` 50/50 into `rothBalance`/`iraBalance`, renames `accountType: 'retirement'` → `'ira'`, ensures every account type has a withdrawal schedule, re-buckets old per-schedule-ID withdrawal actuals into per-account-type buckets, and stamps `touched: true` when absent.

### Writing state

Every write goes through `safeSetItem(key, value)` (`persistence.ts`). It catches the localStorage quota / permission errors and returns `false` so the caller can degrade. `App.tsx`'s `setProfilesState` increments `saveErrorVersion` on failure; the toast at the top of the page shows whenever `saveErrorVersion > dismissedErrorVersion` (so each new failure re-shows after dismissal).

### `loadIntroSeen()` grandfathering

Returns `true` (skip Intro) when:
1. The seen flag is already in localStorage, OR
2. Any profile has any scenario with `touched === true`, OR
3. Any of the three legacy storage keys are present.

Result: only genuinely new visitors see the Intro. Audited returning users never get it.

---

## Tax model caveats

Documented in About modal, README, `engine/constants.ts`, and inside `engine/tax.ts` header comments. Summary:

- **2026 MFJ only.** Std deduction $32,200; brackets from IRS Rev. Proc. 2025-32. Single / HoH / MFS not supported — there's a `TODO(filing-status)` marker near the constants.
- **"Age 60" semantics for the 59½ rule.** We have birth *year* but not birth *month*. `earlyWithdrawalCutoff = birthYear + 60` is exact for December-born users and ~6 months conservative for January-born ones.
- **Not modeled at all:** state/local tax, Social Security, pensions, RMDs, NIIT, Medicare IRMAA, the Roth 5-year rule, Roth conversions, return variability, sequence-of-returns risk, inflation on income.

If you change the brackets, also update: README "What it models" section, About modal "What it models" / "What it skips" blocks, the `how-it-works` content page (`src/pages/how-it-works/Content.tsx`, which spells out the 2026 MFJ assumption), the OG/meta/JSON-LD descriptions (they all carry "2026 MFJ" framing), and re-run `tax.test.ts` against the new boundaries.

---

## Dev affordances (localhost only)

`AppBar.tsx` (and `ToolShell.tsx`, for the amber bar only) shows three things when `isLocalHost()` returns true (`hostname === localhost | 127.0.0.1 | ''`):

1. An orange app-bar background + black `LOCAL` chip so it's obvious you're not on production.
2. `↻ Intro` button — clears `INTRO_SEEN_KEY` and flips state. **Non-destructive.** Plan data untouched.
3. `↻ Welcome` button — sets `seenIntro = true`, then finds-or-creates an untouched "Default" scenario in the active profile and switches to it. **Non-destructive.** Other profiles/scenarios preserved. (It used to call `freshStart()` and wiped everything — that bug is fixed; don't reintroduce.)

All three render only when `local && !isMobile`. Handlers are passed unconditionally from `App.tsx` (the props are optional on `AppBar`); UI gating happens entirely in `AppBar.tsx`.

---

## Go — `src/tools/go/`

The one tool that talks to anything outside the browser. Two people play against each other; there is still no server of ours.

- **Transport.** [Trystero](https://github.com/dmotz/trystero) (default Nostr strategy, `appId: 'chrae-lab-go'`) introduces the two browsers through public Nostr relays and opens a direct WebRTC data channel; every game message then travels peer to peer. It is `import()`ed lazily in `net.ts` (≈60 KB chunk, only when a game starts). `?local=1` swaps in a `BroadcastChannel` transport so two tabs on localhost can play offline — that is what the e2e check uses. Known limits (documented in the FAQ): strict NAT with no TURN fails to connect, peers see each other's IP, no reconnection.
- **Layers.** `go.ts` — pure rules (captures, no suicide, simple ko via `koPoint`, two passes end, area scoring + 7.5 komi, no dead-stone marking). `match.ts` — pure session state machine: `step(session, event, ctx) → { session, effects }`; effects are `join`/`leave`/`send`/`matched`/`finished` and `App.tsx` runs them against the `Transport`. Every network callback comes back in as an event, so both sides validate every move with the same code and nobody is the authority. `net.ts` — the two transports. `Board.tsx` — pure SVG.
- **Pairing.** Quick match: lobby room `lobby-<size>`; on `peerJoin` the lower `selfId` sends `invite {gameId, size, yourColor}`, the other replies `accept` and both move to `game-<id>`; anyone else gets `busy`. Room code: host sits in `game-<CODE>` (4 chars from an I/O/0/1-free alphabet, `?room=CODE` link auto-joins). In the game room the host sends `ready {size, yourColor}` to the first peer; the guest starts on `ready`. Moves carry the move number they apply to; stale/out-of-turn ones are ignored, an illegal one ends the session as out of sync.
- **Gotchas.** A peer leaving the *lobby* while you are `inviting` is the normal move to the game room, not a disconnect (`peerLeave` is ignored in that phase). The Trystero transport waits for in-flight sends before `room.leave()` so `accept` is not dropped. The `?room=` auto-join effect is guarded by a ref — StrictMode's double effect would otherwise leave and re-enter the room, which the host sees as "opponent left". Transport callbacks are guarded by `room === r` so a room you already left cannot feed stale events.

---

## Magic Tower — `src/tools/magic-tower/`

A 魔塔 / Tower of the Sorcerer puzzle-RPG: ten loops (周目) × 99 procedurally generated floors, bilingual labels, our own pixel art. The design rationale lives in the plan the tool was built from; the contracts that matter for changing it:

- **Combat is one function.** `combat.ts#getDamageInfo(hero, monster, ctx)` is the only place damage is computed (classic formula + mota-js ability conventions + perk hooks). The generator, the solver, the manual and the reducer all call it.
- **Fixed puzzle, not adaptive.** A tower is `{ seed, loop }`; nothing in generation reads the player's actual state. Zones are generated **one at a time** (`floorgen.ts#generateZone`) when the previous boss dies and the blessing is chosen, from the *calibration hero* (`heroForZone`: the previous zone's proof-line hero plus the chosen perks). Same seed + same perk picks ⇒ same tower; saves store only the seed, the perks and per-floor diffs, and `App.tsx` regenerates zones on load (in a module Worker, `worker.ts`).
- **Soundness by construction, difficulty by calibration.** `buildZone` lays out floors (BSP rooms → wings behind a door/guard, gem pockets, vaults, hatches, backtrack keys), then `walkLine` drives `ZoneSim` along the intended collector line and **back-solves each monster's stats when the line reaches it** (`statMonster`), so that line survives with the zone's slack target. `calibrateToExpert` then runs the staged solver (`solver.ts`: exhaustive per-floor search with dominance pruning + return-and-open macros) and re-tunes the boss to the expert line, which becomes the stored proof (`ZoneInfo.line`). `statLoose` stats the trap monsters last (they never carry zone/aura abilities that could change the line).
- **Validation.** `validate.ts#validateTower` = structural invariants + the stored line replayed through the real reducer (`game.ts`) + six naive policies (`policies.ts`) + template detection. `npm run mt:validate -- --seeds 20 --loops 1-10` prints the distribution report; `tower.test.ts` runs a small version in CI and the full sweep with `MT_SLOW=1`.
- **Sim ⇄ reducer parity rules.** Movement over reachable tiles is free; stairs/holes change floor only on a *deliberate* step (`step(state, to, final)`) so routes may pass over them; items are auto-collected in the sim and explicit `take` actions in the ledger; `ZoneSim.ords` ordinal maps are append-only because the generator adds guards mid-walk. If you change a rule in `game.ts`, mirror it in `zonesim.ts` — the replay test will tell you if you forgot.
- **Breach rules** (`game.ts#breachTarget`): needs a stone; destination = physically adjacent floor (`floorAbove`/`floorBelow` respect the loop topology; a hatch tile breaches to `floor.hatch.to`); landing must be open floor or a vault centre; a boss floor's ceiling is sealed until its boss dies; the hole is recorded in both floors' diffs and is a two-way passage (`useTile` when standing on it).
- **UI.** One classic-style *game frame* (`styles.ts` `.mt-frame`: dark, gold-bordered, fixed palette in both themes) holds the `SidePanel` (stats in pixel style), the board `Canvas` (backing store = displayed size × DPR so sprites and the number overlays stay crisp; `overlay.ts` computes the damage / gain numbers per tile) and the `Toolbar`. The monster manual is a popup (M toggles) rendered as a table by `components/Manual.tsx` from `manual.ts` (grouped by identical monsters; "Cheaper with" = the smallest ATK/DEF that lowers the cost and the cost at that value). All game copy is single-language via `strings.ts` (`t(lang, key)`, `msg(m, lang)` for reducer messages, which are structured `Msg` objects, not strings).
- **Adding an ability / perk / template**: ability → `types.ts` union, `combat.ts`, `i18n.ts`, monster affinities, loop table; perk → `perks.ts` (must be a monotone bonus; hooks in `combat.ts`/`items.ts`); template → `floorgen.ts#detectTemplates`.

## City — `src/tools/city/`

A SimCity-4-style city builder: 128×128 tile grid, statistical simulation, procedural 3D. Three layers, strictly separated:

- **`sim/` is pure TypeScript** (no DOM, no three, no React) and runs in a module Worker (`worker.ts` → `sim/host.ts#SimHost`; `client.ts` falls back to the same host inline when `Worker` is missing). `types.ts#CityState` is flat typed arrays indexed `y * N + x`; `constants.ts#TUNING` holds every coefficient (balance edits are one-file diffs). `sim/tick.ts` is the contract: fixed system order with a 24-tick month, cheap passes every tick (actions, growth over a quarter of the tiles), staggered passes on `k % 6` (totals/crime/fire risk, pollution, land value, desirability), coverage on `k % 12`, traffic assignment once a month (`k % 24 === 11`), and the monthly close (ageing, people, demand, budget, ignition, advisor). Randomness only comes from `state.rngState` via `nextRandom` in fixed tile order, so same seed + same actions at the same ticks ⇒ byte-identical state (`tick.test.ts` pins it). Never read `Date`, `Math.random` or module-level mutable state inside `sim/` (module-level *scratch* is fine).
- **`render/` is the only place three.js lives**, `import()`ed from `Viewport.tsx` so `/city/` alone pays for the chunk. Everything is generated: terrain chunks with baked vertex lighting and one `ShaderMaterial` (overlay `DataTexture` + fading grid + cursor rects), `ChunkManager` with one merged building mesh + one road mesh per 16×16 chunk rebuilt only when the sim marks the chunk dirty (≤ 4 per frame), `buildingSpec()` (pure, tested) for shapes by zone × density × wealth × level, a canvas-painted road atlas and window cell. `camera.ts`/`picking.ts`/`overlay.ts`/`buildings.ts`/`roads.ts`/`geometryBuilder.ts` are pure and tested; `renderer.ts`, `chunks.ts`, `terrain.ts`, `roadAtlas.ts`, `input.ts` touch three/DOM and are not.
- **`protocol.ts`**: a snapshot is one `ArrayBuffer` in `SNAPSHOT_LAYERS` order (16-bit layers first), *transferred* to the main thread and recycled back (`recycle`); the worker owns three buffers and skips a snapshot when none is free. `App.tsx` never sets React state per snapshot: the renderer copies the layers (`renderer.layers`, stable reference), the HUD updates at 4 Hz or on month boundaries, the Inspector re-reads the same layers via a `version` prop.

**Progression (2026-09-08).** `sim/milestones.ts#MILESTONES` is the ladder (Outpost → Megalopolis, thresholds on *peak* population, so a dip never re-locks): each tier lists the plops it unlocks, the zone density it allows, a grant and feature flags (`LOAN_TIER`, `POLICY_TIER`, `AVENUE_TIER`). `actions.ts` refuses locked things with `reason: 'locked'` (and `'water'` for shore-only plops such as hydro / treatment), the toolbar greys them out with the tier name, and `checkMilestones` (monthly) pushes a `Notice` that the HUD shows as a banner. Tests use `flatState()` which unlocks everything unless passed `locked = true`. Garbage (`sim/garbage.ts`) and every road-reaching service share `sim/reach.ts#coverAlongRoads`; facilities **stack** their capacity shares (two half-size plants serve a district in full — `garbage.test.ts` pins it). `sim/problems.ts` writes one `PROBLEM` byte per lot origin (no power/water/road/jobs/workers/customers/garbage/blight) after desirability in the staggered tick; `render/markers.ts` floats an icon over each (thinned when dense) and `ui/Inspector.tsx` explains and links the data view. `sim/policies.ts` defines the ordinances (bits of `state.policies`, cost fixed + per resident) and the systems read `hasPolicy`. Saves from before this update load: `save.ts` pads `funding`/`expenses` from 7 to `SERVICE_COUNT` slots and infers the milestone from the population.

**Day/night.** `renderer.ts` keeps a real-time clock (one day ≈ 4 min at normal speed) and `effects.ts#dayLook` blends sky, sun, fog, ground tint and the window glow (`emissiveMap` from `roadAtlas.ts#createWindowGlowTexture`, sampled at repeat 0.5 so neighbouring windows differ). `setDayCycle(false)` pins the theme's daylight look; `__city.setClock(t)` jumps the clock for screenshots. New lots (`age === 0`) render as construction sites (`props.ts#emitConstruction`); `ageBuildings` marks the chunk dirty when the age ticks to 1.

The HUD has its own fixed "toy town" palette (`ui/styles.ts`: cream paper, cocoa 2px outlines, hard offset shadows, `--cp-*` variables) in both site themes and uses the stroke SVG glyphs in `ui/icons.tsx` — add an icon there rather than text when adding a tool. `render/effects.ts` holds the cosmetic layer (sky dome, fire sparks, turbine blades, tornado funnel, quake shake) driven only by snapshot layers and HUD fields; `sim/disasters.ts` owns tornado/earthquake damage and reuses the demolish/removePlop paths.

Contracts that matter when changing it: `actions.ts#applyAction` is the only writer of saved layers on behalf of the player (validate → charge → mutate → flags); anything that changes conductivity sets `flags.netDirty`, roads/water plops `waterDirty`, stations `serviceDirty`, parks/water `distDirty`; geometry changes go through `markDirty(state, i)`. Roads conduct power (a deliberate departure from SC4). `save.ts#parseSaveFile` is pure and version-fenced (`SAVE_VERSION`, `GEN_VERSION` — bump the latter whenever `terrain.ts` changes). `scripts/city-sim.ts` (`npm run city:sim -- --seed 1 --years 30 [--plops]`) runs the scripted town from `sim/scenario.ts` headlessly with a mayor that adds utilities, rubbish, services and densification as tiers unlock, and prints yearly curves — use it before and after any balance change (2026-09-08 baseline: ~24k residents by year 9 on the 45×31 site, hamlet with four basic services runs slightly positive, big city banks a few hundred thousand a year). On localhost or with `?debug=1`, the backtick key opens the tuning panel (`ui/DebugPanel.tsx`: layer means over built tiles, +1 month / +1 year / +$100k, live overrides of the numeric `TUNABLE_KEYS` sent to the worker as a `tuning` message → `applyTuning`), and `window.__city` exposes `dispatch`, `fastForward`, `lookAt`, `newCity(seed)`, `openSheet`, `setOverlay`, `select`, `setClock`, `setPrefs` and the scenario helpers for driving the live app (the e2e screenshot scripts use it; call `newCity(1)` first for a deterministic map). Lots: medium density grows 2×2 and high density 3×3 lots (`sim/lots.ts`); every tile of a lot keeps its own per-tile fields, the origin tile decides upgrades/abandonment for the lot, and the renderer draws one scaled building per lot.

## TV buying guide — `src/tools/tv-guide/`

The one multi-page tool. `/tv-guide/` is a `kind: 'app'` entry (category `utilities`, has `about`); `/tv-guide/{technologies,brands,decoder,compare}/` are `kind: 'content'` entries with `area: 'tv-guide'`. Unlike the FIRE guides these content pages **do load React** — each has `tv-guide/<chapter>/index.html` → `src/tools/tv-guide/entries/<chapter>.tsx` → `mountGuide('<chapter>')`.

- **Pure View / hooked Live split.** `pages/*View.tsx` are hook-free and take their state as props; with no handlers they render *expanded* (every tab panel stacked, tab strip as `#anchor` links) — that is what `static.tsx` → `prerenderPages.tsx` renders at build time, so crawlers and no-JS visitors get every word. `pages/Live.tsx` wraps each view in `useState` (tab from `location.hash`, `hashchange` synced) and passes handlers; the client `createRoot().render()` replaces the static tree (never hydrates), so the static and live markup may differ.
- **`GuideShell`** (pure) is the chrome for both trees — a breadcrumb row (3-level crumb via `breadcrumbs()` | `UpdatedBadge` pill + theme toggle) over an underline tab bar (`.tvg-nav`; keep the `<a href aria-current="page">` attribute order, `seo.test.ts` regexes it), `ToolAbout` on the overview / related-tool links on chapters. It is *not* `ToolShell` (which is hook-bound and can't be prerendered). `components/ThemeToggle.client.tsx` is the only hooked component and is imported only by `App.tsx`. The overview uses a local `GuideSection` (mono label + rule) instead of Prose `H2`; chapter pages still use `H2`.
- **Content lives in `data.ts`** (technologies, layers, attributes/ratings, brands → marketing names → tech ids, `CHANGELOG`) and `logic.ts` (decoder, `compareRows`, `recommend`). Editorial rule enforced by `data.test.ts`: series names only — no models, sizes, prices or brightness figures.
- **Dating.** `GUIDE_REVIEWED = CHANGELOG[0].date`. Every content revision = add a `CHANGELOG` entry **and** set `updated` (plus `Article.dateModified`) on all five manifest entries to the same date; `data.test.ts` fails if they drift.
- **Diagrams** are inline SVG (`LayerStack`, `ZoneGrid`, `RgbBacklight`) animated purely by CSS classes in `components/styles.ts` (`tvg-*`, theme-scoped vars, `prefers-reduced-motion` guard), so they animate on the static page too; React only adds the tap-to-highlight.
- Purity gotchas: nothing reachable from `static.tsx` may import `Button`, `useTheme`, `ToolShell` or `utils/analytics` (`import.meta.env` fails `tsc -b` under `tsconfig.node.json`). `.tsx` files export components only (`react-refresh/only-export-components` is an error) — constants go in `ui.ts` / `styles.ts` / `pages.ts`.

---

## UI conventions

- **Inline styles + CSS variables.** No CSS modules, no Tailwind, no styled-components. Style objects are passed to JSX `style={}` and reference tokens from `styles/tokens.css`. The tokens cover colors (light + dark), shadows, radii, and font families. Pages that need hover / responsive rules (hub, FIRE intro, TV guide) inject a namespaced `<style>` string (`hub-*`, `fire-intro-*`, `tvg-*`) from a `.ts` constant.
- **Night Console look (Design/v3).** Neutral canvas, 1px borders, 5px radii, `--shadow-card: none` (only floating UI uses `--shadow-pop`), one 150ms `background`/`border-color` hover transition on cards. **Elevation ladder (retuned 2026-09-02 after dark-theme controls looked flat):** `--bg` → `--surface` (cards) → `--surface-2` (keys, secondary buttons, inputs) → `--surface-3` (hover) are each a clearly visible luminance step in both themes, and `--border-strong` is the outline for anything interactive (`--border` is for rules and card edges, `--border-soft` for hairlines only — never for a control). Interactive "keys" (calculator keypad, sudoku number pad, bingo flashboard, `Button` outline) add `inset 0 1px 0 var(--key-highlight)` so they read as raised; active segments/tabs are accent-filled with `--accent-contrast` text (unit converter, calculator, Go), and `Button` `soft` carries a 45% accent border so tinted toggles still read as controls on dark. Four category accents (`--cat-finance/-utilities/-productivity/-games`); `--accent` is finance teal by default and every inner page re-points the `--accent*` family at its category through `accentFor(entry.category)` (`src/site/accent.ts`) on its root element. Text on a filled accent is `--accent-contrast`, never a hardcoded white. Recurring patterns: the *section header* (mono 12.5px uppercase label + rule, optional 8px accent dot), the mono 12px breadcrumb with an `--ink-slash` separator, serif h1 with one `<em>` clause in the accent, mono 11.5px footers. Index numbers / chapter labels use `--ink-index` (contrast-checked at 10–11px), not `--ink-muted`.
- **`ToolShell layout='full'`** (City) hands the tool the first viewport edge to edge (no padding, no max width, `min-height: calc(100dvh - 56px)`); About band + footer still follow below. Every other tool uses the default centred column.
- **Primitives over re-rolling.** `Button`, `Icon`, `Input` (and `MoneyInput` / `PercentInput` / `YearInput`), `Popover`, and `EditDrawer` are the building blocks. New screens should compose these rather than introducing parallel primitives.
- **Numeric inputs use a focus-buffered pattern** (see comment block at the top of `Input.tsx`). While focused: show raw typed text, allow mid-edit invalid states. On blur: clamp + canonicalize. The pattern matters — if you bypass it (e.g., always-controlled value with `Math.max`), backspace stops working.
- **Modals use the focus-trap hook.** `useFocusTrap(active, ref)` (`hooks/useFocusTrap.ts`) handles tab trapping, body scroll lock, and focus restoration on close. All five modal-likes use it: AboutModal, ExportModal, ImportModal, EditDrawer, ConfirmDialog.
- **Drawers vs modals:** edit flows use `EditDrawer` (side panel on desktop, bottom sheet on mobile, mounted by `DrawerHost.tsx`). One-shot confirmations and content-only screens use the modal pattern.
- **Mobile breakpoint:** `useIsMobile()` (default ≤ 720px). Most layout decisions branch on this — see `HistoryPage`, `YearByYear`, `AppBar`, `PlanForecast`.

---

## Coding rules the linter enforces

The ESLint config uses the strict `react-hooks/*` ruleset. Two rules bite often:

- **`react-hooks/rules-of-hooks`** — no early returns *before* the hook calls in a component. If you want to short-circuit on a derived state (e.g., empty profiles), you have to do it in the JSX, not by returning early at the top of the function. Lost two hours to this once already; the existing pattern of "render conditionally inside the return" is the canonical fix.
- **`react-hooks/set-state-in-effect`** — don't call `setX` synchronously inside a `useEffect`. Move the work into the event handler that triggered the change, or compute the value as derived state via `useMemo`. The mobile YearByYear right-fade hook had to be restructured to satisfy this.

Also worth knowing:
- The repo runs `tsc -b && vite build` (strict mode), so missing nullability and unused variables fail the build.
- ESLint runs separately via `npm run lint`. Pre-push: `npm run lint && npm test && npm run build` (per `~/.claude` auto-memory).

---

## Testing — `vitest`

Engine + utility coverage, no DOM tests. Run with `npm test` (one-shot) or `npm run test:watch`.

| File | What it covers |
|---|---|
| `engine/simulation.test.ts` | Cutoff scaling by birth year, brokerage basis/cap, withdrawal proportional split |
| `engine/tax.test.ts` | Income + LTCG brackets, pinned to 2026 MFJ values; spelled out at top so a future bracket change fails loudly |
| `engine/autoBalance.test.ts` | Cash floor under various retirement shapes; the latest case covers `targetCash < CASH_FLOOR` (no NaN / infinite loop) |
| `engine/resolve.test.ts` | `resolveAmount` overlap semantics, monthly actuals fill-in, inflation behavior |
| `utils/persistence.test.ts` | Every legacy migration shape, `cleanActuals` clipping logic (uses `vi.useFakeTimers()` to pin `Date.now()`) |
| `utils/format.test.ts` | `formatDollars` + `formatDollarsCompact` boundaries; the `999_500 → "$1.0M"` and negative-sign-placement fixes are pinned here |
| `utils/dedupeName.test.ts` | Smallest-gap insertion, case/whitespace sensitivity, Set vs array input |
| `site/manifest.test.ts` | Per-site unique paths, slugs = pre-split paths, one home per site, category ↔ site, breadcrumb trails, `hrefFor`, every live tool has `about` + `updated`, `relatedTools` ordering and never crossing sites |
| `pages/seo.test.ts` | Prerender output per page (each landing shows only its site + links the other two, FIRE hero, content headings, tool About/FAQ + sibling links, nothing links the apex or `/fire-planner/`), per-site sitemap/robots/404/webmanifest |
| `scripts/head.test.ts` | Canonical/OG URLs on each subdomain, BreadcrumbList shape, FIRE JSON-LD blocks, tool WebApplication/FAQPage derived from `about`, landing WebSite/ItemList, no apex URLs, theme boot script uses `THEME_KEY` |
| `scripts/pages.test.ts` | Every live manifest entry has `sites/<site>/<path>/index.html`, no stray entries, old root-level entries gone |
| `scripts/nginx.test.ts` | Apex 301 map sends every pre-split URL to its new canonical URL (query strings, missing slashes, old hub); host → dist folder; bridge `frame-ancestors` |
| `scripts/legacyBridge.test.ts` | Import only on prod subdomains, never overwrites, every persisted key owned by a site, `legacy/migrate.html` key/origin allow-lists agree with the client |
| `tools/unit-converter/*.test.ts` | Unit round-trips + pinned conversions, result formatting |
| `tools/calculator/*.test.ts` | Expression parser (precedence, right-assoc `^`, deg/rad, errors with positions), history cap |
| `tools/todo/*.test.ts` | Reducer actions + invariants (active list always valid), due-date labels, load/save validation |
| `tools/sudoku/*.test.ts` | Solver/uniqueness counter against a known puzzle, seeded generator (deterministic, unique solution, clue targets), conflicts; reducer (input/notes/erase/undo/hint/win), save-file validation |
| `tools/bingo/bingo.test.ts` | B-I-N-G-O column mapping per variant, `boardRows` coverage, rejection-sampling RNG (`uniformFrom` with a fake source + `secureRandomInt` range), reducer (draw never repeats, stops when exhausted, undo), save-file validation |
| `tools/go/go.test.ts` | Rules: coordinates/star points, group liberties, single + multi-group capture, suicide refused, capture-with-no-liberties allowed, simple ko then retake after a tempo, two passes end + score, area scoring (empty board = komi, wall split, neutral regions), prefs parsing |
| `tools/go/match.test.ts` | Room-code alphabet/normalising; two sessions wired back to back: lobby pairing (lower id invites, `busy` for a third), room-code host/guest with `ready`, mirrored moves/passes/resign, stale move numbers ignored, illegal incoming move → out of sync, opponent leaving → abandon win, cancel/reset leave the room |
| `tools/magic-tower/combat.test.ts` | Base formula, every ability (先攻/魔攻/坚固/连击/吸血/破甲/反击/模仿/净化/固伤/自爆/无敌 ± cross, aura/support), breakpoints, perk hooks, phased bosses |
| `tools/magic-tower/layout.test.ts` | Every archetype connected, rooms + gaps cover the open tiles, wing candidates really cut off, mirroring |
| `tools/magic-tower/game.test.ts` | Reducer: walking/pickups, only winnable fights, keys + undo, stairs alignment, breach → two-way hole, planRoute, boss seal + perk draft |
| `tools/magic-tower/save.test.ts` | Save-file validation (shape, `genVersion`), round-trip, meta defaults |
| `tools/magic-tower/sprites.test.ts` | Every sprite is 16×16 with a complete palette; every monster has a sprite |
| `tools/magic-tower/tower.test.ts` | Generates towers and runs `validateTower`: structure, sim + reducer ledger replay, templates (slow part gated by `MT_SLOW=1`) |
| `tools/city/sim/terrain.test.ts` | Seeded terrain: determinism, ranges, water/buildable fractions, land on every edge, corner heights |
| `tools/city/sim/actions.test.ts` | Costs and refusals (funds, water, occupied), L-line roads, plop footprints, bulldoze, tax/funding clamps, loans |
| `tools/city/sim/roads.test.ts` | Road access distance, external connection only via an edge road, island roads stay disconnected |
| `tools/city/sim/utilities.test.ts` | Power components + lines bridging islands, deterministic brownout fraction; water coverage radius and shrink under shortage |
| `tools/city/sim/growth.test.ts` | A connected/powered/watered town grows; no road ⇒ no growth; losing the plant ⇒ abandonment; occupancy ≤ capacity, demand bounded |
| `tools/city/sim/tick.test.ts` | Byte-identical determinism over 20 scripted months incl. a disaster; no NaN, every layer in range |
| `tools/city/protocol.test.ts` / `save.test.ts` | Snapshot pack/view round-trip + alignment; RLE, save round-trip (< 300 KB), continues identically after reload, validator rejections |
| `tools/city/render/*.test.ts` | Picking (vertical/oblique/miss), building specs (deterministic, inside tile, monotone height), road piece/rotation for all 16 masks, overlay RGBA |
| `tools/tv-guide/data.test.ts` | Content invariants: unique ids, every layer/tech reference resolves, every current tech has a brand name, ratings 1–5, official URLs are brand roots, **no prices / inch sizes / brightness figures anywhere**, changelog newest-first and `updated` dates of all five `/tv-guide` pages equal `GUIDE_REVIEWED` |
| `tools/tv-guide/logic.test.ts` | Decoder (normalisation, exact > prefix > contains ranking, aliases), `compareRows` best-cell marking incl. lower-is-better, `recommend` over the full answer space (budget cap, static-content → LCD, dark/movies/premium → OLED), `ruleOfThumb` 3×5 |

New engine/util/tool-logic modules should ship with a test file. Tools keep their logic in pure `.ts` modules so they're testable without a DOM.

---

## Analytics

`utils/analytics.ts` injects Umami via `VITE_UMAMI_HOST` + `VITE_UMAMI_WEBSITE_ID` env vars (set in `.env.production`). Disabled automatically on localhost and when env vars are missing — `npm run dev` never touches the production Umami. Event names used today:

```
FIRE:  drawer_opened, plan_created, profile_created, auto_balance_run,
       preset_loaded, plan_built, skip_to_advanced, export_downloaded,
       import_applied, history_opened, intro_shown, intro_dismissed
Tools: tool_opened {tool}, converter_used {category, from, to},
       calc_evaluated {ok}, todo_created, todo_list_created,
       sudoku_started {difficulty}, sudoku_won {difficulty, seconds, hints},
       bingo_started {variant}, bingo_finished {variant},
       go_matched {mode, size}, go_finished {size, result},
       mt_run_started {loop}, mt_perk {id}, mt_loop_cleared {loop, steps},
       city_started {seed}, city_loaded, city_saved, city_month {population} (yearly),
       city_disaster {kind},
       tool_opened {tool:'tv-guide', page}, tv_guide_chooser {room,use,budget},
       tv_guide_tab {page, tab}, tv_guide_decode, tv_guide_compare {tech}
Both:  theme_toggled {theme}
```

One Umami website ID covers the whole site; tools are told apart by page path in Umami's Pages view. Every entry (`src/main.tsx`, `src/hub/main.ts`, each `src/tools/<tool>/main.tsx`) calls `initAnalytics()`; fire `tool_opened` from the entry module, not from an effect (StrictMode would double it). `track()` swallows all errors — analytics must never break the app.

---

## SEO surface — build-time prerender

Everything is client-only, but every page's first byte carries real HTML so crawlers, link unfurlers (Slack/Discord/Twitter/Bing), and no-JS visitors get content — without server-side rendering the stateful apps. The mechanics live in the [Site manifest](#site-manifest--srcsitemanifestts) section; the contracts:

- **FIRE home (`fire.…/`)** is prerendered with `IntroContent` (`components/storyline/IntroContent.tsx`). On mount, `App`'s `createRoot().render()` *replaces* it — no `hydrateRoot`, so no hydration mismatch despite the server having no localStorage. Tool pages work the same way with `ToolStatic`.
- **FIRE content guides** (`fire.…/coast-fire-calculator/`, `/4-percent-rule/`, `/retirement-withdrawal-strategy/`, `/how-it-works/`) and the **games/tools landings** are static-only — their `index.html` loads a CSS-only entry (or `src/hub/main.ts`) instead of an app, so they ship no React/recharts bundle.
- **Single source of copy.** `IntroContent.tsx` exports `IntroHeader` / `IntroSections` / `IntroDisclaimer`, consumed by *both* the interactive `Intro.tsx` and the prerendered FIRE home. Titles/descriptions for every page live only in the manifest.
- **Purity contract.** Everything reachable from `scripts/prerender.tsx` (`prerenderPages.tsx` → Landing, ToolStatic, ToolAbout, IntroContent, ContentLayout, the page components) must stay free of hooks, browser APIs, and CSS imports — it's rendered to a string in the Vite/Node build context. `tsconfig.node.json` carries `jsx: react-jsx` + DOM libs so the config-side type-checks this tree.

If you change the Intro's copy, also update the FIRE entry's `description`/`jsonLd` in the manifest so the brand voice stays consistent.

---

## Gotchas + things to avoid

- **Don't add `setProfilesState(freshStart())` anywhere new.** It nukes every profile and every scenario. The current callers are `deleteProfile` (last profile, gated by confirm dialog) and nothing else. The dev `↻ Welcome` button used to do this; it doesn't anymore.
- **Don't call setState in a render function on a path that always runs.** It triggers an infinite loop and React eats the error. (Conditional state-sync — `if (prop !== last) { setLast(prop); ... }` — is fine, see `HistoryPage` `CellInput`.)
- **Don't bypass `safeSetItem`.** Direct `localStorage.setItem` skips the quota toast path and crashes the app in Safari private mode / quota-exceeded scenarios.
- **Don't mutate `ProfilesState` from inside `runSimulation` or any engine function.** The engine is pure; the UI hook (`useMemo`) assumes inputs don't change as a side effect.
- **Don't conditionally render hooks.** See [Coding rules](#coding-rules-the-linter-enforces).
- **Don't introduce a router.** The two-axis routing (intro/seen + screen derivation) covers the FIRE app; every other page (hub, tools, content guides) is a separate static HTML entry (Vite multi-page), not a client route. Adding React Router would be a regression.
- **Keep the prerender tree pure.** Anything reachable from `scripts/prerender.tsx` (Landing, ToolStatic, IntroContent, ContentLayout, page components) must avoid hooks, browser APIs, and CSS imports — it renders to a string at build time. See [SEO surface](#seo-surface--build-time-prerender).
- **Don't `hydrateRoot` any page.** The prerendered `#root` is intentionally *replaced* by `createRoot().render()`, not hydrated — the server has no localStorage, so hydration would mismatch.
- **Don't put `<title>` or meta tags in an `index.html`.** They're generated from the manifest; a hand-written one would duplicate. Keep the literal `<div id="root"></div>` too — the prerender plugin string-replaces it and throws if it's gone.
- **Don't make Magic Tower adaptive.** Nothing in `floorgen.ts` may read the player's actual HP/stats; the user's stance is a fixed puzzle where getting stuck is allowed and save slots are the safety net.
- **Don't hardcode cross-site links or the apex.** `/` is the current site's home (on fire that *is* the planner). Link to another site through `hrefFor`/`absoluteUrl`/`otherSites`; never to `https://chraegames.cloud/…` (it only redirects). `seo.test.ts` and `head.test.ts` fail on apex or `/fire-planner/` links.

---

## Where to look first when…

- **Adding a new input field**: model in `types.ts`, default in `defaults.ts`, simulator change in `simulation.ts` + test, UI in the relevant drawer + a `SummaryCard` row.
- **Tweaking the chart**: `components/storyline/charts/`.
- **Changing what counts as "touched"**: `App.tsx` `screen` derivation and every handler that sets `touched: true` — search for `touched: true`.
- **Adding a localStorage key**: declare it in `persistence.ts`, plumb load via a `loadX()` helper, write via `safeSetItem`, add tests.
- **Adding a tool or page**: see the recipe under [Site manifest](#site-manifest--srcsitemanifestts). Tool code goes in `src/tools/<slug>/`, wrapped in `components/layout/ToolShell.tsx`.
- **Refreshing brand copy**: landing copy is `src/hub/Landing.tsx` (`COPY`) + the `games`/`tools` entries in `src/site/manifest.ts` (the h1 wraps the closing clause "in your browser." in an `<em>`, so `seo.test.ts` compares the tagline against tag-stripped HTML). Tool About/FAQ copy is the `about` block on each manifest entry (bump `updated` too). FIRE copy is `IntroContent.tsx` (feeds both `Intro.tsx` and the prerendered FIRE home; the static tree also carries its own breadcrumb + "Runs on this device" pill because it has no AppBar) + the `fire-planner` manifest entry (description + JSON-LD) + `AboutModal.tsx` + `README.md`. Content-guide copy lives in `src/pages/<slug>/Content.tsx` with meta in the manifest.
- **Retuning the palette / fonts**: `styles/tokens.css` (values only — keep the token names, ~40 files consume them), then `ANTI_FLASH_STYLE` + the 16 `theme-color` metas + the webmanifest (see Theme boot). Design handoffs live in the untracked `Design/` folder (v3 = current look).
- **Changing a domain**: `ROOT_DOMAIN` / `SITES` in the manifest, `deploy/nginx.conf`, the `ALLOWED_ORIGIN` regex in `legacy/migrate.html`, and the Traefik labels in `DEPLOY.md` — robots/sitemaps are generated.
- **Moving the source repo**: `SITE_REPO` in the manifest is the only place the GitHub URL lives — every footer, the FIRE About modal and the landings' `WebSite.publisher.sameAs` read it (`seo.test.ts` asserts every prerendered page links to it). Also update `package.json` `repository`.
