import type { ApiClient } from './types'
import type { Project } from '../types'

export interface CreateProjectInput {
  name: string
  description: string
}

export function createProjectsApi(api: ApiClient) {
  return {
    async list() {
      const response = await api.request('/projects')

      if (!response.ok) {
        return []
      }

      const result = (await response.json()) as { items: Project[] }
      return result.items
    },

    create(input: CreateProjectInput) {
      return api.requestJson<Project>(
        '/projects',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        },
        'Create project',
      )
    },
  }
}
