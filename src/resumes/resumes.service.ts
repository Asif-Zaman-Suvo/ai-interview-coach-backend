import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LLM_PROVIDER } from '../llm/llm-provider.interface';
import type { LlmProvider } from '../llm/llm-provider.interface';
import { RolesService } from '../roles/roles.service';
import { Resume, ResumeDocument } from './resume.schema';
import { ResumeExtractionService } from './resume-extraction.service';
import type { ResumeFile } from './resume-extraction.service';
import {
  resumeAnalysisContext,
  resumeAnalysisSystem,
  resumeProfileSchema,
  validateResumeProfile,
} from './resume.contract';

@Injectable()
export class ResumesService {
  private readonly analyses = new Map<
    string,
    Promise<ReturnType<ResumesService['publicView']>>
  >();
  constructor(
    @InjectModel(Resume.name) private readonly model: Model<ResumeDocument>,
    private readonly extraction: ResumeExtractionService,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly roles: RolesService,
  ) {}

  publicView(doc: ResumeDocument) {
    return {
      id: String(doc._id),
      status: doc.status,
      format: doc.format,
      profile: doc.reviewedProfile ?? doc.analysis ?? null,
      targetRoleId: doc.targetRoleId ?? null,
      difficulty: doc.difficulty ?? null,
    };
  }
  async upload(userId: string, file?: ResumeFile) {
    const extracted = await this.extraction.extract(file);
    const doc = await this.model.create({
      userId,
      extractedText: extracted.text,
      format: extracted.format,
      sizeBytes: extracted.sizeBytes,
    });
    return this.publicView(doc);
  }
  private async owned(id: string, userId: string, text = false) {
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id))
      throw new BadRequestException('Invalid resume ID.');
    const query = this.model.findOne({ _id: id, userId });
    if (text) query.select('+extractedText');
    const doc = await query.exec();
    if (!doc) throw new NotFoundException('Resume not found.');
    return doc;
  }
  async get(id: string, userId: string) {
    return this.publicView(await this.owned(id, userId));
  }
  async analyze(id: string, userId: string) {
    const doc = await this.owned(id, userId, true);
    if (doc.analysis) return this.publicView(doc);
    const key = `${userId}:${id}`;
    let pending = this.analyses.get(key);
    if (!pending) {
      pending = this.generate(doc);
      this.analyses.set(key, pending);
    }
    try {
      return await pending;
    } finally {
      if (this.analyses.get(key) === pending) this.analyses.delete(key);
    }
  }
  private async generate(doc: ResumeDocument) {
    try {
      const output = await this.provider.generateStructured({
        system: resumeAnalysisSystem,
        context: resumeAnalysisContext(doc.extractedText),
        schemaName: 'resume_profile',
        schema: resumeProfileSchema,
        maxOutputTokens: 3000,
      });
      const profile = validateResumeProfile(output);
      const saved = await this.model
        .findOneAndUpdate(
          { _id: doc._id, userId: doc.userId },
          {
            $set: { analysis: profile, status: 'analyzed' },
            $unset: { errorCode: 1 },
          },
          { new: true, runValidators: true },
        )
        .exec();
      if (!saved) throw new NotFoundException('Resume not found.');
      return this.publicView(saved);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const code =
        error instanceof Error && error.message === 'provider_timeout'
          ? 'ANALYSIS_TIMEOUT'
          : error instanceof SyntaxError ||
              (error instanceof Error &&
                [
                  'invalid_resume_profile',
                  'provider_invalid_response',
                  'provider_output_limit',
                ].includes(error.message))
            ? 'ANALYSIS_INVALID_OUTPUT'
            : 'ANALYSIS_UNAVAILABLE';
      await this.model
        .updateOne(
          { _id: doc._id, userId: doc.userId, analysis: { $exists: false } },
          { $set: { status: 'analysis_failed', errorCode: code } },
        )
        .exec();
      throw new HttpException(
        {
          code,
          message:
            code === 'ANALYSIS_TIMEOUT'
              ? 'Resume analysis timed out. Retry without uploading again.'
              : code === 'ANALYSIS_INVALID_OUTPUT'
                ? 'Resume analysis returned an invalid profile. Please retry.'
                : 'Resume analysis is temporarily unavailable. Retry without uploading again.',
        },
        code === 'ANALYSIS_TIMEOUT'
          ? 504
          : code === 'ANALYSIS_INVALID_OUTPUT'
            ? 502
            : 503,
      );
    }
  }
  async confirm(id: string, userId: string, body: unknown) {
    const doc = await this.owned(id, userId);
    if (!doc.analysis)
      throw new BadRequestException(
        'Analyze your resume before confirming it.',
      );
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Invalid profile confirmation.');
    const data = body as Record<string, unknown>;
    if (
      Object.keys(data).some(
        (k) => !['profile', 'targetRoleId', 'difficulty'].includes(k),
      ) ||
      typeof data.targetRoleId !== 'string' ||
      !Types.ObjectId.isValid(data.targetRoleId) ||
      typeof data.difficulty !== 'string' ||
      !['Easy', 'Medium', 'Hard'].includes(data.difficulty)
    )
      throw new BadRequestException(
        'Choose a valid target role and difficulty.',
      );
    let profile;
    try {
      profile = validateResumeProfile(data.profile);
    } catch {
      throw new BadRequestException(
        'The reviewed profile contains invalid or oversized fields.',
      );
    }
    if (!(await this.roles.findById(data.targetRoleId)))
      throw new BadRequestException('Target role not found.');
    const saved = await this.model
      .findOneAndUpdate(
        { _id: id, userId },
        {
          $set: {
            reviewedProfile: profile,
            targetRoleId: data.targetRoleId,
            difficulty: data.difficulty,
            status: 'confirmed',
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!saved) throw new NotFoundException('Resume not found.');
    return this.publicView(saved);
  }
  async assertConfirmed(
    id: string,
    userId: string,
    roleId: string,
    difficulty: string,
  ) {
    const doc = await this.owned(id, userId);
    if (
      doc.status !== 'confirmed' ||
      doc.targetRoleId !== roleId ||
      doc.difficulty !== difficulty
    )
      throw new BadRequestException(
        'Review and confirm your resume profile for this target role and difficulty first.',
      );
  }
  async deleteForUser(userId: string) {
    await this.model.deleteMany({ userId }).exec();
  }
}
