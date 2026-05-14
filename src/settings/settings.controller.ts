import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Session } from '../auth/session.decorator';
import type { UserSession } from '../auth/auth.types';
import { AuthGuard } from '../auth/auth.guard';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto, DeleteAccountDto } from './dto/update-settings.dto';

function sessionEmail(session: UserSession | null | undefined): string {
  const e = session?.user?.email;
  return typeof e === 'string' ? e.trim().toLowerCase() : '';
}

function sessionUserId(session: UserSession | null | undefined): string {
  const id = session?.user?.id;
  if (typeof id === 'string') return id;
  if (id != null && typeof id !== 'object') return String(id);
  return '';
}

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@Session() session: UserSession) {
    const email = sessionEmail(session);
    if (!email) return {};
    return this.settingsService.getForEmail(email);
  }

  @Patch()
  patch(
    @Session() session: UserSession,
    @Req() req: Request,
    @Body() dto: UpdateSettingsDto,
  ) {
    const email = sessionEmail(session);
    if (!email) return {};
    return this.settingsService.update(email, dto, req);
  }

  @Post('account/delete')
  async deleteAccount(
    @Session() session: UserSession,
    @Req() req: Request,
    @Body() dto: DeleteAccountDto,
  ) {
    const email = sessionEmail(session);
    const userId = sessionUserId(session);
    return this.settingsService.deleteAccount(req, dto.password, userId, email);
  }
}
