/**
 * One Euro filter (Casiez et al., CHI 2012): a low-pass filter whose cutoff rises with speed,
 * so slow movements are smoothed (less jitter) and fast ones follow closely (less lag).
 */
export type OneEuroParams = {
  /** Cutoff (Hz) at zero speed. Lower = smoother but laggier when still. */
  minCutoff: number;
  /** Speed coefficient. Higher = less lag during fast motion. */
  beta: number;
  /** Cutoff (Hz) for the derivative estimate. */
  dCutoff: number;
};

const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private t: number | null = null;

  constructor(private params: OneEuroParams) {}

  /** @param value new sample; @param timeSec monotonic timestamp in seconds. */
  filter(value: number, timeSec: number): number {
    if (this.x === null || this.t === null || timeSec <= this.t) {
      if (this.x === null) this.x = value;
      this.t ??= timeSec;
      return this.x;
    }
    const dt = timeSec - this.t;
    this.t = timeSec;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.params.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset() {
    this.x = null;
    this.dx = 0;
    this.t = null;
  }
}

/** One Euro filter over a fixed-length vector (each component filtered independently). */
export class OneEuroVector {
  private filters: OneEuroFilter[];

  constructor(size: number, params: OneEuroParams) {
    this.filters = Array.from({ length: size }, () => new OneEuroFilter(params));
  }

  filter(values: ArrayLike<number>, timeSec: number, out: number[] = []): number[] {
    for (let i = 0; i < this.filters.length; i++) out[i] = this.filters[i].filter(values[i], timeSec);
    return out;
  }

  reset() {
    for (const f of this.filters) f.reset();
  }
}
