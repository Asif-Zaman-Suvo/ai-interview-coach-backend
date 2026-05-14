import type { UserPlan } from '../users/user-plan';

export const SESSION_LIMIT_BY_PLAN: Record<UserPlan, number> = {
  free: 3,
  pack_10: 10,
  pack_30: 30,
};

export function sessionLimitForPlan(plan: UserPlan): number {
  return SESSION_LIMIT_BY_PLAN[plan];
}
