/** Normalize Mongoose / JSON date fields for use in app code. */
export function asDate(value: unknown): Date {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }
  if (value === undefined || value === null) {
    return new Date();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    '$date' in (value as Record<string, unknown>)
  ) {
    return asDate((value as { $date: unknown }).$date);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}
