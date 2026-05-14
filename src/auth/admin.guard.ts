import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionUser = request.user as { email?: string } | undefined;

    if (!sessionUser?.email) {
      throw new ForbiddenException('User not authenticated');
    }

    const profile = await this.usersService.findByEmail(sessionUser.email);
    if (profile?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
