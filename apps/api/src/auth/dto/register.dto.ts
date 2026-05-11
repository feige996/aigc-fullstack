import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @IsOptional()
  @IsString()
  phoneCountryCode?: string

  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phoneNumber!: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string
}
