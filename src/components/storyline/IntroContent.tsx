// Shared marketing copy for the FIRE Planner landing surface.
//
// This is the SINGLE SOURCE for the home-page hero + "what this is" copy. It
// feeds two places:
//   1. The interactive <Intro> screen (same hero with a CTA, same panels).
//   2. The build-time prerendered HTML injected into #root (scripts/prerender.tsx
//      renders <IntroContent/> to a static string so crawlers / no-JS visitors
//      get real content on the first byte).
//
// Everything here is PURE: no hooks, no analytics, no browser APIs — so it can be
// rendered to a string in the Vite build (Node) context. Keep it that way.

import type { ReactNode } from 'react';
import { SITE_REPO } from '../../site/manifest';
import { INTRO_STYLES } from './introStyles';

/** Decorative "projection" bar chart: accumulation in the accent, drawdown in coral. */
function ProjectionPanel() {
  const bars: { h: number; alpha?: number; drawdown?: boolean }[] = [
    { h: 16, alpha: 0.25 },
    { h: 24, alpha: 0.34 },
    { h: 33, alpha: 0.45 },
    { h: 44, alpha: 0.58 },
    { h: 55, alpha: 0.74 },
    { h: 68 },
    { h: 80 },
    { h: 92, drawdown: true },
    { h: 100, drawdown: true },
  ];
  return (
    <div className="fire-intro-panel" aria-hidden="true">
      <div className="fire-intro-caption">
        <span>Projection</span>
        <span>Year by year</span>
      </div>
      <div className="fire-intro-bars">
        {bars.map((b, i) => (
          <i key={i} className={b.drawdown ? 'drawdown' : undefined} style={{ height: `${b.h}%`, opacity: b.alpha }} />
        ))}
      </div>
      <div className="fire-intro-rule" />
      <div className="fire-intro-legend">
        <span>
          <i />
          Accumulation
        </span>
        <span>
          <i className="drawdown" />
          Drawdown
        </span>
      </div>
    </div>
  );
}

interface IntroHeaderProps {
  /** Rendered under the lead paragraph (the live screen's "Get started"). */
  cta?: ReactNode;
}

export function IntroHeader({ cta }: IntroHeaderProps) {
  return (
    <header className="fire-intro-hero">
      <div>
        <div className="fire-intro-eyebrow">FIRE Planner</div>
        <h1 className="fire-intro-h1">
          Plan your retirement, <em>in your browser.</em>
        </h1>
        <p className="fire-intro-lead">
          Free, private, browser-only. No signup, no server — your data never leaves
          this device.
        </p>
        {cta && <div className="fire-intro-cta">{cta}</div>}
      </div>
      <ProjectionPanel />
    </header>
  );
}

// The three "what this is" panels, always visible on both the prerendered home
// page and the live <Intro>.
export function IntroSections() {
  return (
    <section className="fire-intro-what" aria-labelledby="fire-what-this-is">
      <div className="fire-intro-sec-head">
        <h2 id="fire-what-this-is">What this is</h2>
      </div>
      <div className="fire-intro-grid">
        <div className="fire-intro-card">
          <h3>What you can do.</h3>
          <p>
            Project income, expenses, investment growth, illustrative federal taxes, and
            withdrawals across a configurable horizon. Compare scenarios side-by-side,
            record actuals year by year as life happens, and let an optimizer pick a
            tax-efficient withdrawal schedule.
          </p>
        </div>
        <div className="fire-intro-card">
          <h3>How it works.</h3>
          <p>
            Everything runs in your browser — the simulation, the optimizer, the
            charts. There is no server-side computation. Plans persist in this browser's
            localStorage so they're here when you come back.
          </p>
        </div>
        <div className="fire-intro-card">
          <h3>Your data.</h3>
          <p>
            No account, no server, no tracking of personal information. Export and import
            plans as JSON files you control. Clearing your browser data erases everything
            — nothing is kept anywhere else.
          </p>
        </div>
      </div>
      <IntroDisclaimer />
    </section>
  );
}

export function IntroDisclaimer() {
  return (
    <p className="fire-intro-disclaimer">
      Educational tool — not financial advice. <a href={SITE_REPO}>Source on GitHub</a>
    </p>
  );
}

/** The static tree has no <AppBar>, so it carries its own breadcrumb row. */
function StaticHeaderRow() {
  return (
    <div className="fire-intro-top">
      <nav className="fire-intro-crumb" aria-label="Breadcrumb">
        <b aria-current="page">FIRE Planner</b>
      </nav>
      <span className="fire-intro-pill">
        <i aria-hidden="true" />
        Runs on this device
      </span>
    </div>
  );
}

// The static landing view used for build-time prerendering. On mount, App's
// createRoot render replaces this markup with <AppBar> + <Intro>.
export function IntroContent() {
  return (
    <div className="fire-intro">
      <style>{INTRO_STYLES}</style>
      <StaticHeaderRow />
      <IntroHeader />
      <IntroSections />
    </div>
  );
}
