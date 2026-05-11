<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type TaskStatus =
  | 'draft'
  | 'validating'
  | 'rejected'
  | 'pending'
  | 'queued'
  | 'running'
  | 'retrying'
  | 'succeeded'
  | 'failed'
  | 'final_failed'
  | 'canceled'
  | 'expired'

type UserRole = 'user' | 'admin' | 'super_admin'
type UserStatus = 'active' | 'disabled'
type ActiveView = 'tasks' | 'users'

interface GenerationAttempt {
  id: string
  attemptNo: number
  status: string
  stage: string
  failureCode: string | null
  idempotencyKey: string
  createdAt: string
  updatedAt: string
  endedAt: string | null
}

interface GenerationTask {
  taskId: string
  userId: string
  type: string
  model: string
  status: TaskStatus
  stage: string
  failureCode: string | null
  billingStatus: string
  currentAttemptId: string | null
  requestPayload: {
    prompt?: string
    ratio?: string
  }
  currentAttempt?: GenerationAttempt
  attempts?: GenerationAttempt[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: {
    id: string
    phoneNumber: string
    role: string
    status: string
  }
}

interface StoredAuth {
  accessToken: string
  refreshToken: string
}

interface AdminUser {
  id: string
  phoneNumber: string
  displayName: string | null
  role: UserRole
  status: UserStatus
  createdAt: string
  updatedAt: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'

const authStorageKey = 'aigc.admin.auth'
const phoneNumber = ref('13900139000')
const password = ref('password123')
const displayName = ref('Admin User')
const storedAuth = readStoredAuth()
const accessToken = ref(storedAuth.accessToken)
const refreshToken = ref(storedAuth.refreshToken)
const currentUser = ref<AuthResponse['user'] | null>(null)
const activeView = ref<ActiveView>('tasks')
const tasks = ref<GenerationTask[]>([])
const selectedTask = ref<GenerationTask | null>(null)
const users = ref<AdminUser[]>([])
const isLoading = ref(false)
const isLoadingUsers = ref(false)
const isRetrying = ref(false)
const isCanceling = ref(false)
const isChangingPassword = ref(false)
const updatingUserIds = ref(new Set<string>())
const errorMessage = ref('')
const successMessage = ref('')
const currentPassword = ref('')
const newPassword = ref('')

const totalTasks = computed(() => tasks.value.length)
const failedTasks = computed(
  () => tasks.value.filter((task) => task.status === 'failed' || task.status === 'final_failed').length
)
const succeededTasks = computed(() => tasks.value.filter((task) => task.status === 'succeeded').length)
const isAuthenticated = computed(() => Boolean(accessToken.value))
const isSuperAdmin = computed(() => currentUser.value?.role === 'super_admin')
const pageTitle = computed(() => (activeView.value === 'users' ? 'Users' : 'Generation Tasks'))
const pageDescription = computed(() => {
  if (!currentUser.value) {
    return 'Inspect task state, attempts, and failure signals.'
  }

  return `Signed in as ${currentUser.value.phoneNumber}`
})

function readStoredAuth(): StoredAuth {
  const rawValue = localStorage.getItem(authStorageKey)

  if (!rawValue) {
    return {
      accessToken: '',
      refreshToken: ''
    }
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredAuth>

    return {
      accessToken: parsed.accessToken ?? '',
      refreshToken: parsed.refreshToken ?? ''
    }
  } catch {
    return {
      accessToken: rawValue,
      refreshToken: ''
    }
  }
}

function storeAuth(result: AuthResponse) {
  accessToken.value = result.accessToken
  refreshToken.value = result.refreshToken
  currentUser.value = result.user
  localStorage.setItem(
    authStorageKey,
    JSON.stringify({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })
  )
}

function authHeaders(): Record<string, string> {
  return accessToken.value
    ? {
        Authorization: `Bearer ${accessToken.value}`
      }
    : {}
}

async function authenticate(mode: 'login' | 'register') {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/auth/${mode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber.value,
        password: password.value,
        displayName: displayName.value
      })
    })

    if (!response.ok) {
      throw new Error(`${mode} failed: ${response.status}`)
    }

    const result = (await response.json()) as AuthResponse

    if (!['admin', 'super_admin'].includes(result.user.role)) {
      throw new Error('No admin access')
    }

    storeAuth(result)
    await loadCurrentView()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : `${mode} failed`
  }
}

async function refreshAuth() {
  if (!refreshToken.value) {
    return false
  }

  const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: refreshToken.value
    })
  })

  if (!response.ok) {
    return false
  }

  const result = (await response.json()) as AuthResponse

  if (!['admin', 'super_admin'].includes(result.user.role)) {
    return false
  }

  storeAuth(result)
  return true
}

