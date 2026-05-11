import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

interface PresignedPutInput {
  bucket: string
  objectKey: string
  mimeType: string
  expiresInSeconds?: number
}

interface PresignedGetInput {
  bucket: string
  objectKey: string
  expiresInSeconds?: number
}

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client

  constructor(private readonly configService: ConfigService) {
    this.client = new S3Client({
      region: this.configService.get<string>('OBJECT_STORAGE_REGION') ?? 'local',
      endpoint: this.configService.get<string>('OBJECT_STORAGE_ENDPOINT') ?? 'http://localhost:9000',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>('OBJECT_STORAGE_ACCESS_KEY') ?? 'minioadmin',
        secretAccessKey: this.configService.get<string>('OBJECT_STORAGE_SECRET_KEY') ?? 'minioadmin'
      }
    })
  }

  get provider() {
    return this.configService.get<string>('OBJECT_STORAGE_PROVIDER') ?? 'minio'
  }

  get defaultBucket() {
    return this.configService.get<string>('OBJECT_STORAGE_BUCKET') ?? 'aigc-assets'
  }

  async createPresignedUploadUrl({
    bucket,
    objectKey,
    mimeType,
    expiresInSeconds = 900
  }: PresignedPutInput) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: mimeType
      }),
      {
        expiresIn: expiresInSeconds
      }
    )
  }

  async createPresignedDownloadUrl({ bucket, objectKey, expiresInSeconds = 900 }: PresignedGetInput) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey
      }),
      {
        expiresIn: expiresInSeconds
      }
    )
  }
}
