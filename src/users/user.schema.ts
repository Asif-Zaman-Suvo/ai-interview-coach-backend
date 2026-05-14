import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { UserRole } from './user-role';

@Schema({ collection: 'user_profiles', timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  email!: string;

  @Prop()
  name?: string;

  @Prop({ type: String, enum: ['user', 'admin'], default: 'user' })
  role!: UserRole;

  @Prop({ default: true })
  weeklyDigest!: boolean;

  @Prop({ default: false })
  sessionReminders!: boolean;

  @Prop({ default: true })
  productTips!: boolean;

  @Prop()
  interviewDefaultRole?: string;

  @Prop()
  interviewDefaultDifficulty?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type { UserRole } from './user-role';

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
