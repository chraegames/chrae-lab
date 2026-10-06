import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH } from '../constants';
import { N, PLOP, PROBLEM } from '../types';
import { collectMarkers, markerIcon } from '../render/markers';
import { computeProblems } from './problems';
import { act, countWhere, flatState, prime, run } from './testUtil';

function town() {
  const s = flatState();
  act(s, { type: 'road', from: { x: 0, y: 40 }, to: { x: N - 1, y: 40 } });
  act(s, { type: 'zone', zone: 1, density: 1, rect: { x0: 10, y0: 41, x1: 50, y1: 43 } });
  act(s, { type: 'zone', zone: 2, density: 1, rect: { x0: 10, y0: 37, x1: 25, y1: 39 } });
  act(s, { type: 'zone', zone: 3, density: 1, rect: { x0: 26, y0: 37, x1: 50, y1: 39 } });
  act(s, { type: 'plop', plop: PLOP.COAL, at: { x: 52, y: 38 } });
  act(s, { type: 'plop', plop: PLOP.TOWER, at: { x: 54, y: 41 } });
  act(s, { type: 'plop', plop: PLOP.LANDFILL, at: { x: 56, y: 41 } });
  prime(s);
  run(s, TICKS_PER_MONTH * 8);
  return s;
}

describe('problems', () => {
  it('a healthy town has few flags; losing the plant flags every lot with no power', () => {
    const s = town();
    computeProblems(s);
    const lots = countWhere(s.level, v => v > 0);
    expect(lots).toBeGreaterThan(50);
    expect(countWhere(s.problems, v => (v & PROBLEM.NO_POWER) !== 0)).toBe(0);
    act(s, { type: 'bulldoze', rect: { x0: 52, y0: 38, x1: 53, y1: 39 } });
    prime(s);
    computeProblems(s);
    const dark = countWhere(s.problems, v => (v & PROBLEM.NO_POWER) !== 0);
    expect(dark).toBeGreaterThan(lots * 0.8);
    expect(s.totals.problems).toBe(countWhere(s.problems, v => v > 0));
    // flags sit on lot origins only and never on empty tiles
    for (let i = 0; i < s.problems.length; i++) if (s.problems[i]) expect(s.level[i]).toBeGreaterThan(0);
  }, 30_000); // a scripted multi-month simulation: seconds on a busy CI runner

  it('markers pick the most urgent icon per lot and thin out when the field is dense', () => {
    expect(markerIcon(PROBLEM.GARBAGE | PROBLEM.NO_POWER)).toBe(markerIcon(PROBLEM.NO_POWER));
    expect(markerIcon(0)).toBe(-1);
    const s = town();
    act(s, { type: 'bulldoze', rect: { x0: 52, y0: 38, x1: 53, y1: 39 } });
    prime(s);
    computeProblems(s);
    const flagged = countWhere(s.problems, v => v > 0);
    const L = s as unknown as Parameters<typeof collectMarkers>[0];
    const all = collectMarkers(L, i => i, 10_000, [], 100_000);
    expect(all).toHaveLength(flagged);
    for (const m of all) expect(m.icon).toBe(markerIcon(PROBLEM.NO_POWER));
    const thinned = collectMarkers(L, i => i, 10_000, [], 10);
    expect(thinned.length).toBeLessThan(flagged / 2);
    expect(thinned.length).toBeGreaterThan(flagged / 4);
  });
});
