import { describe, expect, it } from "vitest";
import { OneEuroFilter, OneEuroVector } from "./oneEuro";

const params = { minCutoff: 1, beta: 0, dCutoff: 1 };

describe("OneEuroFilter", () => {
  it("passes the first sample through", () => {
    expect(new OneEuroFilter(params).filter(5, 0)).toBe(5);
  });

  it("converges to a constant input", () => {
    const f = new OneEuroFilter(params);
    f.filter(0, 0);
    let y = 0;
    for (let i = 1; i <= 300; i++) y = f.filter(10, i / 30);
    expect(y).toBeCloseTo(10, 3);
  });

  it("smooths jitter around a constant value", () => {
    const f = new OneEuroFilter(params);
    const out: number[] = [];
    for (let i = 0; i < 300; i++) out.push(f.filter(i % 2 === 0 ? 1 : -1, i / 30));
    const tail = out.slice(200);
    expect(Math.max(...tail.map(Math.abs))).toBeLessThan(0.5);
  });

  it("lags less on fast motion when beta > 0", () => {
    const run = (beta: number) => {
      const f = new OneEuroFilter({ ...params, beta });
      let y = 0;
      for (let i = 0; i <= 15; i++) y = f.filter(i * 2, i / 30); // ramp: 60 units/s
      return 30 - y; // lag behind the true value (30)
    };
    expect(run(0.5)).toBeLessThan(run(0));
  });

  it("ignores non-increasing timestamps", () => {
    const f = new OneEuroFilter(params);
    f.filter(1, 1);
    expect(f.filter(100, 1)).toBe(1);
    expect(f.filter(100, 0.5)).toBe(1);
  });

  it("restarts after reset", () => {
    const f = new OneEuroFilter(params);
    f.filter(1, 0);
    f.reset();
    expect(f.filter(42, 10)).toBe(42);
  });
});

describe("OneEuroVector", () => {
  it("filters each component independently", () => {
    const v = new OneEuroVector(3, params);
    expect(v.filter([1, 2, 3], 0)).toEqual([1, 2, 3]);
    const out = v.filter([2, 2, 2], 1 / 30);
    expect(out[0]).toBeGreaterThan(1);
    expect(out[1]).toBe(2);
    expect(out[2]).toBeLessThan(3);
  });
});
