import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TestimonialsService } from './testimonials.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';

function canonicalUserId(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get('public')
  async getPublic(@Query('limit') limit?: string) {
    const n = Number(limit);
    const docs = await this.testimonialsService.listPublic(
      Number.isFinite(n) ? n : 12,
    );
    return {
      items: docs.map((d) => ({
        id: String(d._id),
        rating: d.rating,
        quote: d.quote,
        name: d.authorName,
        role: d.authorRole,
      })),
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMine(@Req() req: AuthenticatedRequest) {
    const userId = canonicalUserId(req.user.id);
    const doc = await this.testimonialsService.findByUserId(userId);
    if (!doc) {
      return { testimonial: null as null };
    }
    return {
      testimonial: {
        id: String(doc._id),
        rating: doc.rating,
        quote: doc.quote,
        name: doc.authorName,
        role: doc.authorRole,
      },
    };
  }

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTestimonialDto,
  ) {
    const userId = canonicalUserId(req.user.id);
    const doc = await this.testimonialsService.upsertForUser(userId, dto);
    return {
      id: String(doc!._id),
      rating: doc!.rating,
      quote: doc!.quote,
      name: doc!.authorName,
      role: doc!.authorRole,
    };
  }
}
