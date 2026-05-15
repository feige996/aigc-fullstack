<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { adminProjectsApi } from '../api'
import { useAdminPageActions } from '../composables/useAdminPageActions'
import ProjectManagement from '../platform/ProjectManagement.vue'
import type { Project } from '../types'

const pageActions = useAdminPageActions()
const projects = ref<Project[]>([])
const totalProjects = ref(0)
const page = ref(1)
const pageSize = ref(20)
const searchQuery = ref('')
const statusFilter = ref<string>('all')
const isLoadingProjects = ref(false)

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function loadProjects() {
  isLoadingProjects.value = true

  try {
    const result = await adminProjectsApi.list({
        page: page.value,
        pageSize: pageSize.value,
        search: searchQuery.value.trim(),
        status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      })
    projects.value = result.items
    totalProjects.value = result.total
  } catch (error) {
    ElMessage.error(toErrorMessage(error, 'Load projects failed'))
  } finally {
    isLoadingProjects.value = false
  }
}

function updatePage(nextPage: number) {
  page.value = nextPage
  loadProjects()
}

function updatePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize
  page.value = 1
  loadProjects()
}

let searchTimer: number | undefined

watch([searchQuery, statusFilter], () => {
  page.value = 1
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    loadProjects()
  }, 250)
})

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
    :total-projects="totalProjects"
    :page="page"
    :page-size="pageSize"
    v-model:search-query="searchQuery"
    v-model:status-filter="statusFilter"
    :is-loading-projects="isLoadingProjects"
    @update-page="updatePage"
    @update-page-size="updatePageSize"
  />
</template>
