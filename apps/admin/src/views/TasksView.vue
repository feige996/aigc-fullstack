<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import TaskDashboard from '../features/aigc-generation/TaskDashboard.vue'
import { useAdminPageActions } from '../composables/useAdminPageActions'
import { useAdminSession } from '../composables/useAdminSession'
import type { Asset, ListResponse, Task, TaskStatus } from '../types'

type TaskStatusFilter = TaskStatus | 'all'

const api = useAdminSession()
const pageActions = useAdminPageActions()
const tasks = ref<Task[]>([])
const selectedTask = ref<Task | null>(null)
const totalTasks = ref(0)
const page = ref(1)
const pageSize = ref(20)
const searchQuery = ref('')
const statusFilter = ref<TaskStatusFilter>('all')
const isLoading = ref(false)
const isRetrying = ref(false)
const isCanceling = ref(false)

const failedTasks = computed(
  () =>
    tasks.value.filter(
      (task) => task.status === 'failed' || task.status === 'final_failed',
    ).length,
)
const succeededTasks = computed(
  () => tasks.value.filter((task) => task.status === 'succeeded').length,
)
const runningTasks = computed(
  () =>
    tasks.value.filter(
      (task) => task.status === 'running' || task.status === 'retrying',
    ).length,
)
const pendingTasks = computed(
  () =>
    tasks.value.filter(
      (task) =>
        task.status === 'draft' ||
        task.status === 'validating' ||
        task.status === 'pending' ||
        task.status === 'queued',
    ).length,
)

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function showError(error: unknown, fallback: string) {
  ElMessage.error(toErrorMessage(error, fallback))
}

async function loadTasks() {
  isLoading.value = true

  try {
    const result = await api.requestJson<ListResponse<Task>>(
      `/generation/tasks/admin${api.buildQuery({
        page: page.value,
        pageSize: pageSize.value,
        search: searchQuery.value.trim(),
        status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      })}`,
      {},
      'Load tasks',
    )
    tasks.value = result.items
    totalTasks.value = result.total

    const selectedListTask = selectedTask.value
      ? result.items.find((task) => task.taskId === selectedTask.value?.taskId)
      : null

    if (selectedListTask) {
      await selectTask(selectedListTask)
    } else if (result.items[0]) {
      await selectTask(result.items[0])
    } else {
      selectedTask.value = null
    }
  } catch (error) {
    showError(error, 'Load tasks failed')
  } finally {
    isLoading.value = false
  }
}

function updatePage(nextPage: number) {
  page.value = nextPage
  loadTasks()
}

function updatePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize
  page.value = 1
  loadTasks()
}

let searchTimer: number | undefined

watch([searchQuery, statusFilter], () => {
  page.value = 1
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    loadTasks()
  }, 250)
})

async function selectTask(task: Task) {
  const response = await api.request(`/generation/tasks/${task.taskId}`)

  if (!response.ok) {
    selectedTask.value = task
    return
  }

  selectedTask.value = (await response.json()) as Task
}

async function retrySelectedTask() {
  if (!selectedTask.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `Retry task ${selectedTask.value.taskId}?`,
      'Confirm Retry',
      {
        confirmButtonText: 'Retry',
        cancelButtonText: 'Cancel',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  isRetrying.value = true

  try {
    const retried = await api.requestJson<{ taskId: string }>(
      `/generation/tasks/${selectedTask.value.taskId}/retry`,
      {
        method: 'POST',
      },
      'Retry task',
    )
    await loadTasks()
    const task = tasks.value.find((item) => item.taskId === retried.taskId)

    if (task) {
      await selectTask(task)
    }
  } catch (error) {
    showError(error, 'Retry task failed')
  } finally {
    isRetrying.value = false
  }
}

async function cancelSelectedTask() {
  if (!selectedTask.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `Cancel task ${selectedTask.value.taskId}? This operation may stop active generation.`,
      'Confirm Cancel',
      {
        confirmButtonText: 'Cancel Task',
        cancelButtonText: 'Keep Task',
        confirmButtonClass: 'el-button--danger',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  isCanceling.value = true

  try {
    const canceled = await api.requestJson<{ taskId: string }>(
      `/generation/tasks/${selectedTask.value.taskId}/cancel`,
      {
        method: 'POST',
      },
      'Cancel task',
    )
    await loadTasks()
    const task = tasks.value.find((item) => item.taskId === canceled.taskId)

    if (task) {
      await selectTask(task)
    }
  } catch (error) {
    showError(error, 'Cancel task failed')
  } finally {
    isCanceling.value = false
  }
}

async function downloadAsset(asset: Asset) {
  try {
    const result = await api.requestJson<{ url: string }>(
      `/assets/${asset.assetId}/download`,
      {
        method: 'POST',
      },
      'Create download',
    )
    window.open(result.url, '_blank', 'noopener')
  } catch (error) {
    showError(error, 'Create download failed')
  }
}

function canRetry(task: Task | null) {
  return Boolean(
    task &&
    task.status !== 'succeeded' &&
    task.status !== 'running' &&
    task.status !== 'retrying',
  )
}

function canCancel(task: Task | null) {
  return Boolean(
    task &&
    task.status !== 'succeeded' &&
    task.status !== 'canceled' &&
    task.status !== 'final_failed' &&
    task.status !== 'rejected',
  )
}

function statusType(status: TaskStatus) {
  if (status === 'succeeded') {
    return 'success' as const
  }

  if (
    status === 'failed' ||
    status === 'final_failed' ||
    status === 'rejected'
  ) {
    return 'danger' as const
  }

  if (status === 'queued' || status === 'running' || status === 'retrying') {
    return 'warning' as const
  }

  return 'info' as const
}

onMounted(() => {
  pageActions.setRefreshAction(loadTasks, isLoading)
  loadTasks()
})

onUnmounted(() => {
  pageActions.clearRefreshAction(loadTasks)
})
</script>

<template>
  <TaskDashboard
    :tasks="tasks"
    :selected-task="selectedTask"
    :total-tasks="totalTasks"
    :succeeded-tasks="succeededTasks"
    :failed-tasks="failedTasks"
    :running-tasks="runningTasks"
    :pending-tasks="pendingTasks"
    :search-query="searchQuery"
    :status-filter="statusFilter"
    :page="page"
    :page-size="pageSize"
    :is-loading="isLoading"
    :is-retrying="isRetrying"
    :is-canceling="isCanceling"
    :can-retry="canRetry"
    :can-cancel="canCancel"
    :status-type="statusType"
    @update:search-query="searchQuery = $event"
    @update:status-filter="statusFilter = $event"
    @select-task="selectTask"
    @retry-selected-task="retrySelectedTask"
    @cancel-selected-task="cancelSelectedTask"
    @download-asset="downloadAsset"
    @update-page="updatePage"
    @update-page-size="updatePageSize"
  />
</template>
