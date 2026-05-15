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
    <h2>项目空间</h2>
    <label>
      当前项目
      <select
        :value="selectedProjectId"
        @change="$emit('update:selectedProjectId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">不绑定项目</option>
        <option v-for="project in projects" :key="project.projectId" :value="project.projectId">
          {{ project.name }}
        </option>
      </select>
    </label>
    <label>
      新项目名称
      <input
        :value="projectName"
        type="text"
        @input="$emit('update:projectName', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      项目描述
      <input
        :value="projectDescription"
        type="text"
        @input="$emit('update:projectDescription', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button type="button" :disabled="isCreatingProject" @click="$emit('createProject')">
      {{ isCreatingProject ? '创建中...' : '创建项目' }}
    </button>
  </section>
</template>
