import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthenticatedUser } from '../auth/auth.types'
import { AssetsService } from './assets.service'
import { ConfirmAssetUploadDto } from './dto/confirm-asset-upload.dto'
import { CreateAssetUploadDto } from './dto/create-asset-upload.dto'

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('uploads')
  createUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssetUploadDto) {
    return this.assetsService.createUpload(user, dto)
  }

  @Post(':assetId/confirm')
  confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assetId') assetId: string,
    @Body() dto: ConfirmAssetUploadDto
  ) {
    return this.assetsService.confirmUpload(user, assetId, dto)
  }

  @Post(':assetId/download')
  createDownload(@CurrentUser() user: AuthenticatedUser, @Param('assetId') assetId: string) {
    return this.assetsService.createDownload(user, assetId)
  }

  @Get()
  listAssets(@CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.listAssets(user)
  }
}
