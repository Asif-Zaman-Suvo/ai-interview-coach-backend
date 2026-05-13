import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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

  createdAt?: Date;
  updatedAt?: Date;
}

export type SessionDocument = Session & Document;
export const SessionSchema = SchemaFactory.createForClass(Session);
