<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, onUnmounted, ref } from 'vue'
import { useAdminPageActions } from '../composables/useAdminPageActions'
import { useAdminSession } from '../composables/useAdminSession'
import ProjectManagement from '../platform/ProjectManagement.vue'
import type { Project } from '../types'

const api = useAdminSession()
const pageActions = useAdminPageActions()
const projects = ref<Project[]>([])
const isLoadingProjects = ref(false)

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function loadProjects() {
  isLoadingProjects.value = true

  try {
    const result = await api.requestJson<{ items: Project[] }>(
      '/projects',
      {},
      'Load projects',
    )
    projects.value = result.items
  } catch (error) {
    ElMessage.error(toErrorMessage(error, 'Load projects failed'))
  } finally {
    isLoadingProjects.value = false
  }
}

onMounted(() => {
  pageActions.setRefreshAction(loadProjects, isLoadingProjects)
  loadProjects()
})

onUnmounted(() => {
  pageActions.clearRefreshAction(loadProjects)
})
</script>

<template>
  <ProjectManagement
    :projects="projects"
    :is-loading-projects="isLoadingProjects"
  />
</template>
