/** Stored values include legacy `pro` (treated as top pack). */
export const USER_PLAN_DB_VALUES = [
  'free',
  'pack_10',
  'pack_30',
  'pro',
] as const;

export type UserPlanDb = (typeof USER_PLAN_DB_VALUES)[number];

/** Normalized plan used in app logic and API responses. */
export type UserPlan = 'free' | 'pack_10' | 'pack_30';

export function normalizeUserPlan(
  raw: string | undefined | null,
): UserPlan {
  if (raw === 'pack_10') return 'pack_10';
  if (raw === 'pack_30' || raw === 'pro') return 'pack_30';
  return 'free';
}
