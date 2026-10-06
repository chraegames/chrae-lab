// The landing page of the games and tools sites (`<Landing site="games" />`).
// PURE: no hooks, no browser APIs — it is rendered to a static string at build
// time and shipped without React. The only behaviour on the page (theme toggle)
// is wired up by src/hub/main.ts.
//
// Layout follows the Design/v3 "Night Console" handoff: header with a mono
// category nav, two-column hero with a CSS motif, one section per category
// (fixed column counts so no row ends on an empty cell), a sunken Guides band
// (only when the site has guides), an "Also from Chrae Lab" row linking the other
// two sites, and a two-column footer. Styling is a `hub-*` class block + inline tokens;
// every card, chip and row is a plain <a>.

import type { CSSProperties } from 'react';
import {
  BRAND_NAME,
  CATEGORIES,
  SITES,
  SITE_REPO,
  contentPages,
  hrefFor,
  liveTools,
  otherSites,
  siteHome,
  type CategoryId,
  type SiteEntry,
  type SiteId,
} from '../site/manifest';
import { accentFor, categoryVar } from '../site/accent';

const HUB_STYLES = `
.hub{max-width:1240px;margin:0 auto;padding:0 var(--page-pad-x)}
.hub a:not(.hub-card):hover{color:var(--accent)}
.hub-top{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:22px 0;border-bottom:1px solid var(--border)}
.hub-nav{display:flex;flex-wrap:wrap;align-items:center;gap:22px;margin-left:auto;margin-right:22px;font-family:var(--font-mono);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-3)}
.hub-nav a{color:var(--ink-3)}
.hub-hero{padding:72px 0 56px;display:grid;grid-template-columns:1.45fr 1fr;gap:56px;align-items:start;background-image:radial-gradient(circle at 82% 12%,var(--accent-tint) 0,transparent 46%)}
.hub-h1{font-family:var(--font-serif);font-size:clamp(46px,5.8vw,92px);line-height:0.98;letter-spacing:-0.03em;font-weight:400;margin:0 0 22px;color:var(--ink);text-wrap:pretty}
.hub-h1 em{font-style:italic;color:var(--accent)}
.hub-motif{height:168px;border-radius:var(--radius-md);border:1px solid var(--border-strong);background-color:var(--surface);background-image:radial-gradient(circle at 1px 1px,var(--border-strong) 1px,transparent 0);background-size:14px 14px;position:relative;overflow:hidden}
:root[data-theme=dark] .hub-motif{background-color:#0B0C0E}
.hub-motif-b{mix-blend-mode:multiply}
:root[data-theme=dark] .hub-motif-b{mix-blend-mode:screen}
.hub-section{padding:0 0 36px}
.hub-section:last-of-type{padding-bottom:48px}
.hub-sec-head{display:flex;align-items:baseline;gap:14px;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:16px}
.hub-sec-head h2{font-family:var(--font-mono);font-size:12.5px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;margin:0;color:var(--hub-accent,var(--ink-3))}
.hub-sec-head p{margin:0;font-size:15px;color:var(--ink-3)}
.hub-dot{width:8px;height:8px;border-radius:50%;background:var(--hub-accent);flex:0 0 auto;align-self:center}
.hub-grid{display:grid;gap:14px}
.hub-grid-1{grid-template-columns:1fr}
.hub-grid-2{grid-template-columns:repeat(2,1fr)}
.hub-grid-3{grid-template-columns:repeat(3,1fr)}
.hub-card{background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-md);padding:22px;min-height:196px;display:flex;flex-direction:column;gap:16px;color:inherit;text-decoration:none;transition:background 150ms ease,border-color 150ms ease}
.hub-card:hover{background:var(--surface-2);border-color:var(--hub-accent)}
.hub-card-row{padding:24px 26px;flex-direction:row;align-items:center;gap:26px;min-height:0}
.hub-card-row .hub-card-meta{order:2;margin-left:auto;align-items:center}
.hub-card-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.hub-tile{width:40px;height:40px;border-radius:var(--radius-md);background:color-mix(in srgb,var(--hub-accent) 12%,transparent);color:var(--hub-accent);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.hub-idx{font-family:var(--font-mono);font-size:11px;color:var(--ink-index)}
.hub-card h3{font-size:21px;line-height:1.15;letter-spacing:-0.02em;font-weight:500;margin:0 0 8px;color:var(--ink)}
.hub-card p{margin:0;font-size:14.5px;line-height:1.5;color:var(--ink-3)}
.hub-guides{background:var(--bg-soft);border-top:1px solid var(--border);padding:48px var(--page-pad-x);margin:0 calc(-1 * var(--page-pad-x))}
.hub-guides .hub-sec-head{margin-bottom:30px}
.hub-guide-cols{display:grid;grid-template-columns:repeat(2,1fr);gap:44px}
.hub-guide-cols h3{font-family:var(--font-serif);font-size:22px;font-weight:400;margin:0 0 12px;color:var(--ink)}
.hub-guide-list{display:flex;flex-direction:column}
.hub-guide-row{display:flex;gap:18px;align-items:baseline;padding:13px 0;border-top:1px solid var(--border);color:inherit}
.hub-guide-row:last-child{border-bottom:1px solid var(--border)}
.hub-guide-row b{font-size:16px;font-weight:500;color:var(--ink)}
.hub-guide-row span{font-size:14px;color:var(--ink-3);line-height:1.45}
.hub-guide-cols-2col .hub-guide-row b{min-width:12ch}
.hub-guide-stack .hub-guide-row{flex-direction:column;gap:4px}
.hub-foot{padding:40px 0 48px;display:grid;grid-template-columns:1fr 1.1fr;gap:44px;align-items:start;border-top:1px solid var(--border)}
.hub-foot ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px 24px}
.hub-foot li a{font-size:15px;color:var(--ink-2)}
.hub-legal{margin:0;font-family:var(--font-mono);font-size:11.5px;line-height:1.9;color:var(--ink-3)}
.hub-legal a{color:var(--ink-2);text-decoration:underline;text-underline-offset:3px}
.hub-sun,.hub-moon{display:block}
:root[data-theme=dark] .hub-sun{display:none}
:root:not([data-theme=dark]) .hub-moon{display:none}
@media (max-width:1100px){
  .hub-hero{grid-template-columns:1fr;gap:40px;padding:56px 0 44px}
  .hub-grid-3{grid-template-columns:repeat(2,1fr)}
  .hub-guide-cols,.hub-foot{grid-template-columns:1fr}
}
@media (max-width:720px){
  .hub-top{flex-wrap:wrap;gap:14px;padding:18px 0}
  .hub-nav{order:3;flex-basis:100%;gap:12px 16px;margin:0}
  .hub-sec-head{flex-wrap:wrap;gap:8px 12px}
  .hub-sec-head p{flex-basis:100%}
  .hub-hero{padding:40px 0 36px}
  .hub-grid-2,.hub-grid-3{grid-template-columns:1fr}
  .hub-card-row{flex-direction:column;align-items:stretch;padding:22px;gap:16px}
  .hub-card-row .hub-card-meta{order:0;margin-left:0;align-items:flex-start}
  .hub-guides{padding:36px var(--page-pad-x)}
  .hub-foot ul{grid-template-columns:repeat(2,1fr)}
}
`;

