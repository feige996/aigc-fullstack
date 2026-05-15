import { createAdminUsersApi } from './adminUsers'
import { createAssetsApi } from './assets'
import { createAuthApi } from './auth'
import { createGenerationTasksApi } from './generationTasks'
import { createProjectsApi } from './projects'
import { useAdminSession } from '../composables/useAdminSession'

const api = useAdminSession()

export const adminUsersApi = createAdminUsersApi(api)
export const adminAssetsApi = createAssetsApi(api)
export const adminAuthApi = createAuthApi(api)
export const adminGenerationTasksApi = createGenerationTasksApi(api)
export const adminProjectsApi = createProjectsApi(api)
