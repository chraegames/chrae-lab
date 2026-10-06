# Deploying Chrae Lab (fin_plan) to a Hostinger VPS (Traefik + Docker)

Three static sites built from one repo — no backend, no secrets, all state in `localStorage`. `npm run build` outputs `dist/fire`, `dist/games`, `dist/tools` (one per subdomain) and `dist/legacy` (what the old apex still serves). One nginx container serves all of them, choosing by `Host` (`deploy/nginx.conf`).

This VPS was provisioned from Hostinger's **Traefik** application template, so it already has Docker running and Traefik handling :80/:443 + automatic Let's Encrypt. We deploy by running a tiny `nginx:alpine` container alongside Traefik, with the built `dist/` directory bind-mounted in. Per-deploy work is just `npm run build` + `rsync`.

This guide covers (a) one-time VPS setup, (b) per-deploy workflow, (c) what's realistic for "hiding" the code.

---

## Part A — One-time VPS setup

### A.1 Confirm the environment
```bash
sudo docker ps                              # should show traefik-traefik-1
sudo docker network ls                      # bridge / host / none
sudo docker inspect traefik-traefik-1 \
  --format '{{json .Config.Cmd}}'           # entrypoints + cert resolver
```
Expected: Traefik on the default `bridge` network, entrypoints `web` (:80) and `websecure` (:443), cert resolver named `letsencrypt`.

### A.2 Harden SSH and create a deploy user (from local machine)
```bash
# Generate a key if you don't have one
ssh-keygen -t ed25519 -C "fin_plan-deploy"

# Copy public key to the VPS
ssh-copy-id root@<VPS_IP>

# SSH in and create a non-root deploy user that can run docker
ssh root@<VPS_IP>
adduser deploy
usermod -aG sudo,docker deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

Then edit `/etc/ssh/sshd_config` and set:
```
PasswordAuthentication no
PermitRootLogin no
```
Apply: `sudo systemctl restart ssh`. **Keep the original root session open while you verify the new `deploy` user can SSH in** — don't lock yourself out.

### A.3 DNS first (before starting the container)
Traefik requests a Let's Encrypt cert for every host on first start, which only works if each name already resolves to the VPS. `A` records:

| Type | Name     | Value      | Serves                                                    |
|------|----------|------------|-----------------------------------------------------------|
| A    | fire     | <VPS_IP>   | `fire.chraegames.cloud` — FIRE planner + guides           |
| A    | games    | <VPS_IP>   | `games.chraegames.cloud` — games landing + games          |
| A    | tools    | <VPS_IP>   | `tools.chraegames.cloud` — tools landing + tools          |
| A    | @        | <VPS_IP>   | `chraegames.cloud` — 301s every page + the storage bridge |
| A    | www      | <VPS_IP>   | 301s, same as the apex                                     |
| A    | fireplan | <VPS_IP>   | legacy; 301 → `fire.chraegames.cloud/…`                   |
| A    | stats    | <VPS_IP>   | Umami (Part D)                                             |

Wait for propagation: `dig fire.chraegames.cloud +short` (and games, tools) should return the VPS IP. **Keep `@`, `www` and `fireplan` for good**: they carry the redirects and the apex also serves `/migrate.html`, which the new sites use once per browser to copy over saved data (see Part E).

### A.4 Project directory on the VPS
As the `deploy` user:
```bash
mkdir -p /opt/fin_plan/dist
cd /opt/fin_plan
```

### A.5 `docker-compose.yml`
Create `/opt/fin_plan/docker-compose.yml`:

```yaml
services:
  fin_plan:
    image: nginx:alpine
    container_name: fin_plan
    restart: unless-stopped
    network_mode: bridge          # same network as Traefik
    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    labels:
      - "traefik.enable=true"
      - "traefik.http.services.fin_plan.loadbalancer.server.port=80"
      # Every host goes to this container; nginx picks the site (or the 301) by Host.
      - "traefik.http.routers.chrae.rule=Host(`fire.chraegames.cloud`) || Host(`games.chraegames.cloud`) || Host(`tools.chraegames.cloud`) || Host(`chraegames.cloud`) || Host(`www.chraegames.cloud`) || Host(`fireplan.chraegames.cloud`)"
      - "traefik.http.routers.chrae.entrypoints=websecure"
      - "traefik.http.routers.chrae.tls=true"
      - "traefik.http.routers.chrae.tls.certresolver=letsencrypt"
