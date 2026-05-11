import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'

export class CreateGenerationTaskDto {
  @IsOptional()
  @IsString()
  clientRequestId?: string

  @IsOptional()
  @IsString()
  projectId?: string

  @IsString()
  type!: string

  @IsString()
  model!: string

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string

  @IsOptional()
  @IsString()
  ratio?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceAssetIds?: string[]
}
