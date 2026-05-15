import type { ApiClient } from './types'
import type { AdminUser, ListResponse, UserRole, UserStatus } from '../types'

export interface ListAdminUsersParams {
  page: number
  pageSize: number
  search?: string
  role?: UserRole
  status?: UserStatus
}

export function createAdminUsersApi(api: ApiClient) {
  return {
    list(params: ListAdminUsersParams) {
      return api.requestJson<ListResponse<AdminUser>>(
        `/admin/users${api.buildQuery(params)}`,
        {},
        'Load users',
      )
    },

    updateRole(userId: string, role: UserRole) {
      return api.requestJson<AdminUser>(
        `/admin/users/${userId}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role }),
        },
        'Update user',
      )
    },

    updateStatus(userId: string, status: UserStatus) {
      return api.requestJson<AdminUser>(
        `/admin/users/${userId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        },
        'Update user',
      )
    },
  }
}
