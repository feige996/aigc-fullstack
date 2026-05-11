<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

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

interface CreateTaskResponse {
  taskId: string
  attemptId?: string
  traceId?: string
  status: TaskStatus
  stage: string
  failureCode?: string
  billingStatus: string
}

interface GenerationTask {
  taskId: string
  type: string
  model: string
  status: TaskStatus
  stage: string
  failureCode: string | null
  billingStatus: string
  requestPayload: {
    prompt?: string
    ratio?: string
  }
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    phoneNumber: string
    role: string
    status: string
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'

const authStorageKey = 'aigc.web.auth'
const phoneNumber = ref('13800138000')
const password = ref('password123')
const displayName = ref('Demo User')
const accessToken = ref(localStorage.getItem(authStorageKey) ?? '')
const currentUser = ref<AuthResponse['user'] | null>(null)
const prompt = ref('a clean product photo of a ceramic cup')
const ratio = ref('1:1')
const activeTaskId = ref('')
const activeTask = ref<GenerationTask | null>(null)
const tasks = ref<GenerationTask[]>([])
const isSubmitting = ref(false)
const isRefreshing = ref(false)
const isCanceling = ref(false)
const errorMessage = ref('')
const eventSourceStatus = ref<'connecting' | 'open' | 'closed'>('closed')
let eventSource: EventSource | null = null

const activeTaskStatusLabel = computed(() => activeTask.value?.status ?? 'idle')
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
        phoneNumber: phoneNumber.value,
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
    connectEvents()
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
  eventSource?.close()
  eventSource = null
  eventSourceStatus.value = 'closed'
  accessToken.value = ''
  currentUser.value = null
  activeTaskId.value = ''
  activeTask.value = null
  tasks.value = []
  localStorage.removeItem(authStorageKey)
}

