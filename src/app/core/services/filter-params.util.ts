export function parseNumberParam(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function parseCsvParam(value: unknown): string[] {
  if (!value) return [];
  return String(value).split(',').filter(Boolean);
}

export function parseTriStateBool(value: unknown): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function parseActiveParam(value: unknown): boolean | null {
  if (value === 'all') return null;
  if (value === 'false') return false;
  return true;
}

export function clampPageLimit(value: unknown, fallback = 50): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(1, n));
}

export function boolToSelection(value: boolean | null): string[] {
  if (value === true) return ['true'];
  if (value === false) return ['false'];
  return [];
}

export function selectionToBool(values: string[]): boolean | null {
  if (values.length === 0 || values.length === 2) return null;
  return values[0] === 'true';
}
