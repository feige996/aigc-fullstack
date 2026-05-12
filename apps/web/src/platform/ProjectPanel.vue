<script setup lang="ts">
import type { Project } from '../types'

defineProps<{
  projects: Project[]
  selectedProjectId: string
  projectName: string
  projectDescription: string
  isCreatingProject: boolean
}>()

defineEmits<{
  'update:selectedProjectId': [value: string]
  'update:projectName': [value: string]
  'update:projectDescription': [value: string]
  createProject: []
}>()
</script>

<template>
  <section class="panel project-panel">
    <h2>Project</h2>
    <label>
      Active Project
      <select
        :value="selectedProjectId"
        @change="$emit('update:selectedProjectId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">No Project</option>
        <option v-for="project in projects" :key="project.projectId" :value="project.projectId">
          {{ project.name }}
        </option>
      </select>
    </label>
    <label>
      New Project
      <input
        :value="projectName"
        type="text"
        @input="$emit('update:projectName', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      Description
      <input
        :value="projectDescription"
        type="text"
        @input="$emit('update:projectDescription', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button type="button" :disabled="isCreatingProject" @click="$emit('createProject')">
      {{ isCreatingProject ? 'Creating...' : 'Create Project' }}
    </button>
  </section>
</template>
