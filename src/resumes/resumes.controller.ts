import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { RateLimitGuard } from '../redis/rate-limit.guard';
import { RateLimit } from '../redis/rate-limit.decorator';
import { ResumesService } from './resumes.service';
import { RESUME_MAX_BYTES } from './resume-extraction.service';
import type { ResumeFile } from './resume-extraction.service';
interface UserRequest {
  user: { id: string };
}
@Controller('resumes')
@UseGuards(AuthGuard)
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}
  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 5,
    windowSeconds: 60,
    prefix: 'resume-upload',
    failClosed: false,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: RESUME_MAX_BYTES, files: 1, fields: 0 },
    }),
  )
  upload(@Req() req: UserRequest, @UploadedFile() file?: ResumeFile) {
    return this.resumes.upload(req.user.id, file);
  }
  @Get(':id')
  get(@Param('id') id: string, @Req() req: UserRequest) {
    return this.resumes.get(id, req.user.id);
  }
  @Post(':id/analyze')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 5,
    windowSeconds: 60,
    prefix: 'resume-analysis',
    failClosed: false,
  })
  analyze(@Param('id') id: string, @Req() req: UserRequest) {
    return this.resumes.analyze(id, req.user.id);
  }
  @Patch(':id/confirm')
  confirm(
    @Param('id') id: string,
    @Req() req: UserRequest,
    @Body() body: unknown,
  ) {
    return this.resumes.confirm(id, req.user.id, body);
  }
}
