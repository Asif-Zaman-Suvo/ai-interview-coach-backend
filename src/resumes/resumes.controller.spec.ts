jest.mock('../auth/auth.guard', () => ({ AuthGuard: class AuthGuard {} }));
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { AuthGuard } from '../auth/auth.guard';
import { RateLimitGuard } from '../redis/rate-limit.guard';
import { RESUME_MAX_BYTES } from './resume-extraction.service';

describe('authenticated resume HTTP API', () => {
  let app: INestApplication;
  const upload = jest
    .fn()
    .mockResolvedValue({ id: 'resume', status: 'extracted', profile: null });
  const analyze = jest.fn().mockResolvedValue({
    id: 'resume',
    status: 'analyzed',
    profile: { suggestedRole: 'Engineer' },
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ResumesController],
      providers: [{ provide: ResumesService, useValue: { upload, analyze } }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context
            .switchToHttp()
            .getRequest<Request & { user: { id: string } }>();
          if (req.headers['x-test-user'] !== 'candidate')
            throw new UnauthorizedException();
          req.user = { id: 'candidate' };
          return true;
        },
      })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    upload.mockClear();
    analyze.mockClear();
  });
  it('accepts multipart upload and forwards authenticated ownership', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/resumes')
      .set('x-test-user', 'candidate')
      .attach('file', Buffer.from('%PDF-test'), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(upload).toHaveBeenCalledWith(
      'candidate',
      expect.objectContaining({
        originalname: 'resume.pdf',
        buffer: expect.any(Buffer) as unknown,
      }),
    );
  });
  it('rejects oversized multipart files before the service runs', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/resumes')
      .set('x-test-user', 'candidate')
      .attach('file', Buffer.alloc(RESUME_MAX_BYTES + 1), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
    expect(upload).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated uploads before persistence', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/resumes')
      .attach('file', Buffer.from('%PDF-test'), 'resume.pdf')
      .expect(401);
    expect(upload).not.toHaveBeenCalled();
  });
  it('passes authenticated identity to the retry endpoint', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/resumes/resume/analyze')
      .set('x-test-user', 'candidate')
      .expect(201);
    expect(analyze).toHaveBeenCalledWith('resume', 'candidate');
  });
});
