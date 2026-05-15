import type { ApiClient } from './types'
import type { ListResponse, Task, TaskStatus } from '../types'

export interface ListAdminTasksParams {
  page: number
  pageSize: number
  search?: string
  status?: TaskStatus
}

export function createGenerationTasksApi(api: ApiClient) {
  return {
    listAdmin(params: ListAdminTasksParams) {
      return api.requestJson<ListResponse<Task>>(
        `/generation/tasks/admin${api.buildQuery(params)}`,
        {},
        'Load tasks',
      )
    },

    get(taskId: string) {
      return api.requestJson<Task>(
        `/generation/tasks/${taskId}`,
        {},
        'Fetch task',
      )
    },

    retry(taskId: string) {
      return api.requestJson<{ taskId: string }>(
        `/generation/tasks/${taskId}/retry`,
        {
          method: 'POST',
        },
        'Retry task',
      )
    },

    cancel(taskId: string) {
      return api.requestJson<{ taskId: string }>(
        `/generation/tasks/${taskId}/cancel`,
        {
          method: 'POST',
        },
        'Cancel task',
      )
    },
  }
}
