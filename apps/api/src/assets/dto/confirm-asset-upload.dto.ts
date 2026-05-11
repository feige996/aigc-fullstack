import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class ConfirmAssetUploadDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500 * 1024 * 1024)
  size?: number

  @IsOptional()
  @IsString()
  checksum?: string
}
