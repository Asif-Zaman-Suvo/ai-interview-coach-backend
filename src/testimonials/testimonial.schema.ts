import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'testimonials', timestamps: true })
export class Testimonial {
  /** Better Auth user id */
  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ required: true })
  quote!: string;

  @Prop({ required: true })
  authorName!: string;

  @Prop({ required: true })
  authorRole!: string;

  @Prop({ type: Boolean, default: true })
  published!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export type TestimonialDocument = HydratedDocument<Testimonial>;
export const TestimonialSchema = SchemaFactory.createForClass(Testimonial);
