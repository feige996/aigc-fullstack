import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Asset, AssetStatus } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import type { AuthenticatedUser } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { ObjectStorageService } from '../storage/object-storage.service'
import type { ConfirmAssetUploadDto } from './dto/confirm-asset-upload.dto'
import type { CreateAssetUploadDto } from './dto/create-asset-upload.dto'

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService
  ) {}

  async createUpload(user: AuthenticatedUser, dto: CreateAssetUploadDto) {
    await this.assertProjectAccess(user.id, dto.projectId)
    await this.assertTaskAccess(user.id, dto.taskId)

    const assetId = `asset_${randomUUID()}`
    const objectKey = this.buildObjectKey({
      userId: user.id,
      taskId: dto.taskId,
      assetId,
      fileName: dto.fileName
    })
    const bucket = this.objectStorage.defaultBucket
    const uploadUrl = await this.objectStorage.createPresignedUploadUrl({
      bucket,
      objectKey,
      mimeType: dto.mimeType
    })

    const asset = await this.prisma.asset.create({
      data: {
        id: assetId,
        userId: user.id,
        projectId: dto.projectId,
        taskId: dto.taskId,
        type: dto.type,
        status: 'temporary',
        provider: this.objectStorage.provider,
        bucket,
        objectKey,
        mimeType: dto.mimeType,
        size: dto.size,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    })

    return {
      asset: this.serializeAsset(asset),
      upload: {
        method: 'PUT',
        url: uploadUrl,
        headers: {
          'Content-Type': dto.mimeType
        },
        expiresInSeconds: 900
      }
    }
  }

  async confirmUpload(user: AuthenticatedUser, assetId: string, dto: ConfirmAssetUploadDto) {
    const asset = await this.findAccessibleAsset(user, assetId)

    if (asset.status !== 'temporary') {
      throw new BadRequestException('Only temporary assets can be confirmed')
    }

    const updatedAsset = await this.prisma.asset.update({
      where: {
        id: asset.id
      },
      data: {
        status: 'active',
        size: dto.size ?? asset.size,
        checksum: dto.checksum,
        expiresAt: null
      }
    })

    return this.serializeAsset(updatedAsset)
  }

  async listAssets(user: AuthenticatedUser) {
    const assets = await this.prisma.asset.findMany({
      where: this.assetAccessWhere(user),
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    })

    return {
      items: assets.map((asset) => this.serializeAsset(asset))
    }
  }

  async createDownload(user: AuthenticatedUser, assetId: string) {
    const asset = await this.findAccessibleAsset(user, assetId)

    if (!['active', 'temporary', 'processing'].includes(asset.status)) {
      throw new BadRequestException(`Asset with status ${asset.status} cannot be downloaded`)
    }

    const url = await this.objectStorage.createPresignedDownloadUrl({
      bucket: asset.bucket,
      objectKey: asset.objectKey
    })

    return {
      url,
      expiresInSeconds: 900
    }
  }

  private async assertProjectAccess(userId: string, projectId?: string) {
    if (!projectId) {
      return
    }

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
        status: 'active'
      },
      select: {
        id: true
      }
    })

    if (!project) {
      throw new BadRequestException('Project is invalid or archived')
    }
  }

  private async assertTaskAccess(userId: string, taskId?: string) {
    if (!taskId) {
      return
    }

    const task = await this.prisma.generationTask.findFirst({
      where: {
        id: taskId,
        userId
      },
      select: {
        id: true
      }
    })

    if (!task) {
      throw new BadRequestException('Task is invalid')
    }
  }

  private async findAccessibleAsset(user: AuthenticatedUser, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        ...this.assetAccessWhere(user)
      }
    })

    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} was not found`)
    }

    return asset
  }

  private assetAccessWhere(user: AuthenticatedUser) {
    if (user.role === 'admin' || user.role === 'super_admin') {
      return {}
    }

    return {
      userId: user.id
    }
  }

  private buildObjectKey({
    userId,
    taskId,
    assetId,
    fileName
  }: {
    userId: string
    taskId?: string
    assetId: string
    fileName: string
  }) {
    const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
    const extension = extname(fileName).toLowerCase()

    if (taskId) {
      return `aigc/${env}/${userId}/${taskId}/input/${assetId}${extension}`
    }

    const date = new Date().toISOString().slice(0, 10)
    return `aigc/${env}/temp/${date}/${assetId}${extension}`
  }

  private serializeAsset(asset: Asset) {
    return {
      assetId: asset.id,
      userId: asset.userId,
      projectId: asset.projectId,
      taskId: asset.taskId,
      type: asset.type,
      status: asset.status as AssetStatus,
      provider: asset.provider,
      bucket: asset.bucket,
      objectKey: asset.objectKey,
      mimeType: asset.mimeType,
      size: asset.size,
      checksum: asset.checksum,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
      expiresAt: asset.expiresAt?.toISOString() ?? null,
      deletedAt: asset.deletedAt?.toISOString() ?? null,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString()
    }
  }
}
