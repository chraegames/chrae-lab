// CSS for the ToolAbout band (ta-*). Injected as a <style> string so the
// component stays pure (rendered at build time into the static tree and live
// below every tool). Modelled on the hub's sunken Guides band: the tool owns
// the first viewport; the indexable copy sits below it as a compact,
// lower-contrast "article footer" with the FAQ as native <details> accordions.

export const TOOL_ABOUT_STYLES = `
.ta-band{background:var(--bg-soft);border-top:1px solid var(--border);margin-top:clamp(48px,8vh,88px);padding:36px var(--page-pad-x) 40px}
.ta-inner{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
.ta-grid{display:grid;grid-template-columns:1fr;gap:32px}
@media (min-width:880px){.ta-grid{grid-template-columns:1.05fr 1fr;gap:56px}}
.ta-h2{font-family:var(--font-mono);font-weight:500;font-size:11.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-index);margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid var(--border)}
.ta-intro{margin:0 0 14px;font-size:14px;line-height:1.6;color:var(--ink-2);max-width:62ch}
.ta-features{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr;gap:8px 20px}
@media (min-width:560px) and (max-width:879px){.ta-features{grid-template-columns:1fr 1fr}}
.ta-features li{position:relative;padding-left:14px;font-size:13px;line-height:1.5;color:var(--ink-3)}
.ta-features li::before{content:"";position:absolute;left:0;top:0.6em;width:5px;height:5px;border-radius:50%;background:var(--accent)}
.ta-q{border-bottom:1px solid var(--border)}
.ta-q summary{list-style:none;cursor:pointer;display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:10px 0}
.ta-q summary::-webkit-details-marker{display:none}
.ta-q summary h3{margin:0;font-family:var(--font-sans);font-size:14px;font-weight:500;color:var(--ink);line-height:1.4}
.ta-q summary::after{content:"+";font-family:var(--font-mono);font-size:14px;line-height:1;color:var(--ink-index);flex:none}
.ta-q[open] summary::after{content:"\\2013"}
.ta-q summary:hover h3{color:var(--accent-ink)}
.ta-q p{margin:0 0 12px;font-size:13.5px;line-height:1.6;color:var(--ink-3);max-width:60ch}
.ta-more{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 20px;padding-top:18px;border-top:1px solid var(--border);font-family:var(--font-mono);font-size:12px}
.ta-more ul{list-style:none;margin:0;padding:0;display:contents}
.ta-more .ta-label{color:var(--ink-index);text-transform:uppercase;letter-spacing:0.14em;font-size:11px;margin-right:4px}
.ta-more a{color:var(--ink-2);text-decoration:none;border-bottom:1px solid var(--border-strong);padding-bottom:1px}
.ta-more a:hover{color:var(--accent-ink);border-color:var(--accent)}
.ta-more+.ta-more{border-top:0;padding-top:10px}
`;