/** CSS-box glyph per tool (no SVG, no icon font), in the current accent. */
function HubIcon({ slug }: { slug: string }) {
  const bar = (h: string, extra?: CSSProperties): CSSProperties => ({ width: 5, height: h, background: 'currentColor', borderRadius: 1, display: 'block', ...extra });
  switch (slug) {
    case 'fire-planner':
      return (
        <span className="hub-tile" style={{ alignItems: 'flex-end', gap: 3, padding: 10 }}>
          <span style={bar('38%')} />
          <span style={bar('62%')} />
          <span style={bar('92%')} />
        </span>
      );
    case 'unit-converter':
      return (
        <span className="hub-tile">
          <span style={{ width: 15, height: 15, borderRadius: 3, background: 'currentColor', display: 'block', position: 'relative', left: 4 }} />
          <span style={{ width: 15, height: 15, borderRadius: '50%', boxShadow: 'inset 0 0 0 1.5px currentColor', display: 'block', position: 'relative', right: 4 }} />
        </span>
      );
    case 'calculator':
      return (
        <span className="hub-tile" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 7px)', gridAutoRows: 7, gap: 5, alignContent: 'center', justifyContent: 'center' }}>
          {[1, 0.45, 0.45, 1].map((o, i) => (
            <span key={i} style={{ width: 7, height: 7, background: 'currentColor', borderRadius: 1.5, display: 'block', opacity: o }} />
          ))}
        </span>
      );
    case 'tv-guide':
      return (
        <span className="hub-tile" style={{ flexDirection: 'column', gap: 4 }}>
          <span style={{ width: 23, height: 14, borderRadius: 2.5, background: 'currentColor', display: 'block' }} />
          <span style={{ width: 11, height: 2, background: 'currentColor', opacity: 0.5, display: 'block' }} />
        </span>
      );
    case 'todo':
      return (
        <span className="hub-tile" style={{ flexDirection: 'column', gap: 5 }}>
          {[1, 0.55, 0.28].map((o, i) => (
            <span key={i} style={{ width: 19, height: 5, borderRadius: 2, background: 'currentColor', opacity: o, display: 'block' }} />
          ))}
        </span>
      );
    case 'sudoku':
      return (
        <span className="hub-tile" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 6px)', gridAutoRows: 6, gap: 3, alignContent: 'center', justifyContent: 'center' }}>
          {[1, 0.3, 0.3, 0.3, 1, 0.3, 0.3, 0.3, 1].map((o, i) => (
            <span key={i} style={{ width: 6, height: 6, background: 'currentColor', borderRadius: 1, display: 'block', opacity: o }} />
          ))}
        </span>
      );
    case 'bingo':
      return (
        <span className="hub-tile">
          <span
            style={{
              width: 23,
              height: 23,
              borderRadius: '50%',
              background: 'currentColor',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bg)' }}>42</span>
          </span>
        </span>
      );
    case 'go':
      // a black and a white stone
      return (
        <span className="hub-tile" style={{ gap: 3 }}>
          <span style={{ width: 13, height: 13, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
          <span style={{ width: 13, height: 13, borderRadius: '50%', boxShadow: 'inset 0 0 0 1.5px currentColor', display: 'block' }} />
        </span>
      );
    case 'magic-tower':
      return (
        <span className="hub-tile" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 6px)', gridAutoRows: 6, gap: 2, alignContent: 'center', justifyContent: 'center' }}>
          {[0.3, 1, 0.3, 0.3, 1, 0.3, 1, 1, 1].map((o, i) => (
            <span key={i} style={{ width: 6, height: 6, background: 'currentColor', borderRadius: 1, display: 'block', opacity: o }} />
          ))}
        </span>
      );
    case 'city':
      // a skyline: four towers of different heights on a baseline
      return (
        <span className="hub-tile" style={{ alignItems: 'flex-end', gap: 2, padding: '8px 9px' }}>
          <span style={bar('45%', { width: 6, opacity: 0.7 })} />
          <span style={bar('85%', { width: 6 })} />
          <span style={bar('60%', { width: 6 })} />
          <span style={bar('30%', { width: 6, opacity: 0.7 })} />
        </span>
      );
    case 'games':
      // a d-pad
      return (
        <span className="hub-tile" style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', width: 7, height: 21, background: 'currentColor', borderRadius: 1.5, display: 'block' }} />
          <span style={{ position: 'absolute', width: 21, height: 7, background: 'currentColor', borderRadius: 1.5, display: 'block' }} />
        </span>
      );
    case 'tools':
      // a ruler
      return (
        <span className="hub-tile">
          <span style={{ width: 24, height: 10, borderRadius: 2, boxShadow: 'inset 0 0 0 1.5px currentColor', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-evenly', padding: '0 2px' }}>
            {[5, 3, 5, 3, 5].map((h, i) => (
              <span key={i} style={{ width: 1.5, height: h, background: 'currentColor', display: 'block' }} />
            ))}
          </span>
        </span>
      );
    default:
      return <span className="hub-tile" />;
  }
}

function ToolCard({ entry, href, index, row }: { entry: SiteEntry; href: string; index?: number; row: boolean }) {
  return (
    <a href={href} className={row ? 'hub-card hub-card-row' : 'hub-card'}>
      <div className="hub-card-meta">
        <HubIcon slug={entry.slug} />
        {index !== undefined && <span className="hub-idx">{String(index).padStart(2, '0')}</span>}
      </div>
      <div>
        <h3>{entry.name}</h3>
        <p>{entry.tagline}</p>
      </div>
    </a>
  );
}

/** The site's live content pages grouped under their parent app, in manifest order. */
function guideGroups(site: SiteId): { parent: SiteEntry; pages: SiteEntry[] }[] {
  return liveTools(site)
    .map(parent => ({ parent, pages: contentPages(site).filter(g => g.area === parent.slug) }))
    .filter(g => g.pages.length > 0);
}

/** Per-site hero copy; titles/descriptions live in the manifest. */
const COPY: Record<'games' | 'tools', { eyebrow: string; sub: string; intro: string }> = {
  tools: {
    eyebrow: 'Free · Private · No accounts',
    sub: 'Free, private, no accounts — everything stays on your device.',
    intro:
      'Chrae Tools is a collection of free online tools: a unit converter, a scientific calculator, a to-do list and a TV buying guide. Each one runs entirely in your browser — no sign-up, no ads, and nothing sent to a server.',
  },
  games: {
    eyebrow: 'Free · No download · No ads',
    sub: 'Open a tab and play. Progress saves on your device.',
    intro:
      'Chrae Games is a shelf of free browser games: Sudoku with notes and hints, a bingo number caller, online Go against a friend, the Magic Tower puzzle RPG and a 3D city builder. Nothing to install, no account, and saves stay in your browser.',
  },
};

/** Split the tagline so its closing clause can be set in italic accent. */
function Headline({ text }: { text: string }) {
  const clause = 'in your browser.';
  if (!text.endsWith(clause)) return <>{text}</>;
  return (
    <>
      {text.slice(0, -clause.length)}
      <em>{clause}</em>
    </>
  );
}

export function Landing({ site }: { site: 'games' | 'tools' }) {
  const home = siteHome(site);
  const name = SITES[site].name;
  const copy = COPY[site];
  const tools = liveTools(site);
  const toolsOf = (category: CategoryId) => tools.filter(t => t.category === category);
  const categories = CATEGORIES.filter(cat => toolsOf(cat.id).length > 0);
  const guides = guideGroups(site);
  const others = otherSites(site);
  // Cards are numbered 01..N in display order (category order, then manifest order).
  const indexOf = new Map(categories.flatMap(cat => toolsOf(cat.id)).map((t, i) => [t.slug, i + 1]));
  const [motifA, motifB = motifA] = categories.map(c => c.id);
  return (
    <div className="hub" style={accentFor(site === 'games' ? 'games' : 'utilities')}>
      <style>{HUB_STYLES}</style>

      <header className="hub-top">
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, color: 'inherit' }}>
          <span style={{ width: 22, height: 22, borderRadius: 3, background: 'var(--accent)', display: 'block' }} aria-hidden="true" />
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{name}</span>
        </a>
        <nav className="hub-nav" aria-label="Sections">
            {categories.length > 1 &&
              categories.map(cat => (
                <a key={cat.id} href={`#${cat.id}`}>
                  {cat.name}
                </a>
              ))}
            {guides.length > 0 && <a href="#guides">Guides</a>}
            <a href="#more">More from {BRAND_NAME}</a>
        </nav>
        <button
            type="button"
            data-theme-toggle
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <svg className="hub-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <svg className="hub-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          </button>
      </header>

      <section className="hub-hero">
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: 26,
            }}
          >
            {copy.eyebrow}
          </div>
          <h1 className="hub-h1">
            <Headline text={home.tagline} />
          </h1>
          <p style={{ fontSize: 20, lineHeight: 1.45, color: 'var(--ink-2)', margin: 0, maxWidth: '34ch' }}>
            {copy.sub}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="hub-motif" aria-hidden="true">
            <span style={{ position: 'absolute', left: 34, top: 34, width: 72, height: 72, borderRadius: '50%', background: categoryVar(motifA), display: 'block' }} />
            <span className="hub-motif-b" style={{ position: 'absolute', left: 78, top: 58, width: 72, height: 72, borderRadius: '50%', background: categoryVar(motifB), display: 'block' }} />
            <span style={{ position: 'absolute', right: 26, bottom: 26, width: 52, height: 52, borderRadius: 3, boxShadow: `inset 0 0 0 1px ${categoryVar(site === 'games' ? 'utilities' : 'games')}`, display: 'block' }} />
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.75, color: 'var(--ink-3)', margin: 0 }}>
            {copy.intro}
          </p>
        </div>
      </section>

      {categories.map(cat => {
        const inCat = toolsOf(cat.id);
        const cols = inCat.length === 1 ? 1 : inCat.length === 2 ? 2 : 3;
        const accent = { '--hub-accent': categoryVar(cat.id) } as CSSProperties;
        return (
          <section key={cat.id} id={cat.id} className="hub-section" style={accent}>
            <div className="hub-sec-head">
              <span className="hub-dot" aria-hidden="true" />
              <h2>{cat.name}</h2>
              <p>{cat.blurb}</p>
            </div>
            <div className={`hub-grid hub-grid-${cols}`}>
              {inCat.map(t => (
                <ToolCard key={t.slug} entry={t} href={t.path} index={indexOf.get(t.slug) ?? 0} row={inCat.length === 1} />
              ))}
            </div>
          </section>
        );
      })}

      {guides.length > 0 && (
      <section id="guides" className="hub-guides" aria-labelledby="hub-guides">
        <div className="hub-sec-head">
          <h2 id="hub-guides">Guides</h2>
          <p>Short reads that go with the tools — no app needed.</p>
        </div>
        <div className="hub-guide-cols">
          {guides.map(({ parent, pages }) => {
            const stacked = pages.some(g => g.tagline.length > 40);
            return (
              <div key={parent.slug} className={stacked ? 'hub-guide-stack' : 'hub-guide-cols-2col'}>
                <h3>
                  <a href={parent.path} style={{ color: 'inherit' }}>
                    {parent.name}
                  </a>
                </h3>
                <div className="hub-guide-list">
                  {pages.map(g => (
                    <a key={g.slug} href={g.path} className="hub-guide-row">
                      <b>{g.name}</b>
                      <span>{g.tagline}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      <section id="more" className="hub-section hub-more" aria-labelledby="hub-more">
        <div className="hub-sec-head">
          <h2 id="hub-more">More from {BRAND_NAME}</h2>
          <p>Our other sites — same idea, everything runs on your device.</p>
        </div>
        <div className="hub-grid hub-grid-2">
          {others.map(o => (
            <div key={o.slug} style={{ display: 'contents', ...({ '--hub-accent': categoryVar(o.site === 'fire' ? 'finance' : o.site === 'games' ? 'games' : 'utilities') } as CSSProperties) }}>
              <ToolCard entry={o} href={hrefFor(o, site)} row={false} />
            </div>
          ))}
        </div>
      </section>

      <footer className="hub-foot">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
            <span style={{ width: 18, height: 18, borderRadius: 3, background: 'var(--accent)', display: 'block' }} aria-hidden="true" />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{name}</span>
          </div>
          <p className="hub-legal">
            Free, with no accounts and no ads — everything runs in your browser.
            <br />
            Analytics are cookie-less and self-hosted.
            <br />
            Open source: <a href={SITE_REPO}>view the code on GitHub</a>.
          </p>
        </div>
        <nav aria-label={SITES[site].homeLabel}>
          <ul>
            {tools.map(t => (
              <li key={t.slug}>
                <a href={t.path}>{t.name}</a>
              </li>
            ))}
            {others.map(o => (
              <li key={o.slug}>
                <a href={hrefFor(o, site)}>{o.name}</a>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </div>
  );
}
