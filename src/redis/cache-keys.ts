/** Namespaced Redis keys: `aic:{entity}:{id|hash}` */
export const CacheKeys = {
  questionsBank: () => 'aic:questions:bank:all',
  questionsBankByRoleDifficulty: (roleId: string, difficulty: string) =>
    `aic:questions:bank:${roleId}:${difficulty}`,
  testimonialsPublic: (limit: number) => `aic:testimonials:public:${limit}`,
  marketingDashboard: (limit: number) => `aic:marketing:dashboard:${limit}`,
  settingsByEmail: (email: string) =>
    `aic:settings:${email.trim().toLowerCase()}`,
  rolesAll: () => 'aic:roles:all',
} as const;

export const CacheTtlSeconds = {
  questions: 300,
  testimonials: 120,
  marketing: 60,
  settings: 60,
  roles: 300,
} as const;
