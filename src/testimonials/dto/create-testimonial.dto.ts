import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTestimonialDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(20)
  @MaxLength(600)
  quote!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  authorName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  authorRole!: string;
}
