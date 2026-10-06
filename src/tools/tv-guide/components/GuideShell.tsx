// The guide's chrome, shared by the prerendered (build-time) and live trees.
// PURE: no hooks, no browser APIs, no CSS imports. The live app passes a
// hooked <ThemeToggle/> through `themeToggle`; the static tree passes nothing.
//
// Header = breadcrumb row (crumb | updated pill + theme toggle) over an
// underline tab bar; content column below; About/related links + footer.

import type { ReactNode } from 'react';
import { SITE_REPO, breadcrumbs, relatedTools, siteOf, type SiteEntry } from '../../../site/manifest';
import { ToolAbout } from '../../../site/ToolAbout';
import { accentFor } from '../../../site/accent';
import { GUIDE_ENTRY, GUIDE_PAGES, type GuidePageId } from '../pages';
import { GUIDE_STYLES } from './styles';
import { UpdatedBadge } from './UpdatedBadge';

interface GuideShellProps {
  page: GuidePageId;
  entry: SiteEntry;
  children: ReactNode;
  themeToggle?: ReactNode;
  /** Amber header row on localhost (mirrors ToolShell). */
  local?: boolean;
}

export function GuideShell({ page, entry, children, themeToggle, local = false }: GuideShellProps) {
  const trail = breadcrumbs(entry);
  const related = relatedTools(GUIDE_ENTRY);
  const site = siteOf(GUIDE_ENTRY);
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', ...accentFor(GUIDE_ENTRY.category) }}>
      <style>{GUIDE_STYLES}</style>

      <div className="tvg-wrap" style={{ flex: 1, ...(page === 'overview' ? { paddingBottom: 0 } : null) }}>
        <header className="tvg-head">
          <div className={local ? 'tvg-head-row tvg-local' : 'tvg-head-row'}>
            <nav aria-label="Breadcrumb" className="tvg-crumb">
              {trail.map((c, i) => {
                const last = i === trail.length - 1;
                const label = c.kind === 'hub' ? site.name : c.label ?? c.name;
                return (
                  <span key={c.slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {i > 0 && <i aria-hidden="true">/</i>}
                    {last ? <b aria-current="page">{label}</b> : <a href={c.path}>{label}</a>}
                  </span>
                );
              })}
            </nav>
            <div className="tvg-head-tools">
              <UpdatedBadge />
              {themeToggle}
            </div>
          </div>
          <nav className="tvg-nav" aria-label="TV buying guide sections">
            {GUIDE_PAGES.map(p => (
              <a key={p.id} href={p.path} aria-current={p.id === page ? 'page' : undefined}>
                {p.navLabel}
              </a>
            ))}
          </nav>
        </header>

        <main style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>{children}</main>

        {page !== 'overview' && (
          <div>
            <nav
              aria-label="More tools"
              style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                More from {site.name}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px 22px', fontSize: 15 }}>
                <li>
                  <a href={GUIDE_ENTRY.path} style={{ color: 'var(--ink-2)' }}>
                    {GUIDE_ENTRY.name} overview
                  </a>
                </li>
                {related.map(t => (
                  <li key={t.slug}>
                    <a href={t.path} style={{ color: 'var(--ink-2)' }}>
                      {t.name}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="/" style={{ color: 'var(--ink-2)' }}>
                    {site.homeLabel}
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      {page === 'overview' && <ToolAbout entry={entry} />}

      <div className="tvg-wrap" style={{ paddingTop: 20 }}>
        <footer className="tvg-foot">
          <span>{site.name}</span>
          <span>Independent and not affiliated with any manufacturer. No models, specifications or prices — only how the technologies work.</span>
          <a href={SITE_REPO}>Source on GitHub</a>
        </footer>
      </div>
    </div>
  );
}
