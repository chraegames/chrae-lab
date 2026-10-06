// Shared chrome for every games/tools page: sticky header with the site-home
// crumb + tool name + theme toggle, a centred content column, and a footer.
// Tools render <ToolShell entry={bySlug('calculator')}>…</ToolShell>.

import type { ReactNode } from 'react';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';
import { useTheme } from '../../hooks/useTheme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { isLocalHost } from '../../utils/env';
import { SITE_REPO, siteOf, type SiteEntry } from '../../site/manifest';
import { ToolAbout } from '../../site/ToolAbout';
import { accentFor } from '../../site/accent';

interface ToolShellProps {
  entry: SiteEntry;
  children: ReactNode;
  /** Extra controls rendered left of the theme toggle. */
  rightSlot?: ReactNode;
  maxWidth?: number;
  /**
   * 'column' (default): a centred, padded content column.
   * 'full': the tool owns the first viewport edge to edge (no padding, no max
   * width, at least the viewport height minus the header); About + footer
   * still follow below.
   */
  layout?: 'column' | 'full';
}

export function ToolShell({ entry, children, rightSlot, maxWidth = 760, layout = 'column' }: ToolShellProps) {
  const { theme, toggle } = useTheme();
  const isMobile = useIsMobile();
  const local = isLocalHost();

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', ...accentFor(entry.category) }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(12px, 3vw, 32px)',
          height: 56,
          background: local ? '#f59e0b' : 'var(--bg)',
          borderBottom: local ? '1px solid #b45309' : '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <a
            href="/"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: local ? '#1c1917' : 'var(--ink-3)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {siteOf(entry).name}
          </a>
          <span aria-hidden="true" style={{ color: local ? '#b45309' : 'var(--ink-slash)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            /
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 17,
              letterSpacing: '-0.015em',
              color: local ? '#1c1917' : 'var(--ink)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {entry.name}
          </h1>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {rightSlot}
          <Button
            variant="ghost"
            size="md"
            onClick={toggle}
            leading={<Icon name={theme === 'dark' ? 'sun' : 'moon'} />}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            aria-label="Toggle theme"
          />
        </div>
      </header>

      <main
        style={
          layout === 'full'
            ? { width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 56px)' }
            : {
                width: '100%',
                maxWidth,
                margin: '0 auto',
                padding: isMobile
                  ? '16px var(--page-pad-x) var(--page-pad-bot)'
                  : 'var(--page-pad-top) var(--page-pad-x) var(--page-pad-bot)',
                boxSizing: 'border-box',
                flex: 1,
              }
        }
      >
        {children}
      </main>

      <ToolAbout entry={entry} />

      <footer
        style={{
          maxWidth: 1040,
          width: '100%',
          margin: '0 auto',
          padding: '20px var(--page-pad-x) 28px',
          boxSizing: 'border-box',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 18px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
          lineHeight: 1.9,
          color: 'var(--ink-3)',
        }}
      >
        <span>{siteOf(entry).name}</span>
        <span>Runs entirely in your browser.</span>
        <a href={SITE_REPO} style={{ color: 'var(--ink-2)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
