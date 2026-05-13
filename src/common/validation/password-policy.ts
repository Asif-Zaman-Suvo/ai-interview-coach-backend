import validator from 'validator';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 64;

export const PASSWORD_STRENGTH_OPTIONS = {
  minLength: PASSWORD_MIN_LENGTH,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
} as const;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be 12–64 characters and include at least one uppercase letter, one lowercase letter, one number, and one symbol.';

export function passwordMeetsPolicy(password: string): boolean {
  if (typeof password !== 'string') return false;
  if (password.length > PASSWORD_MAX_LENGTH) return false;
  return validator.isStrongPassword(password, {
    minLength: PASSWORD_STRENGTH_OPTIONS.minLength,
    minLowercase: PASSWORD_STRENGTH_OPTIONS.minLowercase,
    minUppercase: PASSWORD_STRENGTH_OPTIONS.minUppercase,
    minNumbers: PASSWORD_STRENGTH_OPTIONS.minNumbers,
    minSymbols: PASSWORD_STRENGTH_OPTIONS.minSymbols,
  });
}
