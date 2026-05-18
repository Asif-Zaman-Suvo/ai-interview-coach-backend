import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { QuestionsModule } from '../questions/questions.module';
import { SessionsModule } from '../sessions/sessions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from '../users/user.schema';
import { Session, SessionSchema } from '../sessions/session.schema';

@Module({
  imports: [
    UsersModule,
    RolesModule,
    QuestionsModule,
    SessionsModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
