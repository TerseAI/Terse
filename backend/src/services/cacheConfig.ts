export function resolveTtlMs(envValue: string | undefined, fallback: number): number {
  if (!envValue) {
    return fallback;
  }

  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

