import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserRole = 'user' | 'admin';

@Schema({ collection: 'user_profiles', timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  email!: string;

  @Prop()
  name?: string;

  @Prop({ type: String, enum: ['user', 'admin'], default: 'user' })
  role!: UserRole;

  createdAt?: Date;
  updatedAt?: Date;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
