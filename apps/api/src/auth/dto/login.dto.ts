import { IsString, Matches, MinLength } from 'class-validator'

export class LoginDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phoneNumber!: string

  @IsString()
  @MinLength(8)
  password!: string
}
