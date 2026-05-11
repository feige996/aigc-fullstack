import { aigcGenerationFeature } from '@aigc/shared-contracts'

export const apiFeatureManifests = [aigcGenerationFeature] as const

export function listApiFeatureManifests() {
  return apiFeatureManifests
}
