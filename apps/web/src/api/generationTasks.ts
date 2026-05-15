import type { ApiClient } from './types'
import type { CreateTaskResponse, Task } from '../types'

export interface CreateGenerationTaskInput {
  projectId?: string
  type: string
  model: string
  prompt: string
  ratio: string
  referenceAssetIds: string[]
}

export function createGenerationTasksApi(api: ApiClient, apiBaseUrl: string) {
  return {
    async list() {
      const response = await api.request('/generation/tasks')

      if (!response.ok) {
        return []
      }

      const result = (await response.json()) as { items: Task[] }
      return result.items
    },

    create(input: CreateGenerationTaskInput) {
      return api.requestJson<CreateTaskResponse>(
        '/generation/tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        },
        'Create task',
      )
    },

    get(taskId: string) {
      return api.requestJson<Task>(
        `/generation/tasks/${taskId}`,
        {},
        'Fetch task',
      )
    },

    cancel(taskId: string) {
      return api.requestJson(
        `/generation/tasks/${taskId}/cancel`,
        {
          method: 'POST',
        },
        'Cancel task',
      )
    },

    eventsUrl(accessToken: string) {
      return `${apiBaseUrl}/generation/tasks/events?access_token=${encodeURIComponent(accessToken)}`
    },
  }
}
