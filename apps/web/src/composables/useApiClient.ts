import { computed, ref } from 'vue'
import type { AuthResponse, StoredAuth } from '../types'

export function useApiClient(apiBaseUrl: string, authStorageKey: string) {
  const storedAuth = readStoredAuth(authStorageKey)
  const accessToken = ref(storedAuth.accessToken)
  const refreshToken = ref(storedAuth.refreshToken)
  const currentUser = ref<AuthResponse['user'] | null>(null)

  const isAuthenticated = computed(() => Boolean(accessToken.value))

  function readStoredAuth(storageKey: string): StoredAuth {
    const rawValue = localStorage.getItem(storageKey)

    if (!rawValue) {
      return {
        accessToken: '',
        refreshToken: '',
      }
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<StoredAuth>

      return {
        accessToken: parsed.accessToken ?? '',
        refreshToken: parsed.refreshToken ?? '',
      }
    } catch {
      return {
        accessToken: rawValue,
        refreshToken: '',
      }
    }
  }

  function persistAuth(result: AuthResponse) {
    accessToken.value = result.accessToken
    refreshToken.value = result.refreshToken
    currentUser.value = result.user
    localStorage.setItem(
      authStorageKey,
      JSON.stringify({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }),
    )
  }

  function clearAuth() {
    accessToken.value = ''
    refreshToken.value = ''
    currentUser.value = null
    localStorage.removeItem(authStorageKey)
  }

  function authHeaders(): Record<string, string> {
    return accessToken.value
      ? {
          Authorization: `Bearer ${accessToken.value}`,
        }
      : {}
  }

  async function refreshAuth() {
    if (!refreshToken.value) {
      return false
    }

    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: refreshToken.value,
      }),
    })

    if (!response.ok) {
      return false
    }

    const result = (await response.json()) as AuthResponse
    persistAuth(result)
    return true
  }

  async function request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...authHeaders(),
        ...(init.headers ?? {}),
      },
    })

    if (response.status !== 401 || !retry) {
      return response
    }

    const refreshed = await refreshAuth()

    if (!refreshed) {
      clearAuth()
      return response
    }

    return request(path, init, false)
  }

  async function readErrorMessage(response: Response, actionName: string) {
    const fallback = `${actionName} failed: ${response.status}`
    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      const body = (await response.json().catch(() => null)) as {
        message?: string | string[]
        error?: string
      } | null
      const message = Array.isArray(body?.message)
        ? body.message.join(', ')
        : body?.message

      return message || body?.error || fallback
    }

    const text = await response.text().catch(() => '')
    return text || fallback
  }

  async function requestJson<T>(
    path: string,
    init: RequestInit = {},
    actionName = 'Request',
  ): Promise<T> {
    const response = await request(path, init)

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, actionName))
    }

    return (await response.json()) as T
  }

  async function authenticate(
    mode: 'login' | 'register',
    body: {
      phoneNumber: string
      password: string
      displayName: string
    },
  ) {
    const result = await requestJson<AuthResponse>(
      `/auth/${mode}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      mode,
    )

    persistAuth(result)
    return result
  }

  async function loadProfile() {
    if (!accessToken.value) {
      return null
    }

    const response = await request('/auth/me')

    if (!response.ok) {
      clearAuth()
      return null
    }

    const result = (await response.json()) as AuthResponse['user']
    currentUser.value = result
    return result
  }

  async function signOut(callServer = true) {
    const tokenToRevoke = refreshToken.value

    if (callServer && tokenToRevoke) {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: tokenToRevoke,
        }),
      }).catch(() => undefined)
    }

    clearAuth()
  }

  return {
    accessToken,
    refreshToken,
    currentUser,
    isAuthenticated,
    authenticate,
    loadProfile,
    request,
    requestJson,
    signOut,
  }
}
