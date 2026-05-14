import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

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

  @Prop({ default: 0 })
  score!: number;

  @Prop()
  summary?: string;

  @Prop({ type: [String], default: [] })
  topImprovements!: string[];

  /** Ordered bank question `_id`s for this interview (no copies in Question collection). */
  @Prop({ type: [String] })
  scheduledBankQuestionIds?: string[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);
