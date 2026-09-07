/**
 * One Euro Filter, adapted from the reference implementation by
 * Alix Giguey and Gery Casiez (Inria, BSD-3-Clause).
 * https://github.com/casiez/OneEuroFilter
 *
 * Timestamps are supplied in milliseconds because MediaPipe and the browser
 * camera use DOMHighResTimeStamp values.
 */

export interface OneEuroParameters {
  frequency?: number;
  minCutoff: number;
  beta: number;
  derivativeCutoff: number;
}

class LowPassFilter {
  private initialized = false;
  private filteredValue = 0;

  filter(value: number, alpha: number): number {
    const safeAlpha = Math.min(1, Math.max(Number.EPSILON, alpha));
    this.filteredValue = this.initialized
      ? safeAlpha * value + (1 - safeAlpha) * this.filteredValue
      : value;
    this.initialized = true;
    return this.filteredValue;
  }

  hasValue(): boolean {
    return this.initialized;
  }

  lastFilteredValue(): number {
    return this.filteredValue;
  }

  reset(): void {
    this.initialized = false;
    this.filteredValue = 0;
  }
}

export class OneEuroFilter {
  private frequency: number;
  private lastTimestamp?: number;
  private readonly valueFilter = new LowPassFilter();
  private readonly derivativeFilter = new LowPassFilter();

  constructor(private readonly parameters: OneEuroParameters) {
    this.frequency = Math.max(1, parameters.frequency ?? 30);
  }

  filter(value: number, timestampMs: number): number {
    if (this.lastTimestamp !== undefined && timestampMs > this.lastTimestamp) {
      // Real camera callbacks occasionally arrive after a tab stall. Limiting
      // the inferred interval prevents one delayed frame from disabling the
      // filter completely on the next sample.
      const seconds = Math.min(0.2, Math.max(0.001, (timestampMs - this.lastTimestamp) / 1000));
      this.frequency = 1 / seconds;
    }
    this.lastTimestamp = timestampMs;

    const derivative = this.valueFilter.hasValue()
      ? (value - this.valueFilter.lastFilteredValue()) * this.frequency
      : 0;
    const filteredDerivative = this.derivativeFilter.filter(
      derivative,
      this.alpha(this.parameters.derivativeCutoff),
    );
    const cutoff = this.parameters.minCutoff + this.parameters.beta * Math.abs(filteredDerivative);
    return this.valueFilter.filter(value, this.alpha(cutoff));
  }

  reset(): void {
    this.lastTimestamp = undefined;
    this.frequency = Math.max(1, this.parameters.frequency ?? 30);
    this.valueFilter.reset();
    this.derivativeFilter.reset();
  }

  private alpha(cutoff: number): number {
    const safeCutoff = Math.max(0.001, cutoff);
    const samplePeriod = 1 / this.frequency;
    const timeConstant = 1 / (2 * Math.PI * safeCutoff);
    return 1 / (1 + timeConstant / samplePeriod);
  }
}
