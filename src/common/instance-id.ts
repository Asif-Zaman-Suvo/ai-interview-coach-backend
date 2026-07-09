import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';

/** Stable per-process id so Nginx LB distribution is visible via X-Instance-Id. */
export const INSTANCE_ID =
  process.env.INSTANCE_ID?.trim() ||
  `${hostname()}-${process.pid}-${randomBytes(3).toString('hex')}`;
