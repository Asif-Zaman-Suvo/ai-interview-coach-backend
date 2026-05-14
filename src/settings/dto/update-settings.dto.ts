import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  weeklyDigest?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sessionReminders?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  productTips?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  interviewDefaultRole?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  interviewDefaultDifficulty?: string | null;
}

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
