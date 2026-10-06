// Indexable copy for a tool page: About + features, FAQ, and a "More tools"
// nav. PURE (no hooks, no browser APIs, no CSS imports) — rendered both into
// the build-time ToolStatic fallback and below the live tool in ToolShell, so
// crawlers see the same text whether or not they execute JavaScript. The FAQ
// text must match the FAQPage JSON-LD (scripts/head.ts derives both from
// entry.about).
//
// Layout: a full-width sunken band below the tool (the tool owns the first
// viewport). Two columns on desktop — About + features left, FAQ right — with
// the FAQ answers in native <details> accordions so the text stays in the DOM
// (indexable, works without JS) without dominating the page.

import { BRAND_NAME, hrefFor, otherSites, relatedTools, siteOf, type SiteEntry } from './manifest';
import { TOOL_ABOUT_STYLES } from './toolAboutStyles';

export function ToolAbout({ entry }: { entry: SiteEntry }) {
  const about = entry.about;
  const related = relatedTools(entry);
  return (
    <div className="ta-band">
      <style>{TOOL_ABOUT_STYLES}</style>
      <div className="ta-inner">
        {about && (
          <div className="ta-grid">
            <section aria-labelledby="tool-about">
              <h2 id="tool-about" className="ta-h2">
                About {entry.name}
              </h2>
              <p className="ta-intro">{about.intro}</p>
              <ul className="ta-features">
                {about.features.map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>

            {about.faq.length > 0 && (
              <section aria-labelledby="tool-faq">
                <h2 id="tool-faq" className="ta-h2">
                  Frequently asked questions
                </h2>
                {about.faq.map(({ q, a }) => (
                  <details key={q} className="ta-q">
                    <summary>
                      <h3>{q}</h3>
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </section>
            )}
          </div>
        )}

        <nav aria-label={`More from ${siteOf(entry).name}`} className="ta-more">
          <span className="ta-label">More from {siteOf(entry).name}</span>
          <ul>
            {related.map(t => (
              <li key={t.slug}>
                <a href={t.path}>{t.name}</a>
              </li>
            ))}
            <li>
              <a href="/">{siteOf(entry).homeLabel}</a>
            </li>
          </ul>
        </nav>

        <nav aria-label={`More from ${BRAND_NAME}`} className="ta-more">
          <span className="ta-label">Also from {BRAND_NAME}</span>
          <ul>
            {otherSites(entry.site).map(s => (
              <li key={s.slug}>
                <a href={hrefFor(s, entry.site)}>{s.name}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
