import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuestionType = 'technical' | 'behavioral';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

@Schema({ timestamps: true })
export class Question {
  _id: Types.ObjectId;

  @Prop({ required: true })
  sessionId!: string;

  @Prop({ required: true })
  roleId!: string;

  @Prop({ required: true })
  text!: string;

  @Prop({ required: true })
  idealAnswer!: string;

  @Prop({ type: String, enum: ['technical', 'behavioral'], required: true })
  type!: QuestionType;

  @Prop({ type: String, enum: ['Easy', 'Medium', 'Hard'], required: true })
  difficulty!: Difficulty;

  createdAt?: Date;
  updatedAt?: Date;
}

export type QuestionDocument = HydratedDocument<Question>;
export const QuestionSchema = SchemaFactory.createForClass(Question);
