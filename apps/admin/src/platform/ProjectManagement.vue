<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Project } from '../types'

const props = defineProps<{
  projects: Project[]
  isLoadingProjects: boolean
}>()

const searchQuery = ref('')
const statusFilter = ref<string>('all')

const projectStatusOptions = computed(() =>
  Array.from(new Set(props.projects.map((project) => project.status))).sort(),
)
const filteredProjects = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return props.projects.filter((project) => {
    const owner = project.user?.phoneNumber ?? project.userId
    const matchesQuery =
      !query ||
      project.name.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query) ||
      owner.toLowerCase().includes(query) ||
      project.projectId.toLowerCase().includes(query)
    const matchesStatus =
      statusFilter.value === 'all' || project.status === statusFilter.value

    return matchesQuery && matchesStatus
  })
})
</script>

<template>
  <el-card shadow="never" class="projects-card">
    <template #header>
      <div class="card-toolbar">
        <span>Project Management</span>
        <div class="filters">
          <el-input
            v-model="searchQuery"
            clearable
            placeholder="Search project or owner"
          />
          <el-select v-model="statusFilter" placeholder="Status">
            <el-option label="All Statuses" value="all" />
            <el-option
              v-for="status in projectStatusOptions"
              :key="status"
              :label="status"
              :value="status"
            />
          </el-select>
        </div>
      </div>
    </template>
    <el-table
      v-loading="isLoadingProjects"
      :data="filteredProjects"
      height="560"
      empty-text="No matching projects"
    >
      <el-table-column
        prop="name"
        label="Name"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="description"
        label="Description"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="Owner" width="160">
        <template #default="{ row }">
          {{ row.user?.phoneNumber ?? row.userId }}
        </template>
      </el-table-column>
      <el-table-column label="Status" width="120">
        <template #default="{ row }">
          <el-tag
            :type="row.status === 'active' ? 'success' : 'info'"
            effect="plain"
          >
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="taskCount" label="Tasks" width="90" />
      <el-table-column prop="createdAt" label="Created" width="220" />
    </el-table>
  </el-card>
</template>
