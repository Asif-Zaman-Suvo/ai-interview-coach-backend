import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { TestimonialDocument } from './testimonial.schema';
import { Testimonial } from './testimonial.schema';
import type { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { RedisService } from '../redis/redis.service';
import { CacheKeys, CacheTtlSeconds } from '../redis/cache-keys';

type PublicTestimonialLean = {
  _id: unknown;
  rating: number;
  quote: string;
  authorName: string;
  authorRole: string;
};

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectModel(Testimonial.name)
    private readonly testimonialModel: Model<TestimonialDocument>,
    private readonly redis: RedisService,
  ) {}

  async listPublic(limit = 12): Promise<PublicTestimonialLean[]> {
    const cap = Math.min(50, Math.max(1, limit));
    const key = CacheKeys.testimonialsPublic(cap);
    const cached = await this.redis.getJson<PublicTestimonialLean[]>(key);
    if (cached) return cached;

    const docs = await this.testimonialModel
      .find({ published: true })
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean()
      .exec();

    await this.redis.setJson(key, docs, CacheTtlSeconds.testimonials);
    return docs;
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
    await this.redis.delByPattern('aic:testimonials:public:*');
    return doc;
  }

  async deleteByUserId(userId: string): Promise<void> {
    const id = (userId ?? '').trim();
    if (!id) return;
    await this.testimonialModel.deleteOne({ userId: id }).exec();
    await this.redis.delByPattern('aic:testimonials:public:*');
  }
}
