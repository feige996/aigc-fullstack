import type { ApiClient } from './types'

export function createAssetsApi(api: ApiClient) {
  return {
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
