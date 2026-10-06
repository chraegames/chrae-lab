// FIRE Planner's view of the site manifest: the content pages of the fire
// site, plus the planner's own home path ('/'). Pure data so ContentLayout
// can build "Related" links without importing page components.
//
// To add a FIRE content page: add a manifest entry (area: 'fire-planner'), a
// Content component under src/pages/<slug>/, map it in
// src/site/prerenderPages.tsx, and create sites/fire/<slug>/index.html.

import { PAGES, pathFor } from '../site/manifest';

export interface RouteMeta {
  /** Short slug as used by the Content components, e.g. "coast-fire-calculator". */
  slug: string;
  /** Path on the fire site, with trailing slash, e.g. "/coast-fire-calculator/". */
  path: string;
  title: string;
  description: string;
  /** Short label used in cross-page "Related" links. */
  label: string;
}

export const FIRE_HOME_PATH = pathFor('fire-planner');

export const CONTENT_ROUTES: RouteMeta[] = PAGES.filter(
  p => p.kind === 'content' && p.area === 'fire-planner',
).map(p => ({
  slug: p.slug.slice('fire-planner/'.length),
  path: p.path,
  title: p.title,
  description: p.description,
  label: p.label ?? p.name,
}));
