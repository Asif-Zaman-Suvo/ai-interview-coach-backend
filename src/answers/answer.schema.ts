import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Answer {
  @Prop({ required: true })
  sessionId!: string;

  @Prop({ required: true })
  questionId!: string;

  /** User reply (explicit name for Mongo; mirrors `transcript` on new saves). */
  @Prop({ required: false })
  userAnswer?: string;

  @Prop({ required: true })
  transcript!: string;

  @Prop({ required: true })
  feedback!: string;

  @Prop({ required: true, min: 0, max: 100 })
  score!: number;

  @Prop({ type: [String], default: [] })
  strengths!: string[];

  @Prop({ type: [String], default: [] })
  improvements!: string[];
}

export type AnswerDocument = HydratedDocument<Answer>;
export const AnswerSchema = SchemaFactory.createForClass(Answer);
