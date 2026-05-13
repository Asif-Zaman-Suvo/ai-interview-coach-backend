import {
  IsEmail,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_STRENGTH_OPTIONS,
} from '../../common/validation/password-policy';

export class SignUpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  @IsStrongPassword(PASSWORD_STRENGTH_OPTIONS, {
    message: PASSWORD_POLICY_MESSAGE,
  })
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
