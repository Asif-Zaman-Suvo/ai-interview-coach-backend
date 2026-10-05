import { IsMongoId, IsString, MaxLength, Matches } from 'class-validator';
export class SubmitAnswerDto {
  @IsMongoId()
  questionId!: string;
  @IsString()
  @MaxLength(12000)
  @Matches(/\S/, { message: 'transcript must contain an answer' })
  transcript!: string;
}