async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers ?? {})
    }
  })

  if (response.status !== 401 || !retry) {
    return response
  }

  const refreshed = await refreshAuth()

  if (!refreshed) {
    await signOut(false)
    return response
  }

  return apiFetch(path, init, false)
}

async function loadProfile() {
  if (!accessToken.value) {
    return
  }

  const response = await apiFetch('/auth/me')

  if (!response.ok) {
    await signOut(false)
    return
  }

  currentUser.value = (await response.json()) as AuthResponse['user']

  if (!['admin', 'super_admin'].includes(currentUser.value.role)) {
    await signOut(false)
    errorMessage.value = 'No admin access'
  }
}

async function signOut(callServer = true) {
  const tokenToRevoke = refreshToken.value

  if (callServer && tokenToRevoke) {
    await fetch(`${apiBaseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refreshToken: tokenToRevoke
      })
    }).catch(() => undefined)
  }

  accessToken.value = ''
  refreshToken.value = ''
  currentUser.value = null
  activeView.value = 'tasks'
  tasks.value = []
  selectedTask.value = null
  users.value = []
  localStorage.removeItem(authStorageKey)
}

async function loadCurrentView() {
  if (activeView.value === 'users') {
    await loadUsers()
    return
  }

  await loadTasks()
}

async function setActiveView(view: ActiveView) {
  activeView.value = view
  errorMessage.value = ''
  successMessage.value = ''

  if (!isAuthenticated.value) {
    return
  }

  await loadCurrentView()
}

async function loadTasks() {
  if (!accessToken.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await apiFetch('/generation/tasks/admin')

    if (!response.ok) {
      throw new Error(`Load tasks failed: ${response.status}`)
    }

    const result = (await response.json()) as { items: GenerationTask[] }
    tasks.value = result.items

    if (!selectedTask.value && result.items[0]) {
      await selectTask(result.items[0])
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Load tasks failed'
  } finally {
    isLoading.value = false
  }
}

async function loadUsers() {
  if (!accessToken.value) {
    return
  }

  isLoadingUsers.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await apiFetch('/admin/users')

    if (!response.ok) {
      throw new Error(`Load users failed: ${response.status}`)
    }

    const result = (await response.json()) as { items: AdminUser[] }
    users.value = result.items
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Load users failed'
  } finally {
    isLoadingUsers.value = false
  }
}

async function updateUserStatus(user: AdminUser, status: UserStatus) {
  await updateUser(user.id, `/admin/users/${user.id}/status`, {
    status
  })
}

async function updateUserRole(user: AdminUser, role: UserRole) {
  await updateUser(user.id, `/admin/users/${user.id}/role`, {
    role
  })
}

async function updateUser(userId: string, path: string, body: Record<string, string>) {
  updatingUserIds.value = new Set(updatingUserIds.value).add(userId)
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await apiFetch(path, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Update user failed: ${response.status}`)
    }

    const updatedUser = (await response.json()) as AdminUser
    users.value = users.value.map((user) => (user.id === updatedUser.id ? updatedUser : user))
    successMessage.value = 'User updated.'

    if (updatedUser.id === currentUser.value?.id) {
      currentUser.value = {
        ...currentUser.value,
        role: updatedUser.role,
        status: updatedUser.status
      }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Update user failed'
  } finally {
    const nextUpdatingIds = new Set(updatingUserIds.value)
    nextUpdatingIds.delete(userId)
    updatingUserIds.value = nextUpdatingIds
  }
}

async function selectTask(task: GenerationTask) {
  const response = await apiFetch(`/generation/tasks/${task.taskId}`)

  if (!response.ok) {
    selectedTask.value = task
    return
  }

  selectedTask.value = (await response.json()) as GenerationTask
}

async function retrySelectedTask() {
  if (!selectedTask.value) {
    return
  }

  isRetrying.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await apiFetch(`/generation/tasks/${selectedTask.value.taskId}/retry`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error(`Retry task failed: ${response.status}`)
    }

    const retried = (await response.json()) as { taskId: string }
    await loadTasks()
    const task = tasks.value.find((item) => item.taskId === retried.taskId)

    if (task) {
      await selectTask(task)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Retry task failed'
  } finally {
    isRetrying.value = false
  }
}

async function cancelSelectedTask() {
  if (!selectedTask.value) {
    return
  }

  isCanceling.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await apiFetch(`/generation/tasks/${selectedTask.value.taskId}/cancel`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error(`Cancel task failed: ${response.status}`)
    }

    const canceled = (await response.json()) as { taskId: string }
    await loadTasks()
    const task = tasks.value.find((item) => item.taskId === canceled.taskId)

    if (task) {
      await selectTask(task)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Cancel task failed'
  } finally {
    isCanceling.value = false
  }
}

