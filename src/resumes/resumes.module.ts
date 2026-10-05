import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LlmModule } from '../llm/llm.module';
import { RolesModule } from '../roles/roles.module';
import { Resume, ResumeSchema } from './resume.schema';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { ResumeExtractionService } from './resume-extraction.service';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Resume.name, schema: ResumeSchema }]),
    LlmModule,
    RolesModule,
  ],
  controllers: [ResumesController],
  providers: [ResumesService, ResumeExtractionService],
  exports: [ResumesService],
})
export class ResumesModule {}
