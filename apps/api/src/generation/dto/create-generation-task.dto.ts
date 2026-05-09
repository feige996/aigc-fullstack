export class CreateGenerationTaskDto {
  clientRequestId?: string
  type!: string
  model!: string
  prompt!: string
  ratio?: string
  duration?: number
  referenceAssetIds?: string[]
}
