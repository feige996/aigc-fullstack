import type { ApiClient } from './types'
import type { Asset, CreateAssetUploadResponse } from '../types'

export interface CreateAssetUploadInput {
  fileName: string
  mimeType: string
  size: number
  projectId?: string
}

export function createAssetsApi(api: ApiClient) {
  return {
    async list() {
      const response = await api.request('/assets')

      if (!response.ok) {
        return []
      }

      const result = (await response.json()) as { items: Asset[] }
      return result.items
    },

    createUpload(input: CreateAssetUploadInput) {
      return api.requestJson<CreateAssetUploadResponse>(
        '/assets/uploads',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'user_upload',
            ...input,
          }),
        },
        'Create upload',
      )
    },

    confirmUpload(assetId: string, size: number) {
      return api.requestJson<Asset>(
        `/assets/${assetId}/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ size }),
        },
        'Confirm upload',
      )
    },

    createDownload(assetId: string) {
      return api.requestJson<{ url: string }>(
        `/assets/${assetId}/download`,
        {
          method: 'POST',
        },
        'Create download',
      )
    },
  }
}
