import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH, plopDef } from '../constants';
import { PLOP, POLICY, PROBLEM } from '../types';
import { computeGarbage, garbageOf } from './garbage';
import { computeProblems } from './problems';
import { act, countWhere, flatState, prime, run } from './testUtil';

function town() {
  const s = flatState();
  act(s, { type: 'road', from: { x: 0, y: 40 }, to: { x: 127, y: 40 } });
  act(s, { type: 'zone', zone: 1, density: 1, rect: { x0: 10, y0: 41, x1: 60, y1: 43 } });
  act(s, { type: 'zone', zone: 2, density: 1, rect: { x0: 10, y0: 37, x1: 30, y1: 39 } });
  act(s, { type: 'zone', zone: 3, density: 1, rect: { x0: 31, y0: 37, x1: 60, y1: 39 } });
  act(s, { type: 'plop', plop: PLOP.COAL, at: { x: 62, y: 38 } });
  act(s, { type: 'plop', plop: PLOP.TOWER, at: { x: 64, y: 41 } });
  // a spur south of the main street for the rubbish facilities (they need a road next to them)
  act(s, { type: 'road', from: { x: 35, y: 41 }, to: { x: 35, y: 60 } });
  prime(s);
  run(s, TICKS_PER_MONTH * 10);
  return s;
}

describe('garbage', () => {
  it('without collection every lot is flagged; two half-size facilities serve the town in full', () => {
    const s = town();
    expect(s.totals.population).toBeGreaterThan(400);
    computeGarbage(s);
    expect(s.totals.garbageDemand).toBeGreaterThan(0);
    expect(s.totals.garbageSupply).toBe(0);
    expect(s.totals.garbageUncollected).toBe(1);
    computeProblems(s);
    expect(countWhere(s.problems, v => (v & PROBLEM.GARBAGE) !== 0)).toBeGreaterThan(50);
    // one landfill can take the whole load on its own …
    act(s, { type: 'plop', plop: PLOP.LANDFILL, at: { x: 36, y: 45 } });
    expect(s.results.at(-1)).toMatchObject({ ok: true });
    computeGarbage(s);
    expect(s.totals.garbageUncollected).toBe(0);
    // … and two facilities that each cover half the load still serve everyone (shares stack)
    const half = Math.floor(s.totals.garbageDemand * 0.45);
    const def = plopDef(PLOP.LANDFILL)!;
    const saved = def.capacity;
    (def as { capacity: number }).capacity = half;
    computeGarbage(s);
    expect(s.totals.garbageUncollected).toBeGreaterThan(0.9);
    act(s, { type: 'plop', plop: PLOP.LANDFILL, at: { x: 36, y: 49 } });
    computeGarbage(s);
    expect(s.totals.garbageUncollected).toBe(0);
    (def as { capacity: number }).capacity = saved;
  }, 30_000); // a scripted multi-month simulation: seconds on a busy CI runner

  it('the recycling programme cuts rubbish by a quarter and an incinerator adds power', () => {
    const s = town();
    let i = -1;
    for (let k = 0; k < s.level.length; k++) if (s.level[k] && s.pop[k] > 0) { i = k; break; }
    expect(i).toBeGreaterThan(0);
    const before = garbageOf(s, i);
    s.policies |= POLICY.RECYCLING;
    expect(garbageOf(s, i)).toBeCloseTo(before * 0.75, 5);
    const supply = s.totals.powerSupply;
    act(s, { type: 'plop', plop: PLOP.INCINERATOR, at: { x: 70, y: 41 } });
    prime(s);
    expect(s.totals.powerSupply).toBe(supply + plopDef(PLOP.INCINERATOR)!.power);
  }, 30_000); // a scripted multi-month simulation: seconds on a busy CI runner
});
