import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH } from '../constants';
import { PLOP } from '../types';
import { idx } from './grid';
import { checkMilestones, densityUnlocked, isUnlocked, MILESTONES, unlockTier } from './milestones';
import { act, flatState, prime, run } from './testUtil';

describe('milestones', () => {
  it('tiers are ordered by population and every plop has a tier', () => {
    for (let k = 1; k < MILESTONES.length; k++) expect(MILESTONES[k].pop).toBeGreaterThan(MILESTONES[k - 1].pop);
    expect(unlockTier(PLOP.COAL)).toBe(0);
    expect(unlockTier(PLOP.NUCLEAR)).toBeGreaterThan(unlockTier(PLOP.GAS));
    expect(unlockTier(PLOP.LANDMARK)).toBeGreaterThan(unlockTier(PLOP.STADIUM));
  });

  it('crossing a threshold raises the tier once, pays the grant and queues a notice; a dip never lowers it', () => {
    const s = flatState(1, 10_000, true);
    expect(s.milestone).toBe(0);
    s.totals.population = MILESTONES[1].pop + 5;
    checkMilestones(s);
    expect(s.milestone).toBe(1);
    expect(s.funds).toBe(10_000 + MILESTONES[1].reward);
    expect(s.notices).toHaveLength(1);
    expect(s.notices[0].unlocks).toEqual(MILESTONES[1].unlocks);
    checkMilestones(s);
    expect(s.notices).toHaveLength(1);
    s.totals.population = 0;
    checkMilestones(s);
    expect(s.milestone).toBe(1);
    expect(s.peakPop).toBe(MILESTONES[1].pop + 5);
    // two thresholds at once climb two tiers
    s.totals.population = MILESTONES[3].pop;
    checkMilestones(s);
    expect(s.milestone).toBe(3);
    expect(s.notices).toHaveLength(3);
  });

  it('locked plops, densities, avenues, loans and policies are refused until their tier', () => {
    const s = flatState(1, 1_000_000, true);
    act(s, { type: 'road', from: { x: 0, y: 10 }, to: { x: 30, y: 10 } });
    act(s, { type: 'plop', plop: PLOP.HOSPITAL, at: { x: 5, y: 11 } });
    expect(s.results.at(-1)).toMatchObject({ ok: false, reason: 'locked' });
    expect(isUnlocked(s, PLOP.HOSPITAL)).toBe(false);
    act(s, { type: 'zone', zone: 1, density: 3, rect: { x0: 2, y0: 11, x1: 6, y1: 12 } });
    expect(s.results.at(-1)).toMatchObject({ ok: false, reason: 'locked' });
    expect(densityUnlocked(s, 1)).toBe(true);
    act(s, { type: 'road', from: { x: 0, y: 20 }, to: { x: 10, y: 20 }, avenue: true });
    expect(s.results.at(-1)).toMatchObject({ ok: false, reason: 'locked' });
    act(s, { type: 'loan', amount: 10_000 });
    expect(s.results.at(-1)).toMatchObject({ ok: false, reason: 'locked' });
    act(s, { type: 'setPolicy', policy: 1, on: true });
    expect(s.results.at(-1)).toMatchObject({ ok: false, reason: 'locked' });
    s.milestone = unlockTier(PLOP.HOSPITAL);
    act(s, { type: 'plop', plop: PLOP.HOSPITAL, at: { x: 5, y: 11 } });
    expect(s.results.at(-1)).toMatchObject({ ok: true });
    expect(s.plop[idx(5, 11)]).toBe(PLOP.HOSPITAL);
  });

  it('a hydro plant must touch water', () => {
    const s = flatState();
    act(s, { type: 'plop', plop: PLOP.HYDRO, at: { x: 20, y: 20 } });
    expect(s.results.at(-1)).toMatchObject({ ok: false, reason: 'water' });
    s.water[idx(22, 20)] = 1;
    act(s, { type: 'plop', plop: PLOP.HYDRO, at: { x: 20, y: 20 } });
    expect(s.results.at(-1)).toMatchObject({ ok: true });
  });

  it('a growing town climbs to Hamlet on its own', () => {
    const s = flatState(1, 1_000_000, true);
    act(s, { type: 'road', from: { x: 0, y: 40 }, to: { x: 127, y: 40 } });
    act(s, { type: 'zone', zone: 1, density: 1, rect: { x0: 10, y0: 41, x1: 60, y1: 43 } });
    act(s, { type: 'zone', zone: 2, density: 1, rect: { x0: 10, y0: 37, x1: 30, y1: 39 } });
    act(s, { type: 'zone', zone: 3, density: 1, rect: { x0: 31, y0: 37, x1: 60, y1: 39 } });
    act(s, { type: 'plop', plop: PLOP.COAL, at: { x: 62, y: 38 } });
    act(s, { type: 'plop', plop: PLOP.TOWER, at: { x: 64, y: 41 } });
    prime(s);
    run(s, TICKS_PER_MONTH * 18);
    expect(s.totals.population).toBeGreaterThan(MILESTONES[1].pop);
    expect(s.milestone).toBeGreaterThanOrEqual(1);
  }, 30_000); // a scripted multi-month simulation: seconds on a busy CI runner
});
