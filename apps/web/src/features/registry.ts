import { aigcGenerationFeature } from '@aigc/shared-contracts'

export const webFeatureManifests = [aigcGenerationFeature] as const

export function listWebFeatureManifests() {
  return webFeatureManifests
}
