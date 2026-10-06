import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { Difficulty, QuestionType } from '../questions/question.schema';
import type { QuestionSource } from './question-generation.contract';

@Schema({ _id: false })
export class SessionQuestionSnapshot {
  @Prop({ type: Types.ObjectId, required: true }) _id!: Types.ObjectId;
  @Prop({ required: true }) roleId!: string;
  @Prop({ required: true }) text!: string;
  @Prop({ required: true }) idealAnswer!: string;
  @Prop({ type: String, required: true, enum: ['technical', 'behavioral'] })
  type!: QuestionType;
  @Prop({ type: String, required: true, enum: ['Easy', 'Medium', 'Hard'] })
  difficulty!: Difficulty;
  @Prop({
    type: String,
    required: true,
    enum: ['resume_personalized', 'target_role', 'curated_bank'],
  })
  source!: QuestionSource;
  @Prop() bankQuestionId?: string;
  @Prop() competency?: string;
  @Prop() rationale?: string;
  @Prop({ type: [String], default: undefined }) resumeEvidence?: string[];
}
const SessionQuestionSnapshotSchema = SchemaFactory.createForClass(
  SessionQuestionSnapshot,
);

export type SessionStatus = 'active' | 'completed';

@Schema({ timestamps: true })
export class Session {
  _id: Types.ObjectId;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  roleId!: string;

  @Prop({ type: String, enum: ['active', 'completed'], default: 'active' })
  status!: SessionStatus;

  @Prop({ type: String, enum: ['Easy', 'Medium', 'Hard'], required: true })
  difficulty!: string;

  @Prop()
  resumeId?: string;

  /** Atomic, immutable interview context. Only explicit learner DTOs may leave the server. */
  @Prop({ type: [SessionQuestionSnapshotSchema], default: undefined })
  questionSnapshots?: SessionQuestionSnapshot[];

  @Prop({ enum: ['personalized_hybrid', 'curated_fallback', 'bank_only'] })
  questionGenerationMode?:
    | 'personalized_hybrid'
    | 'curated_fallback'
    | 'bank_only';

  @Prop() targetRoleName?: string;

  @Prop({ default: 0 })
  score!: number;

  @Prop()
  summary?: string;

  @Prop({ enum: ['llm', 'heuristic_fallback'] })
  summarySource?: 'llm' | 'heuristic_fallback';

  @Prop({ type: [String], default: [] })
  topImprovements!: string[];

  /** Legacy ordered bank references. New interviews use questionSnapshots. */
  @Prop({ type: [String] })
  scheduledBankQuestionIds?: string[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);
