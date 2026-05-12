<script setup lang="ts">
import type { Project } from '../types'

defineProps<{
  projects: Project[]
  isLoadingProjects: boolean
}>()
</script>

<template>
  <el-card shadow="never" class="projects-card">
    <template #header>Project Management</template>
    <el-table v-loading="isLoadingProjects" :data="projects" height="560">
      <el-table-column prop="name" label="Name" min-width="180" show-overflow-tooltip />
      <el-table-column prop="description" label="Description" min-width="220" show-overflow-tooltip />
      <el-table-column label="Owner" width="160">
        <template #default="{ row }">
          {{ row.user?.phoneNumber ?? row.userId }}
        </template>
      </el-table-column>
      <el-table-column label="Status" width="120">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" effect="plain">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="taskCount" label="Tasks" width="90" />
      <el-table-column prop="createdAt" label="Created" width="220" />
    </el-table>
  </el-card>
</template>
