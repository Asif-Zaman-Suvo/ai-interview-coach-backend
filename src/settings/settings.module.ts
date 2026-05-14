import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { TestimonialsModule } from '../testimonials/testimonials.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UsersModule, SessionsModule, TestimonialsModule, AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
