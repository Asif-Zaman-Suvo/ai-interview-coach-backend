import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Sse,
  MessageEvent,
  Header,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { SessionPayloadService } from '../sessions/session-payload.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Session } from '../auth/session.decorator';
import type { UserSession } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly sessionPayloadService: SessionPayloadService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Purchase alerts for admins (pack upgrades via billing). */
  @Get('notifications')
  async listAdminNotifications(@Query('limit') limit?: string) {
    const n = limit !== undefined ? Number(limit) : undefined;
    return this.notificationsService.listRecent(n);
  }

  /**
   * Server-Sent Events: pushes `{ type: 'purchase', notification }` when a pack is bought.
   * Heartbeat pings keep proxies from closing idle streams.
   */
  @Sse('notifications/stream')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Accel-Buffering', 'no')
  streamPurchaseNotifications(): Observable<MessageEvent> {
    const heartbeat = interval(25000).pipe(
      map(
        () =>
          ({
            data: JSON.stringify({ type: 'ping' }),
          }) as MessageEvent,
      ),
    );
    const purchases = this.notificationsService.purchaseRealtime$.pipe(
      map(
        (notification) =>
          ({
            data: JSON.stringify({ type: 'purchase', notification }),
          }) as MessageEvent,
      ),
    );
    return merge(heartbeat, purchases);
  }

  @Patch('notifications/read-all')
  async markAllAdminNotificationsRead() {
    await this.notificationsService.markAllRead();
    return { ok: true as const };
  }

  @Patch('notifications/:id/read')
  async markAdminNotificationRead(@Param('id') id: string) {
    await this.notificationsService.markRead(id);
    return { ok: true as const };
  }

  @Get('questions/bank')
  async getQuestionBank() {
    return this.adminService.getQuestionBank();
  }

  @Get('users')
  async getAllUsers() {
    return this.adminService.getAdminUsersList();
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  /** All users’ interviews (newest first). */
  @Get('interviews')
  async listAllInterviews(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.listInterviewSessionsGlobally(page, limit);
  }

  /** Full interview detail for moderation (same shape as learner `GET /sessions/:id` + participant). */
  @Get('interviews/:id')
  async getInterviewDetail(@Param('id') id: string) {
    const payload = await this.sessionPayloadService.assembleSessionPayload(id);
    if (!payload) {
      throw new NotFoundException('Session not found');
    }
    const p = await this.adminService.participantForAuthUserId(payload.userId);
    return {
      ...payload,
      participantEmail: p.email,
      participantName: p.name,
    };
  }

  @Post('questions')
  async createQuestion(@Body() body: any) {
    return this.adminService.createQuestion(body);
  }

  @Put('questions/:id')
  async updateQuestion(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateQuestion(id, body);
  }

  @Delete('questions/:id')
  async deleteQuestion(@Param('id') id: string) {
    return this.adminService.deleteQuestion(id);
  }

  @Put('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() body: { role: 'user' | 'admin' },
  ) {
    return this.adminService.updateUserRole(id, body.role);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string, @Session() session: UserSession) {
    const email = session?.user?.email ?? undefined;
    return this.adminService.deleteUser(id, email);
  }

  @Post('roles')
  async createRole(
    @Body() body: { name: string; icon: string; description: string },
  ) {
    const r = await this.adminService.createRole(body);
    return {
      id: r._id,
      name: r.name,
      icon: r.icon,
      description: r.description,
    };
  }

  @Put('roles/:id')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { name?: string; icon?: string; description?: string },
  ) {
    const r = await this.adminService.updateRole(id, body);
    if (!r) return { message: 'Role not found' };
    return {
      id: r._id,
      name: r.name,
      icon: r.icon,
      description: r.description,
    };
  }

  @Delete('roles/:id')
  async deleteRole(@Param('id') id: string) {
    const r = await this.adminService.deleteRole(id);
    return r ?? { message: 'Role not found' };
  }
}
