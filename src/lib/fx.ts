const RATE_PATTERN = /^([A-Z]{3}):([A-Z]{3})=(\d+(?:\.\d+)?)$/;

export class FxRateError extends Error {
  readonly from: string;
  readonly to: string;
  constructor(from: string, to: string) {
    super(`No FX rate configured for ${from}->${to}`);
    this.name = "FxRateError";
    this.from = from;
    this.to = to;
  }
}

export function parseFxRates(spec: string): Map<string, number> {
  const rates = new Map<string, number>();
  for (const entry of spec.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const match = RATE_PATTERN.exec(trimmed.toUpperCase());
    if (!match) continue;
    const [, from, to, value] = match;
    const rate = Number(value);
    if (Number.isFinite(rate) && rate > 0) {
      rates.set(`${from}:${to}`, rate);
    }
  }
  return rates;
}

/**
 * Convert integer minor units between currencies using an explicitly
 * configured rate. Never assumes 1:1 for different currencies.
 */
export function convertMinor(
  minor: number,
  from: string,
  to: string,
  rates: Map<string, number>,
): number {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return minor;
  const direct = rates.get(`${f}:${t}`);
  if (direct !== undefined) return Math.round(minor * direct);
  const inverse = rates.get(`${t}:${f}`);
  if (inverse !== undefined && inverse > 0) return Math.round(minor / inverse);
  throw new FxRateError(f, t);
}

export function fxRate(
  from: string,
  to: string,
  rates: Map<string, number>,
): number {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;
  const direct = rates.get(`${f}:${t}`);
  if (direct !== undefined) return direct;
  const inverse = rates.get(`${t}:${f}`);
  if (inverse !== undefined && inverse > 0) return 1 / inverse;
  throw new FxRateError(f, t);
}