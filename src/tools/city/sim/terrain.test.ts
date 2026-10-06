import { describe, expect, it } from 'vitest';
import { SLOPE_MAX } from '../constants';
import { N, T } from '../types';
import { idx } from './grid';
import { cornerHeight, generateTerrain } from './terrain';

describe('terrain', () => {
  it('is deterministic for a seed', () => {
    const a = generateTerrain(1234);
    const b = generateTerrain(1234);
    expect(a.sea).toBe(b.sea);
    expect(Array.from(a.height.subarray(0, 64))).toEqual(Array.from(b.height.subarray(0, 64)));
    expect(a.water).toEqual(b.water);
  });

  it('heights are finite and in range', () => {
    for (const seed of [1, 42, 99999]) {
      const t = generateTerrain(seed);
      for (let i = 0; i < T; i++) {
        expect(Number.isFinite(t.height[i])).toBe(true);
        expect(t.height[i]).toBeGreaterThanOrEqual(0);
        expect(t.height[i]).toBeLessThanOrEqual(1);
      }
    }
  }, 30_000); // a scripted multi-month simulation: seconds on a busy CI runner

  it('water fraction and buildable fraction are sensible', () => {
    for (const seed of [1, 42, 99999, 7]) {
      const t = generateTerrain(seed);
      let water = 0;
      let buildable = 0;
      for (let i = 0; i < T; i++) {
        if (t.water[i]) water++;
        else if (t.slope[i] <= SLOPE_MAX) buildable++;
      }
      expect(water / T).toBeGreaterThan(0.08);
      expect(water / T).toBeLessThan(0.4);
      expect(buildable / T).toBeGreaterThan(0.45);
    }
  });

  it('every edge has buildable land', () => {
    for (const seed of [1, 42, 99999, 7, 2024]) {
      const t = generateTerrain(seed);
      const edges = [
        (k: number) => idx(k, 0),
        (k: number) => idx(k, N - 1),
        (k: number) => idx(0, k),
        (k: number) => idx(N - 1, k),
      ];
      for (const e of edges) {
        let land = 0;
        for (let k = 0; k < N; k++) if (!t.water[e(k)]) land++;
        expect(land).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('corner heights average the surrounding tiles', () => {
    const h = new Float32Array(T).fill(0.5);
    h[idx(0, 0)] = 1;
    expect(cornerHeight(h, 0, 0)).toBe(1);
    expect(cornerHeight(h, 1, 1)).toBeCloseTo((1 + 0.5 + 0.5 + 0.5) / 4);
  });
});
