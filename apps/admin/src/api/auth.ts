import type { ApiClient } from './types'

export function createAuthApi(api: ApiClient) {
  return {
    changePassword(currentPassword: string, newPassword: string) {
      return api.requestJson(
        '/auth/change-password',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        },
        'Change password',
      )
    },
  }
}