async function createTask() {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    const response = await fetch(`${apiBaseUrl}/generation/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        type: 'text_to_image',
        model: 'mock-image-v1',
        prompt: prompt.value,
        ratio: ratio.value
      })
    })

    if (!response.ok) {
      throw new Error(`Create task failed: ${response.status}`)
    }

    const result = (await response.json()) as CreateTaskResponse
    activeTaskId.value = result.taskId
    await refreshActiveTask()
    await loadTasks()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Create task failed'
  } finally {
    isSubmitting.value = false
  }
}

async function refreshActiveTask() {
  if (!activeTaskId.value) {
    return
  }

  errorMessage.value = ''
  isRefreshing.value = true

  try {
    const response = await fetch(`${apiBaseUrl}/generation/tasks/${activeTaskId.value}`, {
      headers: authHeaders()
    })

    if (!response.ok) {
      throw new Error(`Fetch task failed: ${response.status}`)
    }

    activeTask.value = (await response.json()) as GenerationTask
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Fetch task failed'
  } finally {
    isRefreshing.value = false
  }
}

async function cancelActiveTask() {
  if (!activeTaskId.value) {
    return
  }

  errorMessage.value = ''
  isCanceling.value = true

  try {
    const response = await fetch(`${apiBaseUrl}/generation/tasks/${activeTaskId.value}/cancel`, {
      method: 'POST',
      headers: authHeaders()
    })

    if (!response.ok) {
      throw new Error(`Cancel task failed: ${response.status}`)
    }

    await refreshActiveTask()
    await loadTasks()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Cancel task failed'
  } finally {
    isCanceling.value = false
  }
}

async function loadTasks() {
  if (!accessToken.value) {
    return
  }

  const response = await fetch(`${apiBaseUrl}/generation/tasks`, {
    headers: authHeaders()
  })

  if (!response.ok) {
    return
  }

  const result = (await response.json()) as { items: GenerationTask[] }
  tasks.value = result.items
}

function selectTask(task: GenerationTask) {
  activeTaskId.value = task.taskId
  activeTask.value = task
}

function connectEvents() {
  if (!accessToken.value) {
    return
  }

  eventSource?.close()
  eventSourceStatus.value = 'connecting'
  eventSource = new EventSource(
    `${apiBaseUrl}/generation/tasks/events?access_token=${encodeURIComponent(accessToken.value)}`
  )

  eventSource.onopen = () => {
    eventSourceStatus.value = 'open'
  }

  eventSource.onerror = () => {
    eventSourceStatus.value = 'closed'
  }

  for (const eventName of ['task.queued', 'task.succeeded', 'task.failed', 'task.canceled']) {
    eventSource.addEventListener(eventName, (event) => {
      const payload = JSON.parse(event.data) as { taskId: string }

      if (payload.taskId === activeTaskId.value) {
        void refreshActiveTask()
      }

      void loadTasks()
    })
  }
}

onMounted(async () => {
  await loadProfile()
  await loadTasks()
  connectEvents()
})

onBeforeUnmount(() => {
  eventSource?.close()
})
</script>

<template>
  <main class="page">
    <section class="workspace">
      <header class="header">
        <div>
          <p class="eyebrow">AIGC Web</p>
          <h1>Generation Workspace</h1>
        </div>
        <div class="header-actions">
          <div class="status" :data-status="activeTaskStatusLabel">
            {{ activeTaskStatusLabel }}
          </div>
          <button v-if="isAuthenticated" type="button" @click="signOut">Sign Out</button>
        </div>
      </header>

      <section v-if="!isAuthenticated" class="panel auth-panel">
        <label>
          Phone
          <input v-model="phoneNumber" type="tel" />
        </label>
        <label>
          Password
          <input v-model="password" type="password" />
        </label>
        <label>
          Display Name
          <input v-model="displayName" type="text" />
        </label>
        <div class="controls">
          <button type="button" @click="authenticate('login')">Login</button>
          <button type="button" @click="authenticate('register')">Register</button>
        </div>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </section>

      <template v-else>
      <div class="event-status">
        User: <strong>{{ currentUser?.phoneNumber }}</strong> / SSE:
        <strong>{{ eventSourceStatus }}</strong>
      </div>

      <section class="panel">
        <label for="prompt">Prompt</label>
        <textarea id="prompt" v-model="prompt" rows="5" />

        <div class="controls">
          <label>
            Ratio
            <select v-model="ratio">
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
            </select>
          </label>

          <button type="button" :disabled="isSubmitting" @click="createTask">
            {{ isSubmitting ? 'Submitting...' : 'Submit Task' }}
          </button>
        </div>
      </section>

      <section class="panel result">
        <div class="result-header">
          <h2>Current Task</h2>
          <button type="button" :disabled="!activeTaskId || isRefreshing" @click="refreshActiveTask">
            {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
          </button>
          <button type="button" :disabled="!activeTaskId || isCanceling" @click="cancelActiveTask">
            {{ isCanceling ? 'Canceling...' : 'Cancel' }}
          </button>
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <dl v-if="activeTask">
          <div>
            <dt>Task ID</dt>
            <dd>{{ activeTask.taskId }}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{{ activeTask.status }}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{{ activeTask.stage }}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{{ activeTask.model }}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{{ activeTask.updatedAt }}</dd>
          </div>
        </dl>
        <p v-else class="muted">No active task.</p>
      </section>

      <section class="panel">
        <h2>Recent Tasks</h2>
        <div class="task-list">
          <button
            v-for="task in tasks"
            :key="task.taskId"
            type="button"
            class="task-row"
            @click="selectTask(task)"
          >
            <span>{{ task.requestPayload.prompt }}</span>
            <strong>{{ task.status }}</strong>
          </button>
        </div>
      </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40px 20px;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #17202a;
  background: #f5f7fb;
}

.workspace {
  width: min(960px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #5b6472;
  font-size: 14px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 36px;
  line-height: 1.1;
}

h2 {
  font-size: 18px;
}

.status {
  min-width: 120px;
  padding: 8px 12px;
  border: 1px solid #d7dce4;
  border-radius: 8px;
  text-align: center;
  background: #fff;
  font-weight: 700;
}

.status[data-status="succeeded"] {
  color: #0f766e;
}

.status[data-status="failed"],
.status[data-status="final_failed"] {
  color: #b42318;
}

.panel {
  padding: 20px;
  border: 1px solid #dfe4ec;
  border-radius: 8px;
  background: #fff;
}

label {
  display: grid;
  gap: 8px;
  color: #3f4754;
  font-size: 14px;
  font-weight: 600;
}

textarea,
input,
select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cfd6e0;
  border-radius: 8px;
  padding: 10px 12px;
  font: inherit;
}

textarea {
  resize: vertical;
}

.controls,
.result-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.controls label {
  width: 160px;
}

.auth-panel {
  display: grid;
  gap: 12px;
}

button {
  min-height: 40px;
  border: 1px solid #17202a;
  border-radius: 8px;
  padding: 0 14px;
  background: #17202a;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.result button {
  background: #fff;
  color: #17202a;
}

dl {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
}

dl div {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
}

dt {
  color: #687386;
}

dd {
  margin: 0;
  word-break: break-all;
}

.error {
  margin-top: 12px;
  color: #b42318;
}

.muted {
  margin-top: 12px;
  color: #687386;
}

.task-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.task-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
  border-color: #dfe4ec;
  background: #fff;
  color: #17202a;
  text-align: left;
}

.task-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .header,
  .header-actions,
  .controls,
  .result-header {
    align-items: stretch;
    flex-direction: column;
  }

  .controls label,
  .status {
    width: 100%;
  }

  dl div {
    grid-template-columns: 1fr;
  }
}
</style>
