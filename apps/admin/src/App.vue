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
  user: {
    id: string
    phoneCountryCode: string
    phoneNumber: string
    email: string | null
    role: string
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'

const authStorageKey = 'aigc.admin.auth'
const phoneCountryCode = ref('+86')
const phoneNumber = ref('13900139000')
const email = ref('')
const password = ref('password123')
const displayName = ref('Admin User')
const accessToken = ref(localStorage.getItem(authStorageKey) ?? '')
const currentUser = ref<AuthResponse['user'] | null>(null)
const tasks = ref<GenerationTask[]>([])
const selectedTask = ref<GenerationTask | null>(null)
const isLoading = ref(false)
const isRetrying = ref(false)
const isCanceling = ref(false)
const errorMessage = ref('')

const totalTasks = computed(() => tasks.value.length)
const failedTasks = computed(
  () => tasks.value.filter((task) => task.status === 'failed' || task.status === 'final_failed').length
)
const succeededTasks = computed(() => tasks.value.filter((task) => task.status === 'succeeded').length)
const isAuthenticated = computed(() => Boolean(accessToken.value))

function authHeaders(): Record<string, string> {
  return accessToken.value
    ? {
        Authorization: `Bearer ${accessToken.value}`
      }
    : {}
}

async function authenticate(mode: 'login' | 'register') {
  errorMessage.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/auth/${mode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneCountryCode: phoneCountryCode.value,
        phoneNumber: phoneNumber.value,
        email: email.value,
        password: password.value,
        displayName: displayName.value
      })
    })

    if (!response.ok) {
      throw new Error(`${mode} failed: ${response.status}`)
    }

    const result = (await response.json()) as AuthResponse
    accessToken.value = result.accessToken
    currentUser.value = result.user
    localStorage.setItem(authStorageKey, result.accessToken)
    await loadTasks()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : `${mode} failed`
  }
}

async function loadProfile() {
  if (!accessToken.value) {
    return
  }

  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: authHeaders()
  })

  if (!response.ok) {
    signOut()
    return
  }

  currentUser.value = (await response.json()) as AuthResponse['user']
}

function signOut() {
  accessToken.value = ''
  currentUser.value = null
  tasks.value = []
  selectedTask.value = null
  localStorage.removeItem(authStorageKey)
}

async function loadTasks() {
  if (!accessToken.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/generation/tasks`, {
      headers: authHeaders()
    })

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

async function selectTask(task: GenerationTask) {
  const response = await fetch(`${apiBaseUrl}/generation/tasks/${task.taskId}`, {
    headers: authHeaders()
  })

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

  try {
    const response = await fetch(`${apiBaseUrl}/generation/tasks/${selectedTask.value.taskId}/retry`, {
      method: 'POST',
      headers: authHeaders()
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

  try {
    const response = await fetch(`${apiBaseUrl}/generation/tasks/${selectedTask.value.taskId}/cancel`, {
      method: 'POST',
      headers: authHeaders()
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
  await loadTasks()
})
</script>

<template>
  <el-config-provider>
    <el-container class="layout">
      <el-aside width="232px" class="aside">
        <div class="brand">AIGC Admin</div>
        <el-menu default-active="tasks" background-color="#1f2937" text-color="#d1d5db" active-text-color="#fff">
          <el-menu-item index="tasks">Tasks</el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header class="header">
          <div>
            <h1>Generation Tasks</h1>
            <p>
              <template v-if="currentUser">
                Signed in as {{ currentUser.phoneCountryCode }} {{ currentUser.phoneNumber }}
              </template>
              <template v-else>Inspect task state, attempts, and failure signals.</template>
            </p>
          </div>
          <div class="header-actions">
            <el-button v-if="isAuthenticated" @click="signOut">Sign Out</el-button>
            <el-button type="primary" :disabled="!isAuthenticated" :loading="isLoading" @click="loadTasks">
              Refresh
            </el-button>
          </div>
        </el-header>

        <el-main class="main">
          <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon class="alert" />

          <el-card v-if="!isAuthenticated" shadow="never" class="auth-card">
            <template #header>Sign In</template>
            <el-form label-position="top">
              <el-form-item label="Country Code">
                <el-input v-model="phoneCountryCode" />
              </el-form-item>
              <el-form-item label="Phone">
                <el-input v-model="phoneNumber" />
              </el-form-item>
              <el-form-item label="Email">
                <el-input v-model="email" />
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
