import { Temporal as PolyfillTemporal } from '@js-temporal/polyfill';

export const Temporal = PolyfillTemporal;
export type Instant = ReturnType<(typeof Temporal.Now)['instant']>;

export function nowInstant(): Instant {
  return Temporal.Now.instant();
}

export function instantToString(value: Instant): string {
  return value.toString();
}

export function instantFromString(value: string): Instant {
  return Temporal.Instant.from(value);
}
