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
  projectId: string | null
  type: string
  model: string
  status: TaskStatus
  stage: string
  failureCode: string | null
  billingStatus: string
  requestPayload: {
    prompt?: string
    ratio?: string
    referenceAssetIds?: string[]
  }
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

interface Project {
  projectId: string
  userId: string
  name: string
  description: string | null
  status: string
  taskCount?: number
  createdAt: string
  updatedAt: string
}

interface Asset {
  assetId: string
  userId: string
  projectId: string | null
  taskId: string | null
  type: string
  status: string
  provider: string
  bucket: string
  objectKey: string
  mimeType: string
  size: number | null
  createdAt: string
  updatedAt: string
}

interface CreateAssetUploadResponse {
  asset: Asset
  upload: {
    method: 'PUT'
    url: string
    headers: Record<string, string>
    expiresInSeconds: number
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'

const authStorageKey = 'aigc.web.auth'
const phoneNumber = ref('13800138000')
const password = ref('password123')
const displayName = ref('Demo User')
const storedAuth = readStoredAuth()
const accessToken = ref(storedAuth.accessToken)
const refreshToken = ref(storedAuth.refreshToken)
const currentUser = ref<AuthResponse['user'] | null>(null)
const projects = ref<Project[]>([])
const selectedProjectId = ref('')
const projectName = ref('Default Project')
const projectDescription = ref('')
const assets = ref<Asset[]>([])
const selectedAssetIds = ref<string[]>([])
const prompt = ref('a clean product photo of a ceramic cup')
const ratio = ref('1:1')
const activeTaskId = ref('')
const activeTask = ref<GenerationTask | null>(null)
const tasks = ref<GenerationTask[]>([])
const isSubmitting = ref(false)
const isCreatingProject = ref(false)
const isUploadingAsset = ref(false)
const isRefreshing = ref(false)
const isCanceling = ref(false)
const isChangingPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const eventSourceStatus = ref<'connecting' | 'open' | 'closed'>('closed')
let eventSource: EventSource | null = null

const activeTaskStatusLabel = computed(() => activeTask.value?.status ?? 'idle')
const isAuthenticated = computed(() => Boolean(accessToken.value))

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
    storeAuth(result)
    await loadProjects()
    await loadAssets()
    await loadTasks()
    connectEvents()
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
  storeAuth(result)
  connectEvents()
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

  eventSource?.close()
  eventSource = null
  eventSourceStatus.value = 'closed'
  accessToken.value = ''
  refreshToken.value = ''
  currentUser.value = null
  activeTaskId.value = ''
  activeTask.value = null
  tasks.value = []
  projects.value = []
  selectedProjectId.value = ''
  assets.value = []
  selectedAssetIds.value = []
  localStorage.removeItem(authStorageKey)
}

async function loadProjects() {
  if (!accessToken.value) {
    return
  }

  const response = await apiFetch('/projects')

  if (!response.ok) {
    return
  }

  const result = (await response.json()) as { items: Project[] }
  projects.value = result.items

  if (!selectedProjectId.value && result.items[0]) {
    selectedProjectId.value = result.items[0].projectId
  }
}

async function createProject() {
  errorMessage.value = ''
  successMessage.value = ''
  isCreatingProject.value = true

  try {
    const response = await apiFetch('/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectName.value,
        description: projectDescription.value
      })
    })

    if (!response.ok) {
      throw new Error(`Create project failed: ${response.status}`)
    }

    const project = (await response.json()) as Project
    projects.value = [project, ...projects.value]
    selectedProjectId.value = project.projectId
    projectName.value = ''
    projectDescription.value = ''
    successMessage.value = 'Project created.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Create project failed'
  } finally {
    isCreatingProject.value = false
  }
}

async function loadAssets() {
  if (!accessToken.value) {
    return
  }

  const response = await apiFetch('/assets')

  if (!response.ok) {
    return
  }

  const result = (await response.json()) as { items: Asset[] }
  assets.value = result.items
}

