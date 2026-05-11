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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'

const prompt = ref('a clean product photo of a ceramic cup')
const ratio = ref('1:1')
const activeTaskId = ref('')
const activeTask = ref<GenerationTask | null>(null)
const tasks = ref<GenerationTask[]>([])
const isSubmitting = ref(false)
const isRefreshing = ref(false)
const errorMessage = ref('')

const activeTaskStatusLabel = computed(() => activeTask.value?.status ?? 'idle')

async function createTask() {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    const response = await fetch(`${apiBaseUrl}/generation/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
    const response = await fetch(`${apiBaseUrl}/generation/tasks/${activeTaskId.value}`)

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

async function loadTasks() {
  const response = await fetch(`${apiBaseUrl}/generation/tasks`)

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

onMounted(() => {
  void loadTasks()
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
        <div class="status" :data-status="activeTaskStatusLabel">
          {{ activeTaskStatusLabel }}
        </div>
      </header>

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
