/** Splits a total (in cents) evenly across the given number of parts. */
export function computeShare(totalCents: bigint, parts: bigint): bigint {
  return totalCents / parts;
}
