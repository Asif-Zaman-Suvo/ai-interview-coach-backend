export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v?.trim()) {
    throw new Error(`${key} is required`);
  }
  return v.trim();
}
