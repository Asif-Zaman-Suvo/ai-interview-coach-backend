import { Module } from '@nestjs/common';
import { AuthModule as NestBetterAuthModule } from '@thallesp/nestjs-better-auth';
import { UsersModule } from '../users/users.module';
import { createBetterAuthRootOptions } from './better-auth.factory';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    NestBetterAuthModule.forRootAsync({
      isGlobal: true,
      useFactory: createBetterAuthRootOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
