<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TaskDashboard from './features/aigc-generation/TaskDashboard.vue'
import AccountCard from './platform/AccountCard.vue'
import AuthCard from './platform/AuthCard.vue'
import ProjectManagement from './platform/ProjectManagement.vue'
import UserManagement from './platform/UserManagement.vue'
import { useApiClient } from './composables/useApiClient'
import type {
  ActiveView,
  AdminUser,
  Asset,
  Task,
  Project,
  TaskStatus,
  UserRole,
  UserStatus,
} from './types'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'

const authStorageKey = 'aigc.admin.auth'
const api = useApiClient(apiBaseUrl, authStorageKey)
const route = useRoute()
const router = useRouter()
const phoneNumber = ref('13900139000')
const password = ref('password123')
const displayName = ref('Admin User')
const tasks = ref<Task[]>([])
const selectedTask = ref<Task | null>(null)
const users = ref<AdminUser[]>([])
const projects = ref<Project[]>([])
const isLoading = ref(false)
const isLoadingUsers = ref(false)
const isLoadingProjects = ref(false)
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
  () =>
    tasks.value.filter(
      (task) => task.status === 'failed' || task.status === 'final_failed',
    ).length,
)
const succeededTasks = computed(
  () => tasks.value.filter((task) => task.status === 'succeeded').length,
)
const isAuthenticated = api.isAuthenticated
const currentUser = api.currentUser
const isSuperAdmin = computed(() => currentUser.value?.role === 'super_admin')
const activeView = computed<ActiveView>(() => {
  if (route.path === '/users') {
    return 'users'
  }

  if (route.path === '/projects') {
    return 'projects'
  }

  if (route.path === '/account') {
    return 'account'
  }

  return 'tasks'
})
const pageTitle = computed(() => {
  if (activeView.value === 'users') {
    return 'Users'
  }

  if (activeView.value === 'projects') {
    return 'Projects'
  }

  if (activeView.value === 'account') {
    return 'Account'
  }

  return 'Generation Tasks'
})
const pageDescription = computed(() => {
  if (!currentUser.value) {
    return 'Inspect task state, attempts, and failure signals.'
  }

  return `Signed in as ${currentUser.value.phoneNumber}`
})

function resetMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function authenticate(mode: 'login' | 'register') {
  resetMessages()

  try {
    await api.authenticate(mode, {
      phoneNumber: phoneNumber.value,
      password: password.value,
      displayName: displayName.value,
    })
    await loadCurrentView()
  } catch (error) {
    errorMessage.value = toErrorMessage(error, `${mode} failed`)
  }
}

async function loadProfile() {
  const profile = await api.loadProfile()

  if (!profile) {
    return
  }

  if (!['admin', 'super_admin'].includes(profile.role)) {
    await signOut(false)
    errorMessage.value = 'No admin access'
  }
}

async function signOut(callServer = true) {
  await api.signOut(callServer)
  tasks.value = []
  selectedTask.value = null
  users.value = []
  projects.value = []
  await router.push('/tasks')
}

async function loadCurrentView() {
  if (activeView.value === 'users') {
    await loadUsers()
    return
  }

  if (activeView.value === 'projects') {
    await loadProjects()
    return
  }

  if (activeView.value === 'account') {
    return
  }

  await loadTasks()
}

async function setActiveView(view: ActiveView) {
  await router.push(`/${view}`)
  resetMessages()
}

