/**
 * Money helpers.
 *
 * All monetary values in this app are stored as REAL (floating point). To avoid
 * accumulating floating-point drift, EVERY monetary value that gets written to
 * the database must be passed through `money()` so it is exact to the centavo
 * (2 decimal places). Treat `money()` as mandatory on writes.
 */
export function money(n: number): number {
  if (!Number.isFinite(n)) return 0
  // The + Number.EPSILON nudge avoids cases like 1.005 -> 1.00 due to binary representation.
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Treat anything within half a centavo of zero as zero (for "is it paid off?" checks). */
export function isZero(n: number): boolean {
  return Math.abs(n) < 0.005
}
