import type { Ref, WatchStopHandle } from 'vue'
import { ref, shallowRef, watch } from 'vue'

const refreshHandler = shallowRef<(() => Promise<void> | void) | null>(null)
const refreshLoading = ref(false)
let stopLoadingWatch: WatchStopHandle | null = null

export function useAdminPageActions() {
  function setRefreshAction(
    handler: (() => Promise<void> | void) | null,
    loading?: Ref<boolean>,
  ) {
    refreshHandler.value = handler
    stopLoadingWatch?.()
    refreshLoading.value = loading?.value ?? false
    stopLoadingWatch = loading
      ? watch(loading, (value) => {
          refreshLoading.value = value
        })
      : null
  }

  async function refreshCurrentPage() {
    if (!refreshHandler.value) {
      return
    }

    await refreshHandler.value()
  }

  function clearRefreshAction(handler: (() => Promise<void> | void) | null) {
    if (refreshHandler.value === handler) {
      refreshHandler.value = null
      refreshLoading.value = false
      stopLoadingWatch?.()
      stopLoadingWatch = null
    }
  }

  return {
    refreshHandler,
    refreshLoading,
    setRefreshAction,
    refreshCurrentPage,
    clearRefreshAction,
  }
}
