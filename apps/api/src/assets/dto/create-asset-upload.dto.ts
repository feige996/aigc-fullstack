import { AssetType } from '@prisma/client'
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class CreateAssetUploadDto {
  @IsEnum(AssetType)
  type!: AssetType

  @IsString()
  @MaxLength(160)
  fileName!: string

  @IsString()
  @MaxLength(120)
  mimeType!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500 * 1024 * 1024)
  size?: number

  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsString()
  taskId?: string
}
