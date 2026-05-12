<script setup lang="ts">
import type { Asset } from '../types'

defineProps<{
  assets: Asset[]
  selectedAssetIds: string[]
  isUploadingAsset: boolean
}>()

defineEmits<{
  'update:selectedAssetIds': [value: string[]]
  uploadAsset: [event: Event]
}>()

function selectedOptions(event: Event) {
  const select = event.target as HTMLSelectElement
  return Array.from(select.selectedOptions, (option) => option.value)
}
</script>

<template>
  <section class="panel asset-panel">
    <h2>Assets</h2>
    <label>
      Upload Asset
      <input type="file" :disabled="isUploadingAsset" @change="$emit('uploadAsset', $event)" />
    </label>
    <label>
      Reference Assets
      <select
        :value="selectedAssetIds"
        multiple
        size="4"
        @change="$emit('update:selectedAssetIds', selectedOptions($event))"
      >
        <option v-for="asset in assets" :key="asset.assetId" :value="asset.assetId">
          {{ asset.assetId }} / {{ asset.status }}
        </option>
      </select>
    </label>
    <div class="asset-summary">
      <strong>{{ selectedAssetIds.length }}</strong>
      <span>selected</span>
    </div>
  </section>
</template>
