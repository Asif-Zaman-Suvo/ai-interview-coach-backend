import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { TestimonialDocument } from './testimonial.schema';
import { Testimonial } from './testimonial.schema';
import type { CreateTestimonialDto } from './dto/create-testimonial.dto';

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectModel(Testimonial.name)
    private readonly testimonialModel: Model<TestimonialDocument>,
  ) {}

  listPublic(limit = 12) {
    const cap = Math.min(50, Math.max(1, limit));
    return this.testimonialModel
      .find({ published: true })
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean()
      .exec();
  }

  findByUserId(userId: string) {
    return this.testimonialModel.findOne({ userId }).lean().exec();
  }

  async upsertForUser(userId: string, dto: CreateTestimonialDto) {
    const doc = await this.testimonialModel
      .findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            rating: dto.rating,
            quote: dto.quote.trim(),
            authorName: dto.authorName.trim(),
            authorRole: dto.authorRole.trim(),
            published: true,
          },
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
    return doc;
  }
}
