import { Module } from '@nestjs/common';
import { AuthModule as NestBetterAuthModule } from '@thallesp/nestjs-better-auth';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createBetterAuthRootOptions } from './better-auth.factory';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    NestBetterAuthModule.forRootAsync({
      isGlobal: true,
      imports: [UsersModule, NotificationsModule],
      inject: [UsersService, NotificationsService],
      useFactory: createBetterAuthRootOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
