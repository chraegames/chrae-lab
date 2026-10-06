// Shared layout + prose primitives for the static SEO content pages.
//
// PURE: no hooks, no browser APIs, inline styles + CSS variables only — so the
// whole tree renders to a static string in the Vite build (Node) context. The
// pages are content-only; they do NOT mount the React app or recharts.

import type { CSSProperties, ReactNode } from 'react';
import { CONTENT_ROUTES, FIRE_HOME_PATH } from './routeMeta';
import { SITE_REPO } from '../site/manifest';

export { H2, P, UL, LI, A } from '../site/Prose';
import { linkStyle } from '../site/proseStyles';

const crumbStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink-3)',
  textDecoration: 'none',
};

const sectionLabel: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
};

interface ContentLayoutProps {
  /** Current page slug, excluded from the "Related" cross-links. */
  slug: string;
  title: ReactNode;
  lede: ReactNode;
  children: ReactNode;
}

export function ContentLayout({ slug, title, lede, children }: ContentLayoutProps) {
  const related = CONTENT_ROUTES.filter(r => r.slug !== slug);
  const current = CONTENT_ROUTES.find(r => r.slug === slug);
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: 'var(--page-pad-top) var(--page-pad-x) var(--page-pad-bot)',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        paddingTop: 'clamp(40px, 8vw, 80px)',
      }}
    >
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href={FIRE_HOME_PATH} style={crumbStyle}>
          FIRE Planner
        </a>
        <span aria-hidden="true" style={{ ...crumbStyle, color: 'var(--ink-slash)' }}>
          /
        </span>
        <span aria-current="page" style={{ ...crumbStyle, color: 'var(--ink-2)' }}>
          {current?.label}
        </span>
      </nav>

      <header style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            fontSize: 'clamp(38px, 4.6vw, 68px)',
            letterSpacing: '-0.03em',
            lineHeight: 1.02,
            textWrap: 'pretty',
            color: 'var(--ink)',
            margin: 0,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 'clamp(15px, 2.4vw, 18px)',
            color: 'var(--ink-2)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {lede}
        </p>
      </header>

      <div>
        <a
          href={FIRE_HOME_PATH}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            height: 42,
            padding: '0 20px',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent)',
            color: 'var(--accent-contrast)',
            border: '1px solid var(--accent)',
            textDecoration: 'none',
          }}
        >
          Open the planner →
        </a>
      </div>

      <article style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {children}
      </article>

      <nav
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
        aria-label="Related guides"
      >
        <div style={sectionLabel}>Related</div>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {related.map(r => (
            <li key={r.slug} style={{ margin: 0 }}>
              <a href={r.path} style={linkStyle}>
                {r.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
          color: 'var(--ink-muted)',
          margin: 0,
        }}
      >
        Educational tool — not financial advice.{' '}
        <a href={SITE_REPO} style={{ color: 'var(--ink-2)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Source on GitHub
        </a>
      </p>
    </div>
  );
}
