import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT_DOMAIN, SITES, SITE_IDS } from '../src/site/manifest';

// deploy/nginx.conf must serve exactly the three sites, each from its own dist folder.
// Directives only: the header comment may mention the retired hosts.
const conf = readFileSync(resolve(__dirname, '../deploy/nginx.conf'), 'utf8').replace(/#.*$/gm, '');

describe('deploy/nginx.conf', () => {
  it('maps each site host to its dist folder and lists it in server_name', () => {
    const serverName = conf.match(/server_name ([^;]+);/)![1].split(/\s+/);
    for (const id of SITE_IDS) {
      const host = new URL(SITES[id].origin).host;
      expect(conf).toMatch(new RegExp(`${host.replace(/\./g, '\\.')}\\s+${id};`));
      expect(serverName).toContain(host);
    }
    expect(serverName).toHaveLength(SITE_IDS.length);
  });

  it('no longer serves or redirects the retired hosts', () => {
    expect(conf).not.toMatch(new RegExp(`server_name[^;]*\\s${ROOT_DOMAIN.replace(/\./g, '\\.')}[\\s;]`));
    expect(conf).not.toContain('www.chraegames.cloud');
    expect(conf).not.toContain('fireplan.');
    expect(conf).not.toContain('migrate.html');
    expect(conf).toMatch(/listen 80 default_server;\s*return 444;/);
  });
});
