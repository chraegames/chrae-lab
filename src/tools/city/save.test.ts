import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH } from './constants';
import { decodeSave, encodeSave, GEN_VERSION, parseSaveFile, rleDecode, rleEncode, SAVED_U16, SAVED_U8 } from './save';
import { MILESTONES } from './sim/milestones';
import { findSite, townActions } from './sim/scenario';
import { createCityState } from './sim/state';
import { applyActions, primeDerived, tick } from './sim/tick';
import { SERVICE_COUNT, T } from './types';

describe('save', () => {
  it('rle round-trips and rejects bad lengths', () => {
    const a = new Uint8Array(T);
    for (let i = 0; i < T; i++) a[i] = i % 700 < 300 ? 3 : (i >> 4) & 7;
    const enc = rleEncode(a);
    expect(rleDecode(enc, T)).toEqual(a);
    expect(rleDecode(enc, T - 1)).toBeNull();
    expect(rleDecode(enc.subarray(0, 10), T)).toBeNull();
  });

  it('round-trips a scripted city and stays small', () => {
    const s = createCityState(5);
    const site = findSite(s, 45, 31)!;
    let id = 1;
    applyActions(s, townActions(site).map(action => ({ id: id++, action })));
    primeDerived(s);
    for (let k = 0; k < TICKS_PER_MONTH * 8; k++) tick(s);
    s.loans.push({ id: 1, principal: 10000, balance: 9000, monthsLeft: 100 });
    const file = encodeSave(s);
    const raw = JSON.stringify(file);
    expect(raw.length).toBeLessThan(300_000);
    const parsed = parseSaveFile(raw);
    expect(parsed).not.toBeNull();
    const t = decodeSave(parsed!)!;
    for (const k of SAVED_U8) expect(t[k]).toEqual(s[k]);
    for (const k of SAVED_U16) expect(t[k]).toEqual(s[k]);
    expect(t.tick).toBe(s.tick);
    expect(t.funds).toBe(s.funds);
    expect(t.rngState).toBe(s.rngState);
    expect(t.loans).toEqual(s.loans);
    expect(t.ledger).toEqual(s.ledger);
    expect(t.sea).toBe(s.sea);
    // simulation continues identically from the restored state
    primeDerived(t);
    primeDerived(s);
    for (let k = 0; k < TICKS_PER_MONTH; k++) {
      tick(t);
      tick(s);
    }
    expect(t.level).toEqual(s.level);
    expect(t.funds).toBe(s.funds);
  }, 30_000); // a scripted multi-month simulation: seconds on a busy CI runner

  it('loads a save from before milestones and policies, padding the service lists and inferring the tier', () => {
    const s = createCityState(9);
    const site = findSite(s, 45, 31)!;
    let id = 1;
    applyActions(s, townActions(site).map(action => ({ id: id++, action })));
    primeDerived(s);
    for (let k = 0; k < TICKS_PER_MONTH * 6; k++) tick(s);
    const file = encodeSave(s);
    const legacy = {
      ...file,
      funding: file.funding.slice(0, 7),
      ledger: file.ledger.map(l => {
        const { policyCost, ...rest } = l;
        void policyCost;
        return { ...rest, expenses: l.expenses.slice(0, 7) };
      }),
    } as Record<string, unknown>;
    delete legacy.milestone;
    delete legacy.peakPop;
    delete legacy.policies;
    delete legacy.history;
    const parsed = parseSaveFile(JSON.stringify(legacy));
    expect(parsed).not.toBeNull();
    const t = decodeSave(parsed!)!;
    expect(t).not.toBeNull();
    expect(t.funding.length).toBe(SERVICE_COUNT);
    expect(t.funding[SERVICE_COUNT - 1]).toBe(1);
    expect(t.ledger[0].expenses.length).toBe(SERVICE_COUNT);
    expect(t.ledger[0].policyCost).toBe(0);
    expect(t.policies).toBe(0);
    expect(t.history).toEqual([]);
    const pop = s.totals.population;
    let tier = 0;
    for (let k = 1; k < MILESTONES.length; k++) if (pop >= MILESTONES[k].pop) tier = k;
    expect(t.milestone).toBe(tier);
    expect(t.peakPop).toBeGreaterThan(0);
  });

  it('rejects malformed input', () => {
    expect(parseSaveFile(null)).toBeNull();
    expect(parseSaveFile('nope')).toBeNull();
    expect(parseSaveFile('{}')).toBeNull();
    const s = createCityState(2);
    const good = encodeSave(s);
    expect(parseSaveFile(JSON.stringify({ ...good, gen: GEN_VERSION + 1 }))).toBeNull();
    expect(parseSaveFile(JSON.stringify({ ...good, taxes: [1, 2] }))).toBeNull();
    expect(parseSaveFile(JSON.stringify({ ...good, layers: { ...good.layers, zone: 5 } }))).toBeNull();
    const bad = parseSaveFile(JSON.stringify({ ...good, layers: { ...good.layers, zone: 'AAAA' } }));
    expect(bad).not.toBeNull();
    expect(decodeSave(bad!)).toBeNull();
  });
});