```

Notes:
- All redirects now live in nginx (`deploy/nginx.conf`), so there are no Traefik redirect middlewares any more. If you are upgrading from the single-site setup, delete the old `hub` / `fireplan_legacy` routers and the `www-to-apex` / `fireplan-to-hub` middlewares — leaving them would 301 the apex to itself instead of to the new sites.
- Labels only take effect on container (re)creation: `docker compose up -d` after editing.
- Traefik's existing config auto-redirects HTTP→HTTPS, so you don't need a separate router for :80.

### A.6 `nginx.conf`
Copy the repo's `deploy/nginx.conf` to `/opt/fin_plan/nginx.conf` (it is the source of truth — `scripts/nginx.test.ts` replays every pre-split URL through its redirect map):

```bash
scp deploy/nginx.conf deploy@<VPS_IP>:/opt/fin_plan/nginx.conf
```

What it does: one server block for `fire.` / `games.` / `tools.` with `root /usr/share/nginx/html/<site>` (immutable `/assets/`, `index.html` → directory 301, real 404s with each site's own `404.html`, gzip); one for the apex / `www` / `fireplan` that 301s everything to the new URL except `/migrate.html` (framable only by the three subdomains) and `/robots.txt`; and a catch-all that drops unknown hosts.

### A.7 Initial build + first start
From local:
```bash
cd /Users/hsung/Projects/fin_plan
npm run build
rsync -avz --delete dist/ deploy@<VPS_IP>:/opt/fin_plan/dist/
```
(`dist/` holds `fire/`, `games/`, `tools/` and `legacy/`; rsync them together.)

On the VPS:
```bash
cd /opt/fin_plan
docker compose up -d
docker compose logs -f fin_plan        # confirm it boots
docker logs traefik-traefik-1 --tail 50 # watch for cert issuance
```

Traefik should detect the new container via Docker labels within a few seconds and request a Let's Encrypt cert. First request can take 30–60 seconds.

### A.8 Firewall (if not already configured)
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Part B — Per-deploy workflow (from local)

```bash
cd /Users/hsung/Projects/fin_plan
npm run build
rsync -avz --delete dist/ deploy@<VPS_IP>:/opt/fin_plan/dist/
```

That's it. The `dist/` is bind-mounted read-only into nginx, so the new files are served immediately — no container restart needed. (If you changed `nginx.conf`, reload it: `docker exec fin_plan nginx -s reload`.) The long-cache `/assets/*` headers are safe because Vite hashes every filename, and `index.html`'s `no-cache` header ensures browsers always pick up the new hashes.

**Optional convenience** — add an `~/.ssh/config` alias so you can type a short name instead of the IP:
```
Host fin_plan-vps
    HostName <VPS_IP>
    User deploy
    IdentityFile ~/.ssh/id_ed25519
```
Then: `rsync -avz --delete dist/ fin_plan-vps:/opt/fin_plan/dist/`.

---

## Part C — About hiding the code

Client-side JavaScript is fundamentally inspectable. Anyone who opens DevTools can see your bundle. The choices are about *cost of reading*, not *prevention*.

What you already have with default Vite:
- Minification (short variable names, dead code elimination)
- No source maps in production (Vite default — already off)
- Tree-shaking removes unused code

This is industry-standard for SPAs. Reading minified Vite output is annoying but not hard for someone who cares.

**Why heavier obfuscation isn't worth it for this app**:
- The "secret sauce" is `src/engine/*` — tax brackets (public IRS data), withdrawal math (published finance literature). There's nothing proprietary an obfuscator can hide that a competent reader couldn't reproduce from a textbook.
- Obfuscation costs: 2–3× bundle size, measurable runtime slowdown, harder for *you* to debug production issues, and occasionally introduces bugs of its own.

**If you ever want real protection**: move the engine to a backend API (server runs the math, browser sends inputs and receives a result). Easy to add later given the Traefik setup — you'd just run a second container with a label `traefik.http.routers.api.rule=Host(`api.your-domain.com`)` and proxy traffic to it. For a personal finance planner, the trade-off doesn't pencil out.

---

## Part D — Analytics (self-hosted Umami)

[Umami](https://umami.is/) is open source, cookie-less, and runs as two containers (Umami + Postgres) on the same VPS, fronted by Traefik on a `stats.<your-domain>` subdomain. No tracking script ever leaves your VPS, no third party sees visitors, no consent banner needed.

### D.1 DNS — add a subdomain
Add another `A` record pointing at the VPS:

| Type | Name  | Value      |
|------|-------|------------|
| A    | stats | <VPS_IP>   |

Wait for `dig stats.chraegames.cloud +short` to return the VPS IP before continuing (Traefik needs DNS to resolve to request the cert).

### D.2 Project directory
```bash
mkdir -p /opt/umami
cd /opt/umami
```

### D.3 `docker-compose.yml`
Create `/opt/umami/docker-compose.yml`. **Before starting**, generate two strong secrets and substitute them below (`openssl rand -hex 32` is fine for both):

```yaml
services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    container_name: umami
    restart: unless-stopped
    networks:
      - umami_net
    environment:
      DATABASE_URL: postgresql://umami:REPLACE_DB_PASSWORD@umami-db:5432/umami
      DATABASE_TYPE: postgresql
      APP_SECRET: REPLACE_APP_SECRET
    depends_on:
      umami-db:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=umami_umami_net"
      - "traefik.http.routers.umami.rule=Host(`stats.chraegames.cloud`)"
      - "traefik.http.routers.umami.entrypoints=websecure"
      - "traefik.http.routers.umami.tls=true"
      - "traefik.http.routers.umami.tls.certresolver=letsencrypt"
      - "traefik.http.services.umami.loadbalancer.server.port=3000"

  umami-db:
    image: postgres:16-alpine
    container_name: umami-db
    restart: unless-stopped
    networks:
      - umami_net
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: REPLACE_DB_PASSWORD
    volumes:
      - ./pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U umami -d umami"]
      interval: 5s
      timeout: 5s
      retries: 10

networks:
  umami_net:
```

**Why not `network_mode: bridge`?** The literal Docker default bridge doesn't provide DNS resolution between containers — `umami` would fail to resolve `umami-db`. A user-defined network (`umami_net`) gives the two services name-based DNS while still letting Traefik route to Umami once it's attached to the same network (see D.4 step 2).

### D.4 First start

Compose will create `umami_net` automatically (named `umami_umami_net` since the project directory is `umami`).

```bash
cd /opt/umami
docker compose up -d
docker compose logs -f umami-db    # wait for "database system is ready to accept connections"
docker compose logs -f umami       # wait for "Listening on port 3000"
```

Now the question of how Traefik reaches Umami depends on which network mode Traefik is using. Check with:

```bash
docker inspect traefik-traefik-1 --format '{{.HostConfig.NetworkMode}}'
```

**If it prints `host`** (Hostinger Traefik template default): nothing else to do. Traefik runs in the host's network namespace and can reach any Docker bridge IP directly. The `traefik.docker.network=umami_umami_net` label in the compose file tells Traefik which of Umami's IPs to use. ✅

**If it prints `bridge` or a named network**: Traefik needs to be on the same network as Umami so it can talk to it. Run once:
```bash
docker network connect umami_umami_net traefik-traefik-1
```
Docker persists this across reboots.

Verify Traefik discovered the router either way:
```bash
docker logs traefik-traefik-1 --tail 100 | grep -i umami
```

**Sanity check** — hit the Umami container directly from the host:
```bash
UMAMI_IP=$(docker inspect umami --format '{{(index .NetworkSettings.Networks "umami_umami_net").IPAddress}}')
curl -I http://$UMAMI_IP:3000      # expect 200 or 3xx
```

**If you already ran `docker compose up -d` with the old `network_mode: bridge` config and saw the DB connection error**:
```bash
cd /opt/umami
docker compose down
# (replace docker-compose.yml with the version in D.3)
docker compose up -d
```
The healthcheck-gated `depends_on` ensures Umami waits for Postgres on this attempt.

### D.5 Initial admin login
1. Open `https://stats.chraegames.cloud`.
2. Log in with `admin` / `umami`.
3. **Immediately change the password** under "Profile → Change password" — this account is internet-reachable.
4. Settings → Websites → **Add website** → name "fin_plan", domain "chraegames.cloud" → Save.
5. Click the website's **"Edit"** → copy the **Website ID** (a UUID).

### D.6 Wire the tracking script
The tracking script is injected by `src/utils/analytics.ts` at runtime, only when the page is **not** running on localhost AND both env vars are set. This means `npm run dev` and `vite preview` never pollute the production stats.

Edit `.env.production` in the repo root:

```
VITE_UMAMI_HOST=stats.chraegames.cloud
VITE_UMAMI_WEBSITE_ID=<UUID from D.5>
```

Then rebuild and redeploy (Part B). Vite bakes these values into the production bundle at build time.

**To disable analytics**: leave either var blank in `.env.production` and rebuild — the script is never injected and `track()` calls no-op.

### D.7 Verify
- Load `https://fire.chraegames.cloud` → in Umami's **Realtime** view, you should appear within ~30 seconds.
- DevTools → Network: `https://stats.chraegames.cloud/api/send` returns 200 on page load and on each tracked action (preset loaded, plan created, theme toggled, drawer opened, export, import, auto-balance, history opened).
- DevTools → Application → Cookies: empty for both `chraegames.cloud` and `stats.chraegames.cloud` — Umami is cookie-less by design.

### D.8 Custom events at a glance
The app sends these events (see `src/utils/analytics.ts` for the wrapper and `src/App.tsx` for the call sites):

| Event              | Where it fires                              |
|--------------------|---------------------------------------------|
| `preset_loaded`    | Welcome screen → preset chosen (Coast/Mid/Approaching) |
| `plan_built`       | Welcome screen → "Build" button             |
| `skip_to_advanced` | Welcome → "Skip to advanced"                |
| `plan_created`     | New scenario tab                            |
| `profile_created`  | New profile                                 |
| `auto_balance_run` | Auto-balance button                         |
| `drawer_opened`    | Any of the editor drawers (with `{ kind }`) |
| `history_opened`   | Switching to the History page               |
| `export_downloaded`| Export modal → Download                     |
| `import_applied`   | Import modal → Apply                        |
| `theme_toggled`    | Theme switch (with `{ theme }`)             |

All `track()` calls no-op if `window.umami` isn't loaded (script blocked, dev server, network failure), so analytics can never break the app.

---

## Part E — The three-site split (chraegames.cloud → fire. / games. / tools.)

Cut over on 2026-10-06 and verified in production. Kept as the reference for what the legacy hosts do and how to retire them. (The earlier `fireplan.` → hub move is in git history.)

The single hub was split so each audience gets its own site (and its own sitemap, Search Console property and topical focus). Old URL → new URL:

| Old | New |
|-----|-----|
| `chraegames.cloud/` (hub) | `tools.chraegames.cloud/` |
| `chraegames.cloud/fire-planner/…` | `fire.chraegames.cloud/…` |
| `chraegames.cloud/{sudoku,bingo,go,magic-tower,city}/` | `games.chraegames.cloud/<same>/` |
| `chraegames.cloud/{unit-converter,calculator,todo,tv-guide/…}/` | `tools.chraegames.cloud/<same>/` |
| `fireplan.chraegames.cloud/…` | `fire.chraegames.cloud/…` |

**Saved data.** `localStorage` is per origin, so the new sites start empty. On a visitor's first load, each site opens `https://chraegames.cloud/migrate.html` in a hidden iframe, asks for its own keys, copies any it doesn't have yet, and never asks again (`src/site/legacyStorage.ts`, `legacy/migrate.html`). That is why the apex must keep resolving and serving `/migrate.html` for at least several months.

Cut-over, in order:

1. **DNS** — add `fire`, `games`, `tools` A records (A.3). Keep `@`, `www`, `fireplan`, `stats`. Wait until all three resolve.
2. **nginx + Traefik** — copy `deploy/nginx.conf` (A.6), replace the compose labels with A.5, then `docker compose up -d`. Watch `docker logs traefik-traefik-1 --tail 50` for the new certs.
3. **Deploy** — `npm run build && rsync -avz --delete dist/ deploy@<VPS_IP>:/opt/fin_plan/dist/`.
4. **Check**:
   ```bash
   for h in fire games tools; do curl -sI https://$h.chraegames.cloud/ | head -1; done     # 200 ×3
   curl -sI https://chraegames.cloud/fire-planner/how-it-works/ | grep -i location   # → https://fire.chraegames.cloud/how-it-works/
   curl -sI https://chraegames.cloud/sudoku/ | grep -i location                      # → https://games.chraegames.cloud/sudoku/
   curl -sI https://chraegames.cloud/ | grep -i location                             # → https://tools.chraegames.cloud/
   curl -sI https://fireplan.chraegames.cloud/4-percent-rule/ | grep -i location    # → https://fire.chraegames.cloud/4-percent-rule/
   curl -sI https://chraegames.cloud/migrate.html | grep -i -e '^HTTP' -e frame-ancestors   # 200 + CSP
   curl -s https://games.chraegames.cloud/sitemap.xml | grep -c '<loc>'              # 6
   ```
   Then in a browser that has data on the old site, open `https://chraegames.cloud/fire-planner/` — you should land on `fire.` with your plans.
5. **Google Search Console** — the existing *Domain* property `chraegames.cloud` already covers every subdomain; additionally add URL-prefix (or Domain) properties for `https://fire.chraegames.cloud`, `https://games.chraegames.cloud` and `https://tools.chraegames.cloud` so each gets its own reports, and submit each site's `/sitemap.xml`. Use **Change of Address** from the old `https://chraegames.cloud` URL-prefix property → `https://fire.chraegames.cloud` (the planner carries most of the traffic; Change of Address takes a single target — the per-page 301s handle games and tools). Remove the old sitemap submission.
6. **Bing Webmaster Tools** — add the three sites (import from Search Console) and submit their sitemaps.
7. **Umami** — the same website ID keeps working on all subdomains; pages show up by path, so add a *hostname* filter to tell sites apart, or create one website per site and switch `.env.production` to per-site IDs later.

### Retiring the legacy hosts

The apex, `www.` and `fireplan.` only exist for old links and the one-time data import. Don't remove them early: search engines need to keep seeing the 301s for months to move rankings over, and a visitor who returns after a long gap only gets their saved data if `/migrate.html` still answers.

| Host | Earliest removal | Why |
|------|------------------|-----|
| `fireplan.chraegames.cloud` | 2027-02-21 | moved away 2026-08-21; 6 months of 301s by then |
| `chraegames.cloud`, `www.` | 2027-10-06 | a year of 301s, and a year for returning visitors to pick up their data |

To retire a host:
1. Remove it from the Traefik `Host(...)` rule (A.5) and from `server_name` in `deploy/nginx.conf`. When retiring the apex, also delete `legacy/`, `src/site/legacyStorage.ts` and its calls in the app entry points, the `legacy` step in `build:sites`, the `legacy_target` map and the apex `server` block in `deploy/nginx.conf`, and `scripts/nginx.test.ts` / `scripts/legacyBridge.test.ts`.
2. Deploy, then `docker compose up -d` on the VPS.
3. Delete the DNS record.
4. Remove the matching property from Search Console / Bing Webmaster Tools — but keep the Domain property `chraegames.cloud`, which covers the subdomains.

## Verification

1. **Build smoke test (local)**:
   ```bash
   npm run build
   npx vite preview        # serves dist/ on http://localhost:4173
   ```
   Click around (add a profile, run a simulation, toggle history).

2. **First deploy + cert**:
   - `docker compose up -d` on the VPS should produce no errors.
   - `docker logs traefik-traefik-1 | grep -i acme` should show successful certificate issuance.
   - `https://chraegames.cloud` loads with a valid cert (no browser warning).
   - `http://chraegames.cloud` redirects to HTTPS (Traefik's built-in redirect).

3. **Headers + caching**:
   - DevTools → Network: assets in `/assets/` show `Cache-Control: public, immutable`.
   - `index.html` shows `Cache-Control: no-cache, must-revalidate`.
   - Response includes `Content-Encoding: gzip` for text resources.

4. **State persistence**:
   - DevTools → Application → Local Storage: confirm app state survives a hard refresh.

5. **Re-deploy smoke test**:
   - Make a trivial UI change (e.g., a label), rebuild, rsync, hard-refresh. New bundle hash, new content visible. Old asset files in `/opt/fin_plan/dist/assets/` cleaned up by `rsync --delete`.

6. **Container health**:
   ```bash
   docker compose ps                # fin_plan should be "running"
   docker compose logs --tail 50 fin_plan
   ```

---

## Troubleshooting

**Cert doesn't issue / 404 from Traefik**:
- `dig chraegames.cloud +short` returns the VPS IP? If not, DNS hasn't propagated.
- `docker logs traefik-traefik-1 --tail 100` — look for ACME errors. The most common cause is the domain not resolving yet.
- The label `Host()` value must match exactly what's in the browser URL bar (including/excluding `www`).

**`docker compose` not found**:
- Older Docker installs use `docker-compose` (with hyphen). Both work; if neither is installed, `sudo apt install docker-compose-plugin`.

**Permission denied on rsync target**:
- The `/opt/fin_plan` directory must be owned by `deploy` (`sudo chown -R deploy:deploy /opt/fin_plan`).

**Need to restart the container**:
- You almost never need to. `rsync` updates the bind-mounted files in place and nginx picks them up. Only restart if you edit `nginx.conf` or `docker-compose.yml`: `docker compose up -d` (re-creates only what changed).
