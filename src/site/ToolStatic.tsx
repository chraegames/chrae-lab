// PURE no-JS fallback prerendered into a tool page's #root. The tool's own
// createRoot().render() replaces it on mount (never hydrated). Gives crawlers
// and no-JS visitors the tool's name + description instead of an empty div.

import { SITE_REPO, siteOf, type SiteEntry } from './manifest';
import { ToolAbout } from './ToolAbout';
import { accentFor } from './accent';

export function ToolStatic({ entry }: { entry: SiteEntry }) {
  return (
    <div style={accentFor(entry.category)}>
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: 'clamp(40px, 8vw, 80px) var(--page-pad-x) 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--ink-3)',
            textDecoration: 'none',
          }}
        >
          {siteOf(entry).name}
        </a>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            fontSize: 'clamp(38px, 4.6vw, 68px)',
            letterSpacing: '-0.03em',
            lineHeight: 1.02,
            color: 'var(--ink)',
            margin: 0,
          }}
        >
          {entry.name}
        </h1>
        <p style={{ fontSize: 'clamp(15px, 2.4vw, 18px)', color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
          {entry.description}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.75, color: 'var(--ink-muted)', margin: 0 }}>
          This tool needs JavaScript to run. Nothing is sent to a server — it works entirely in your
          browser. The code is open source:{' '}
          <a href={SITE_REPO} style={{ color: 'var(--ink-2)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            view it on GitHub
          </a>
          .
        </p>
      </div>
      <ToolAbout entry={entry} />
    </div>
  );
}