async function changePassword() {
  isChangingPassword.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await apiFetch('/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      })
    })

    if (!response.ok) {
      throw new Error(`Change password failed: ${response.status}`)
    }

    currentPassword.value = ''
    newPassword.value = ''
    successMessage.value = 'Password changed. Please sign in again.'
    await signOut(false)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Change password failed'
  } finally {
    isChangingPassword.value = false
  }
}

function canRetry(task: GenerationTask | null) {
  return Boolean(task && task.status !== 'succeeded' && task.status !== 'running' && task.status !== 'retrying')
}

function canCancel(task: GenerationTask | null) {
  return Boolean(
    task &&
      task.status !== 'succeeded' &&
      task.status !== 'canceled' &&
      task.status !== 'final_failed' &&
      task.status !== 'rejected'
  )
}

function statusType(status: TaskStatus) {
  if (status === 'succeeded') {
    return 'success'
  }

  if (status === 'failed' || status === 'final_failed' || status === 'rejected') {
    return 'danger'
  }

  if (status === 'queued' || status === 'running' || status === 'retrying') {
    return 'warning'
  }

  return 'info'
}

onMounted(async () => {
  await loadProfile()
  await loadCurrentView()
})
</script>

<template>
  <el-config-provider>
    <el-container class="layout">
      <el-aside width="232px" class="aside">
        <div class="brand">AIGC Admin</div>
        <el-menu
          :default-active="activeView"
          background-color="#1f2937"
          text-color="#d1d5db"
          active-text-color="#fff"
          @select="(index: string) => setActiveView(index as ActiveView)"
        >
          <el-menu-item index="tasks">Tasks</el-menu-item>
          <el-menu-item index="users">Users</el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header class="header">
          <div>
            <h1>{{ pageTitle }}</h1>
            <p>{{ pageDescription }}</p>
          </div>
          <div class="header-actions">
            <el-button v-if="isAuthenticated" @click="signOut()">Sign Out</el-button>
            <el-button
              type="primary"
              :disabled="!isAuthenticated"
              :loading="activeView === 'users' ? isLoadingUsers : isLoading"
              @click="loadCurrentView"
            >
              Refresh
            </el-button>
          </div>
        </el-header>

        <el-main class="main">
          <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon class="alert" />
          <el-alert v-if="successMessage" :title="successMessage" type="success" show-icon class="alert" />

          <el-card v-if="!isAuthenticated" shadow="never" class="auth-card">
            <template #header>Sign In</template>
            <el-form label-position="top">
              <el-form-item label="Phone">
                <el-input v-model="phoneNumber" />
              </el-form-item>
              <el-form-item label="Password">
                <el-input v-model="password" type="password" show-password />
              </el-form-item>
              <el-form-item label="Display Name">
                <el-input v-model="displayName" />
              </el-form-item>
              <div class="auth-actions">
                <el-button type="primary" @click="authenticate('login')">Login</el-button>
                <el-button @click="authenticate('register')">Register</el-button>
              </div>
            </el-form>
          </el-card>

          <template v-else>
          <el-card shadow="never" class="account-card">
            <template #header>Account</template>
            <el-form label-position="top" class="account-form">
              <el-form-item label="Current Password">
                <el-input v-model="currentPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="New Password">
                <el-input v-model="newPassword" type="password" show-password />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="isChangingPassword" @click="changePassword">
                  Change Password
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>

          <template v-if="activeView === 'tasks'">
          <section class="metrics">
            <div>
              <span>Total</span>
              <strong>{{ totalTasks }}</strong>
            </div>
            <div>
              <span>Succeeded</span>
              <strong>{{ succeededTasks }}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{{ failedTasks }}</strong>
            </div>
          </section>

          <section class="content">
            <el-card shadow="never" class="table-card">
              <template #header>Recent Tasks</template>
              <el-table
                v-loading="isLoading"
                :data="tasks"
                height="520"
                highlight-current-row
                @row-click="selectTask"
              >
                <el-table-column prop="taskId" label="Task ID" min-width="220" show-overflow-tooltip />
                <el-table-column prop="model" label="Model" width="160" />
                <el-table-column label="Status" width="140">
                  <template #default="{ row }">
                    <el-tag :type="statusType(row.status)" effect="plain">{{ row.status }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="stage" label="Stage" width="160" />
                <el-table-column prop="failureCode" label="Failure" width="180" show-overflow-tooltip />
                <el-table-column prop="updatedAt" label="Updated" width="220" />
              </el-table>
            </el-card>

            <el-card shadow="never" class="detail-card">
              <template #header>
                <div class="detail-header">
                  <span>Task Detail</span>
                  <el-button
                    type="warning"
                    size="small"
                    :disabled="!canRetry(selectedTask)"
                    :loading="isRetrying"
                    @click="retrySelectedTask"
                  >
                    Retry
                  </el-button>
                  <el-button
                    type="danger"
                    size="small"
                    :disabled="!canCancel(selectedTask)"
                    :loading="isCanceling"
                    @click="cancelSelectedTask"
                  >
                    Cancel
                  </el-button>
                </div>
              </template>
              <el-empty v-if="!selectedTask" description="No task selected" />
              <template v-else>
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="Task ID">{{ selectedTask.taskId }}</el-descriptions-item>
                  <el-descriptions-item label="User">{{ selectedTask.userId }}</el-descriptions-item>
                  <el-descriptions-item label="Status">
                    <el-tag :type="statusType(selectedTask.status)" effect="plain">
                      {{ selectedTask.status }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="Stage">{{ selectedTask.stage }}</el-descriptions-item>
                  <el-descriptions-item label="Billing">{{ selectedTask.billingStatus }}</el-descriptions-item>
                  <el-descriptions-item label="Prompt">
                    {{ selectedTask.requestPayload.prompt }}
                  </el-descriptions-item>
                </el-descriptions>

                <h2>Attempts</h2>
                <el-table :data="selectedTask.attempts ?? []" size="small" border>
                  <el-table-column prop="attemptNo" label="#" width="56" />
                  <el-table-column prop="status" label="Status" width="120" />
                  <el-table-column prop="stage" label="Stage" width="150" />
                  <el-table-column prop="failureCode" label="Failure" min-width="160" />
                </el-table>
              </template>
            </el-card>
          </section>
          </template>

          <template v-else>
          <el-card shadow="never" class="users-card">
            <template #header>User Management</template>
            <el-table v-loading="isLoadingUsers" :data="users" height="560">
              <el-table-column prop="phoneNumber" label="Phone" width="150" />
              <el-table-column prop="displayName" label="Name" min-width="150" show-overflow-tooltip />
              <el-table-column label="Role" width="180">
                <template #default="{ row }">
                  <el-select
                    :model-value="row.role"
                    size="small"
                    :disabled="!isSuperAdmin || updatingUserIds.has(row.id)"
                    @change="(role: UserRole) => updateUserRole(row, role)"
                  >
                    <el-option label="User" value="user" />
                    <el-option label="Admin" value="admin" />
                    <el-option label="Super Admin" value="super_admin" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="Status" width="140">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'active' ? 'success' : 'danger'" effect="plain">
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="Created" width="220" />
              <el-table-column label="Actions" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="row.status === 'active'"
                    type="danger"
                    size="small"
                    :loading="updatingUserIds.has(row.id)"
                    :disabled="row.id === currentUser?.id"
                    @click="updateUserStatus(row, 'disabled')"
                  >
                    Disable
                  </el-button>
                  <el-button
                    v-else
                    type="success"
                    size="small"
                    :loading="updatingUserIds.has(row.id)"
                    @click="updateUserStatus(row, 'active')"
                  >
                    Enable
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
          </template>
          </template>
        </el-main>
      </el-container>
    </el-container>
  </el-config-provider>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  background: #f6f7f9;
}

.aside {
  color: #fff;
  background: #1f2937;
}

.brand {
  padding: 20px;
  font-weight: 700;
}

.header {
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header h1 {
  margin: 0 0 4px;
  font-size: 20px;
}

.header p {
  margin: 0;
  color: #6b7280;
}

.main {
  display: grid;
  gap: 16px;
}

.alert {
  margin-bottom: -4px;
}

.auth-card {
  max-width: 420px;
}

.auth-actions {
  display: flex;
  gap: 8px;
}

.account-card {
  border-radius: 8px;
}

.account-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 240px)) auto;
  align-items: end;
  gap: 12px;
}

.account-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metrics div {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.metrics span {
  display: block;
  color: #6b7280;
  font-size: 13px;
}

.metrics strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
}

.content {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(360px, 0.8fr);
  gap: 16px;
  align-items: start;
}

.table-card,
.detail-card {
  border-radius: 8px;
}

.detail-card h2 {
  margin: 20px 0 10px;
  font-size: 16px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

@media (max-width: 1100px) {
  .content {
    grid-template-columns: 1fr;
  }
}
</style>
