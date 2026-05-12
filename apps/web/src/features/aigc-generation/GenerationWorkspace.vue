<script setup lang="ts">
import type { GenerationTask } from '../../types'

defineProps<{
  prompt: string
  ratio: string
  isSubmitting: boolean
  activeTaskId: string
  activeTask: GenerationTask | null
  tasks: GenerationTask[]
  isRefreshing: boolean
  isCanceling: boolean
  errorMessage: string
}>()

defineEmits<{
  'update:prompt': [value: string]
  'update:ratio': [value: string]
  createTask: []
  refreshActiveTask: []
  cancelActiveTask: []
  selectTask: [task: GenerationTask]
}>()
</script>

<template>
  <section class="panel">
    <label for="prompt">Prompt</label>
    <textarea
      id="prompt"
      :value="prompt"
      rows="5"
      @input="$emit('update:prompt', ($event.target as HTMLTextAreaElement).value)"
    />

    <div class="controls">
      <label>
        Ratio
        <select
          :value="ratio"
          @change="$emit('update:ratio', ($event.target as HTMLSelectElement).value)"
        >
          <option value="1:1">1:1</option>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
        </select>
      </label>

      <button type="button" :disabled="isSubmitting" @click="$emit('createTask')">
        {{ isSubmitting ? 'Submitting...' : 'Submit Task' }}
      </button>
    </div>
  </section>

  <section class="panel result">
    <div class="result-header">
      <h2>Current Task</h2>
      <button type="button" :disabled="!activeTaskId || isRefreshing" @click="$emit('refreshActiveTask')">
        {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
      </button>
      <button type="button" :disabled="!activeTaskId || isCanceling" @click="$emit('cancelActiveTask')">
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
        @click="$emit('selectTask', task)"
      >
        <span>{{ task.requestPayload.prompt }}</span>
        <strong>{{ task.status }} / {{ task.projectId ?? 'none' }}</strong>
      </button>
    </div>
  </section>
</template>
