export type {
  BaseUserSession,
  UserSession,
} from '@thallesp/nestjs-better-auth';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
  image?: string | null;
}
