import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Role {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ required: true })
  icon!: string;

  @Prop({ required: true })
  description!: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type RoleDocument = HydratedDocument<Role>;
export const RoleSchema = SchemaFactory.createForClass(Role);
