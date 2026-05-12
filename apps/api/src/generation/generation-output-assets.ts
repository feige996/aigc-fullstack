import type { AssetType, Prisma } from '@prisma/client'
import type { GenerationResultMessage } from '@aigc/shared-contracts'

interface TaskForOutputAssets {
  id: string
  userId: string
  projectId: string | null
}

const outputTypeByMediaType: Record<string, AssetType> = {
  image: 'model_output_raw',
  video: 'model_output_raw'
}

export function buildOutputAssetCreates({
  task,
  message
}: {
  task: TaskForOutputAssets
  message: GenerationResultMessage
}): Prisma.AssetCreateManyInput[] {
  return message.outputs.map((output) => ({
    userId: task.userId,
    projectId: task.projectId,
    taskId: task.id,
    type: outputTypeByMediaType[output.type] ?? 'model_output_raw',
    status: 'active',
    provider: message.provider,
    bucket: bucketFromObjectPath(output.objectPath),
    objectKey: objectKeyFromObjectPath(output.objectPath),
    mimeType: mimeTypeFromOutputType(output.type),
    size: null,
    width: output.width,
    height: output.height,
    duration: output.duration,
    checksum: null,
    expiresAt: null
  }))
}

function bucketFromObjectPath(objectPath: string) {
  const [bucket] = splitStoragePath(objectPath)
  return bucket ?? 'aigc-assets'
}

function objectKeyFromObjectPath(objectPath: string) {
  const [, objectKey] = splitStoragePath(objectPath)
  return objectKey ?? objectPath
}

function splitStoragePath(objectPath: string): [string | null, string | null] {
  const s3Match = objectPath.match(/^s3:\/\/([^/]+)\/(.+)$/)

  if (s3Match) {
    return [s3Match[1], s3Match[2]]
  }

  return [null, objectPath]
}

function mimeTypeFromOutputType(type: string) {
  if (type === 'video') {
    return 'video/mp4'
  }

  return 'image/png'
}
