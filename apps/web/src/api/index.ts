import { createAssetsApi } from './assets'
import { createAuthApi } from './auth'
import { createGenerationTasksApi } from './generationTasks'
import { createProjectsApi } from './projects'
import type { ApiClient } from './types'

export function createWebApi(api: ApiClient, apiBaseUrl: string) {
  return {
    assets: createAssetsApi(api),
    auth: createAuthApi(api),
    generationTasks: createGenerationTasksApi(api, apiBaseUrl),
    projects: createProjectsApi(api),
  }
}
