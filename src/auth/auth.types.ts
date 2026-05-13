export type {
  BaseUserSession,
  UserSession,
} from '@thallesp/nestjs-better-auth';

/** App-level user shape (e.g. from JWT/session `user`); extend when plugins add fields. */
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
  image?: string | null;
}