async function loadTasks() {
  if (!api.accessToken.value) {
    return
  }

  isLoading.value = true
  resetMessages()

  try {
    const result = await api.requestJson<{ items: Task[] }>(
      '/generation/tasks/admin',
      {},
      'Load tasks',
    )
    tasks.value = result.items

    if (!selectedTask.value && result.items[0]) {
      await selectTask(result.items[0])
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Load tasks failed')
  } finally {
    isLoading.value = false
  }
}

async function loadUsers() {
  if (!api.accessToken.value) {
    return
  }

  isLoadingUsers.value = true
  resetMessages()

  try {
    const result = await api.requestJson<{ items: AdminUser[] }>(
      '/admin/users',
      {},
      'Load users',
    )
    users.value = result.items
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Load users failed')
  } finally {
    isLoadingUsers.value = false
  }
}

async function loadProjects() {
  if (!api.accessToken.value) {
    return
  }

  isLoadingProjects.value = true
  resetMessages()

  try {
    const result = await api.requestJson<{ items: Project[] }>(
      '/projects',
      {},
      'Load projects',
    )
    projects.value = result.items
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Load projects failed')
  } finally {
    isLoadingProjects.value = false
  }
}

async function updateUserStatus(user: AdminUser, status: UserStatus) {
  await updateUser(user.id, `/admin/users/${user.id}/status`, {
    status,
  })
}

async function updateUserRole(user: AdminUser, role: UserRole) {
  await updateUser(user.id, `/admin/users/${user.id}/role`, {
    role,
  })
}

async function updateUser(
  userId: string,
  path: string,
  body: Record<string, string>,
) {
  updatingUserIds.value = new Set(updatingUserIds.value).add(userId)
  resetMessages()

  try {
    const updatedUser = await api.requestJson<AdminUser>(
      path,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'Update user',
    )
    users.value = users.value.map((user) =>
      user.id === updatedUser.id ? updatedUser : user,
    )
    successMessage.value = 'User updated.'

    if (updatedUser.id === currentUser.value?.id) {
      currentUser.value = {
        ...currentUser.value,
        role: updatedUser.role,
        status: updatedUser.status,
      }
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Update user failed')
  } finally {
    const nextUpdatingIds = new Set(updatingUserIds.value)
    nextUpdatingIds.delete(userId)
    updatingUserIds.value = nextUpdatingIds
  }
}

async function selectTask(task: Task) {
  const response = await api.request(`/generation/tasks/${task.taskId}`)

  if (!response.ok) {
    selectedTask.value = task
    return
  }

  selectedTask.value = (await response.json()) as Task
}

async function retrySelectedTask() {
  if (!selectedTask.value) {
    return
  }

  isRetrying.value = true
  resetMessages()

  try {
    const retried = await api.requestJson<{ taskId: string }>(
      `/generation/tasks/${selectedTask.value.taskId}/retry`,
      {
        method: 'POST',
      },
      'Retry task',
    )
    await loadTasks()
    const task = tasks.value.find((item) => item.taskId === retried.taskId)

    if (task) {
      await selectTask(task)
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Retry task failed')
  } finally {
    isRetrying.value = false
  }
}

async function cancelSelectedTask() {
  if (!selectedTask.value) {
    return
  }

  isCanceling.value = true
  resetMessages()

  try {
    const canceled = await api.requestJson<{ taskId: string }>(
      `/generation/tasks/${selectedTask.value.taskId}/cancel`,
      {
        method: 'POST',
      },
      'Cancel task',
    )
    await loadTasks()
    const task = tasks.value.find((item) => item.taskId === canceled.taskId)

    if (task) {
      await selectTask(task)
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Cancel task failed')
  } finally {
    isCanceling.value = false
  }
}

async function changePassword() {
  isChangingPassword.value = true
  resetMessages()

  try {
    await api.requestJson(
      '/auth/change-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: currentPassword.value,
          newPassword: newPassword.value,
        }),
      },
      'Change password',
    )

    currentPassword.value = ''
    newPassword.value = ''
    successMessage.value = 'Password changed. Please sign in again.'
    await signOut(false)
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Change password failed')
  } finally {
    isChangingPassword.value = false
  }
}

async function downloadAsset(asset: Asset) {
  resetMessages()

  try {
    const result = await api.requestJson<{ url: string }>(
      `/assets/${asset.assetId}/download`,
      {
        method: 'POST',
      },
      'Create download',
    )
    window.open(result.url, '_blank', 'noopener')
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Create download failed')
  }
}

function canRetry(task: Task | null) {
  return Boolean(
    task &&
    task.status !== 'succeeded' &&
    task.status !== 'running' &&
    task.status !== 'retrying',
  )
}

function canCancel(task: Task | null) {
  return Boolean(
    task &&
    task.status !== 'succeeded' &&
    task.status !== 'canceled' &&
    task.status !== 'final_failed' &&
    task.status !== 'rejected',
  )
}

function statusType(status: TaskStatus) {
  if (status === 'succeeded') {
    return 'success' as const
  }

  if (
    status === 'failed' ||
    status === 'final_failed' ||
    status === 'rejected'
  ) {
    return 'danger' as const
  }

  if (status === 'queued' || status === 'running' || status === 'retrying') {
    return 'warning' as const
  }

  return 'info' as const
}

function refreshLoading() {
  if (activeView.value === 'users') {
    return isLoadingUsers.value
  }

  if (activeView.value === 'projects') {
    return isLoadingProjects.value
  }

  return isLoading.value
}

onMounted(async () => {
  await loadProfile()
  await loadCurrentView()
})

watch(
  () => route.path,
  async () => {
    resetMessages()

    if (isAuthenticated.value) {
      await loadCurrentView()
    }
  },
)
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
          <el-menu-item index="projects">Projects</el-menu-item>
          <el-menu-item index="users">Users</el-menu-item>
          <el-menu-item index="account">Account</el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header class="header">
          <div>
            <h1>{{ pageTitle }}</h1>
            <p>{{ pageDescription }}</p>
          </div>
          <div class="header-actions">
            <span v-if="currentUser" class="user-pill">{{
              currentUser.role
            }}</span>
            <el-button v-if="isAuthenticated" @click="signOut()"
              >Sign Out</el-button
            >
            <el-button
              type="primary"
              :disabled="!isAuthenticated"
              v-if="activeView !== 'account'"
              :loading="refreshLoading()"
              @click="loadCurrentView"
            >
              Refresh
            </el-button>
          </div>
        </el-header>

        <el-main class="main">
          <el-alert
            v-if="errorMessage"
            :title="errorMessage"
            type="error"
            show-icon
            class="alert"
          />
          <el-alert
            v-if="successMessage"
            :title="successMessage"
            type="success"
            show-icon
            class="alert"
          />

          <AuthCard
            v-if="!isAuthenticated"
            v-model:phone-number="phoneNumber"
            v-model:password="password"
            v-model:display-name="displayName"
            @login="authenticate('login')"
            @register="authenticate('register')"
          />

          <template v-else>
            <AccountCard
              v-if="activeView === 'account'"
              v-model:current-password="currentPassword"
              v-model:new-password="newPassword"
              :is-changing-password="isChangingPassword"
              @change-password="changePassword"
            />

            <TaskDashboard
              v-if="activeView === 'tasks'"
              :tasks="tasks"
              :selected-task="selectedTask"
              :total-tasks="totalTasks"
              :succeeded-tasks="succeededTasks"
              :failed-tasks="failedTasks"
              :is-loading="isLoading"
              :is-retrying="isRetrying"
              :is-canceling="isCanceling"
              :can-retry="canRetry"
              :can-cancel="canCancel"
              :status-type="statusType"
              @select-task="selectTask"
              @retry-selected-task="retrySelectedTask"
              @cancel-selected-task="cancelSelectedTask"
              @download-asset="downloadAsset"
            />

            <UserManagement
              v-else-if="activeView === 'users'"
              :users="users"
              :current-user-id="currentUser?.id"
              :is-loading-users="isLoadingUsers"
              :is-super-admin="isSuperAdmin"
              :updating-user-ids="updatingUserIds"
              @update-user-role="updateUserRole"
              @update-user-status="updateUserStatus"
            />

            <ProjectManagement
              v-else-if="activeView === 'projects'"
              :projects="projects"
              :is-loading-projects="isLoadingProjects"
            />
          </template>
        </el-main>
      </el-container>
    </el-container>
  </el-config-provider>
</template>

<style>
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
  align-items: center;
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

.user-pill {
  padding: 5px 10px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  color: #374151;
  background: #f9fafb;
  font-size: 12px;
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
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
.detail-card,
.users-card,
.projects-card {
  border-radius: 8px;
}

.card-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(150px, auto) minmax(
      150px,
      auto
    );
  gap: 8px;
  align-items: center;
}

.table-card .filters,
.projects-card .filters {
  grid-template-columns: minmax(220px, 1fr) minmax(150px, auto);
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

  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .card-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .filters,
  .table-card .filters,
  .projects-card .filters {
    grid-template-columns: 1fr;
  }
}
</style>