async function uploadAsset(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  isUploadingAsset.value = true

  try {
    const createResponse = await apiFetch('/assets/uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'user_upload',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        projectId: selectedProjectId.value || undefined
      })
    })

    if (!createResponse.ok) {
      throw new Error(`Create upload failed: ${createResponse.status}`)
    }

    const uploadInfo = (await createResponse.json()) as CreateAssetUploadResponse
    const putResponse = await fetch(uploadInfo.upload.url, {
      method: uploadInfo.upload.method,
      headers: uploadInfo.upload.headers,
      body: file
    })

    if (!putResponse.ok) {
      throw new Error(`Upload failed: ${putResponse.status}`)
    }

    const confirmResponse = await apiFetch(`/assets/${uploadInfo.asset.assetId}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size: file.size
      })
    })

    if (!confirmResponse.ok) {
      throw new Error(`Confirm upload failed: ${confirmResponse.status}`)
    }

    const asset = (await confirmResponse.json()) as Asset
    assets.value = [asset, ...assets.value.filter((item) => item.assetId !== asset.assetId)]
    selectedAssetIds.value = Array.from(new Set([asset.assetId, ...selectedAssetIds.value]))
    successMessage.value = 'Asset uploaded.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Upload asset failed'
  } finally {
    input.value = ''
    isUploadingAsset.value = false
  }
}

async function createTask() {
  errorMessage.value = ''
  successMessage.value = ''
  isSubmitting.value = true

  try {
    const response = await apiFetch('/generation/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId: selectedProjectId.value || undefined,
        type: 'text_to_image',
        model: 'mock-image-v1',
        prompt: prompt.value,
        ratio: ratio.value,
        referenceAssetIds: selectedAssetIds.value
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
  successMessage.value = ''
  isRefreshing.value = true

  try {
    const response = await apiFetch(`/generation/tasks/${activeTaskId.value}`)

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
  successMessage.value = ''
  isCanceling.value = true

  try {
    const response = await apiFetch(`/generation/tasks/${activeTaskId.value}/cancel`, {
      method: 'POST'
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

async function changePassword() {
  errorMessage.value = ''
  successMessage.value = ''
  isChangingPassword.value = true

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

async function loadTasks() {
  if (!accessToken.value) {
    return
  }

  const response = await apiFetch('/generation/tasks')

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
  await loadProjects()
  await loadAssets()
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
          <button v-if="isAuthenticated" type="button" @click="signOut()">Sign Out</button>
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
        <p v-if="successMessage" class="success">{{ successMessage }}</p>
      </section>

      <template v-else>
      <div class="event-status">
        User: <strong>{{ currentUser?.phoneNumber }}</strong> / SSE:
        <strong>{{ eventSourceStatus }}</strong>
      </div>

      <section class="panel account-panel">
        <h2>Account</h2>
        <label>
          Current Password
          <input v-model="currentPassword" type="password" />
        </label>
        <label>
          New Password
          <input v-model="newPassword" type="password" />
        </label>
        <button type="button" :disabled="isChangingPassword" @click="changePassword">
          {{ isChangingPassword ? 'Changing...' : 'Change Password' }}
        </button>
        <p v-if="successMessage" class="success">{{ successMessage }}</p>
      </section>

      <section class="panel project-panel">
        <h2>Project</h2>
        <label>
          Active Project
          <select v-model="selectedProjectId">
            <option value="">No Project</option>
            <option v-for="project in projects" :key="project.projectId" :value="project.projectId">
              {{ project.name }}
            </option>
          </select>
        </label>
        <label>
          New Project
          <input v-model="projectName" type="text" />
        </label>
        <label>
          Description
          <input v-model="projectDescription" type="text" />
        </label>
        <button type="button" :disabled="isCreatingProject" @click="createProject">
          {{ isCreatingProject ? 'Creating...' : 'Create Project' }}
        </button>
      </section>

      <section class="panel asset-panel">
        <h2>Assets</h2>
        <label>
          Upload Asset
          <input type="file" :disabled="isUploadingAsset" @change="uploadAsset" />
        </label>
        <label>
          Reference Assets
          <select v-model="selectedAssetIds" multiple size="4">
            <option v-for="asset in assets" :key="asset.assetId" :value="asset.assetId">
              {{ asset.assetId }} / {{ asset.status }}
            </option>
          </select>
        </label>
        <div class="asset-summary">
          <strong>{{ selectedAssetIds.length }}</strong>
          <span>selected</span>
        </div>
      </section>

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
            <dt>Project ID</dt>
            <dd>{{ activeTask.projectId ?? 'none' }}</dd>
          </div>
          <div>
            <dt>Assets</dt>
            <dd>{{ activeTask.requestPayload.referenceAssetIds?.join(', ') || 'none' }}</dd>
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
            <strong>{{ task.status }} / {{ task.projectId ?? 'none' }}</strong>
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

.account-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 12px;
}

.project-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 12px;
}

.asset-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
  align-items: end;
  gap: 12px;
}

.asset-panel h2 {
  grid-column: 1 / -1;
}

.asset-summary {
  display: grid;
  gap: 4px;
  min-width: 96px;
  color: #3f4754;
}

.asset-summary strong {
  color: #17202a;
  font-size: 24px;
}

.project-panel h2 {
  grid-column: 1 / -1;
}

.account-panel h2,
.account-panel p {
  grid-column: 1 / -1;
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

.success {
  margin-top: 12px;
  color: #0f7b4f;
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
