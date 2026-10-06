// Writes dist/legacy/robots.txt for the bare apex (see LEGACY_ROBOTS).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_ROBOTS } from './prerender';

writeFileSync(resolve(import.meta.dirname, '../dist/legacy/robots.txt'), LEGACY_ROBOTS);
