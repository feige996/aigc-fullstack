import { aigcGenerationFeature } from '@aigc/shared-contracts'

export const adminFeatureManifests = [aigcGenerationFeature] as const

export function listAdminFeatureManifests() {
  return adminFeatureManifests
}
