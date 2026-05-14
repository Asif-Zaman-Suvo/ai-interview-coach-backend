import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Session } from '../auth/session.decorator';
import type { UserSession } from '../auth/auth.types';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  @Put('users/:id/plan')
  async updateUserPlan(
    @Param('id') id: string,
    @Body() body: { plan: 'free' | 'pack_10' | 'pack_30' },
  ) {
    return this.adminService.updateUserPlan(id, body.plan);
  }

  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
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
