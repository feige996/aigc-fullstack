<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import GenerationWorkspace from './features/aigc-generation/GenerationWorkspace.vue'
import AccountPanel from './platform/AccountPanel.vue'
import AssetPanel from './platform/AssetPanel.vue'
import AuthPanel from './platform/AuthPanel.vue'
import ProjectPanel from './platform/ProjectPanel.vue'
import type {
  Asset,
  AuthResponse,
  CreateAssetUploadResponse,
  CreateTaskResponse,
  Task,
  Project,
  StoredAuth
} from './types'

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
const activeTask = ref<Task | null>(null)
const tasks = ref<Task[]>([])
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

async function downloadAsset(asset: Asset) {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await apiFetch(`/assets/${asset.assetId}/download`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error(`Create download failed: ${response.status}`)
    }

    const result = (await response.json()) as { url: string }
    window.open(result.url, '_blank', 'noopener')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Create download failed'
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

    activeTask.value = (await response.json()) as Task
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

  const result = (await response.json()) as { items: Task[] }
  tasks.value = result.items
}

function selectTask(task: Task) {
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

      <AuthPanel
        v-if="!isAuthenticated"
        v-model:phone-number="phoneNumber"
        v-model:password="password"
        v-model:display-name="displayName"
        :error-message="errorMessage"
        :success-message="successMessage"
        @login="authenticate('login')"
        @register="authenticate('register')"
      />

      <template v-else>
        <div class="event-status">
          User: <strong>{{ currentUser?.phoneNumber }}</strong> / SSE:
          <strong>{{ eventSourceStatus }}</strong>
        </div>

        <AccountPanel
          v-model:current-password="currentPassword"
          v-model:new-password="newPassword"
          :is-changing-password="isChangingPassword"
          :success-message="successMessage"
          @change-password="changePassword"
        />

        <ProjectPanel
          v-model:selected-project-id="selectedProjectId"
          v-model:project-name="projectName"
          v-model:project-description="projectDescription"
          :projects="projects"
          :is-creating-project="isCreatingProject"
          @create-project="createProject"
        />

        <AssetPanel
          v-model:selected-asset-ids="selectedAssetIds"
          :assets="assets"
          :is-uploading-asset="isUploadingAsset"
          @upload-asset="uploadAsset"
        />

        <GenerationWorkspace
          v-model:prompt="prompt"
          v-model:ratio="ratio"
          :is-submitting="isSubmitting"
          :active-task-id="activeTaskId"
          :active-task="activeTask"
          :tasks="tasks"
          :is-refreshing="isRefreshing"
          :is-canceling="isCanceling"
          :error-message="errorMessage"
          @create-task="createTask"
          @refresh-active-task="refreshActiveTask"
          @cancel-active-task="cancelActiveTask"
          @select-task="selectTask"
          @download-asset="downloadAsset"
        />
      </template>
    </section>
  </main>
</template>

<style>
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

.output-assets {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.output-assets h3 {
  margin: 0;
  font-size: 16px;
}

.output-list {
  display: grid;
  gap: 8px;
}

.output-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 12px;
  border: 1px solid #dfe4ec;
  border-radius: 8px;
}

.output-row div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.output-row span {
  overflow: hidden;
  color: #687386;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.output-row small {
  color: #687386;
}

.output-actions {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 10px;
}

.output-actions button {
  min-height: 32px;
  padding: 0 10px;
  background: #fff;
  color: #17202a;
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

  .output-row {
    grid-template-columns: 1fr;
  }

  .output-actions {
    justify-content: start;
  }
}
</style>
