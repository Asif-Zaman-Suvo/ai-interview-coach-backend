import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { ResumeProfile } from './resume.contract';

@Schema({ timestamps: true, collection: 'resumes' })
export class Resume {
  @Prop({ required: true, index: true }) userId!: string;
  @Prop({ required: true, select: false, maxlength: 30000 })
  extractedText!: string;
  @Prop({ required: true, enum: ['pdf', 'docx'] }) format!: string;
  @Prop({ required: true }) sizeBytes!: number;
  @Prop({
    enum: ['extracted', 'analysis_failed', 'analyzed', 'confirmed'],
    default: 'extracted',
  })
  status!: string;
  @Prop({ type: Object }) analysis?: ResumeProfile;
  @Prop({ type: Object }) reviewedProfile?: ResumeProfile;
  @Prop() targetRoleId?: string;
  @Prop({ enum: ['Easy', 'Medium', 'Hard'] }) difficulty?: string;
  @Prop() errorCode?: string;
}
export type ResumeDocument = HydratedDocument<Resume>;
export const ResumeSchema = SchemaFactory.createForClass(Resume);
