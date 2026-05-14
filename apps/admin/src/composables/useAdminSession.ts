import { useApiClient } from './useApiClient'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
export const authStorageKey = 'aigc.admin.auth'

const api = useApiClient(apiBaseUrl, authStorageKey)

export function useAdminSession() {
  return api
}
