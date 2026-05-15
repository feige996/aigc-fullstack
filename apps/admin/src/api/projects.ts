import type { ApiClient } from './types'
import type { ListResponse, Project } from '../types'

export interface ListProjectsParams {
  page: number
  pageSize: number
  search?: string
  status?: string
}

export function createProjectsApi(api: ApiClient) {
  return {
    list(params: ListProjectsParams) {
      return api.requestJson<ListResponse<Project>>(
        `/projects${api.buildQuery(params)}`,
        {},
        'Load projects',
      )
    },
  }
}
