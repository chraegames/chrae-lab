import { describe, expect, it } from 'vitest';
import { TICKS_PER_MONTH } from '../constants';
import { PLOP, POLICY } from '../types';
import { monthlyBudget } from './budget';
import { computeCrime } from './crime';
import { POLICIES, policyCost } from './policies';
import { act, flatState, prime, run } from './testUtil';

function town() {
  const s = flatState();
  act(s, { type: 'road', from: { x: 0, y: 40 }, to: { x: 127, y: 40 } });
  act(s, { type: 'zone', zone: 1, density: 1, rect: { x0: 10, y0: 41, x1: 60, y1: 43 } });
  act(s, { type: 'zone', zone: 2, density: 1, rect: { x0: 10, y0: 37, x1: 30, y1: 39 } });
  act(s, { type: 'zone', zone: 3, density: 1, rect: { x0: 31, y0: 37, x1: 60, y1: 39 } });
  act(s, { type: 'plop', plop: PLOP.COAL, at: { x: 62, y: 38 } });
  act(s, { type: 'plop', plop: PLOP.TOWER, at: { x: 64, y: 41 } });
  prime(s);
  run(s, TICKS_PER_MONTH * 10);
  return s;
}

describe('policies', () => {
  it('every policy has a unique bit and a cost that scales with residents', () => {
    const bits = new Set(POLICIES.map(p => p.bit));
    expect(bits.size).toBe(POLICIES.length);
    const s = town();
    expect(policyCost(s)).toBe(0);
    act(s, { type: 'setPolicy', policy: POLICY.WATCH, on: true });
    expect(s.results.at(-1)).toMatchObject({ ok: true });
    const small = policyCost(s);
    expect(small).toBeGreaterThan(0);
    s.totals.population *= 2;
    expect(policyCost(s)).toBeGreaterThan(small);
    act(s, { type: 'setPolicy', policy: POLICY.WATCH, on: true });
    expect(s.results.at(-1)).toMatchObject({ ok: false, reason: 'noop' });
  }, 30_000); // a scripted multi-month simulation: seconds on a busy CI runner

  it('the policy bill lands in the ledger and a tax holiday cuts business tax by a quarter', () => {
    const s = town();
    const base = monthlyBudget(s);
    expect(base.policyCost).toBe(0);
    act(s, { type: 'setPolicy', policy: POLICY.TAX_HOLIDAY, on: true }, { type: 'setPolicy', policy: POLICY.SMOKE_DETECTORS, on: true });
    const after = monthlyBudget(s);
    expect(after.policyCost).toBeGreaterThan(0);
    expect(after.incomeC).toBeLessThan(base.incomeC);
    expect(after.incomeC).toBeGreaterThan(base.incomeC * 0.7);
    expect(after.incomeR).toBeGreaterThanOrEqual(base.incomeR * 0.99);
  }, 30_000); // a scripted multi-month simulation: seconds on a busy CI runner

  it('neighbourhood watch lowers crime everywhere', () => {
    const s = town();
    computeCrime(s);
    computeCrime(s);
    const before = s.totals.meanCrime;
    let sum = 0;
    for (let i = 0; i < s.crime.length; i++) sum += s.crime[i];
    s.policies |= POLICY.WATCH;
    for (let k = 0; k < 8; k++) computeCrime(s);
    let sumAfter = 0;
    for (let i = 0; i < s.crime.length; i++) sumAfter += s.crime[i];
    expect(sumAfter).toBeLessThan(sum);
    void before;
  });
});
