import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { InterviewEvaluationService } from './interview-evaluation.service';
import { Session, SessionSchema } from './session.schema';
import { QuestionsModule } from '../questions/questions.module';
import { AnswersModule } from '../answers/answers.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    QuestionsModule,
    AnswersModule,
    RolesModule,
    UsersModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService, InterviewEvaluationService],
  exports: [SessionsService],
})
export class SessionsModule {}
