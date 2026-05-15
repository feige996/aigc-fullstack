<script setup lang="ts">
import type { Project } from '../types'

defineProps<{
  projects: Project[]
  searchQuery: string
  statusFilter: string
  totalProjects: number
  page: number
  pageSize: number
  isLoadingProjects: boolean
}>()

defineEmits<{
  'update:searchQuery': [value: string]
  'update:statusFilter': [value: string]
  updatePage: [page: number]
  updatePageSize: [pageSize: number]
}>()
</script>

<template>
  <el-card shadow="never" class="projects-card">
    <template #header>
      <div class="card-toolbar">
        <span>项目管理</span>
        <div class="filters">
          <el-input
            :model-value="searchQuery"
            clearable
            placeholder="搜索项目或所有者"
            @update:model-value="$emit('update:searchQuery', String($event))"
          />
          <el-select
            :model-value="statusFilter"
            placeholder="状态"
            @update:model-value="$emit('update:statusFilter', String($event))"
          >
            <el-option label="全部状态" value="all" />
            <el-option label="启用" value="active" />
            <el-option label="归档" value="archived" />
          </el-select>
        </div>
      </div>
    </template>
    <el-table
      v-loading="isLoadingProjects"
      :data="projects"
      height="560"
      empty-text="没有匹配的项目"
    >
      <el-table-column
        prop="name"
        label="名称"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="description"
        label="描述"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="所有者" width="160">
        <template #default="{ row }">
          {{ row.user?.phoneNumber ?? row.userId }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag
            :type="row.status === 'active' ? 'success' : 'info'"
            effect="plain"
          >
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="taskCount" label="任务数" width="90" />
      <el-table-column prop="createdAt" label="创建时间" width="220" />
    </el-table>
    <div class="table-pagination">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :total="totalProjects"
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        @current-change="$emit('updatePage', $event)"
        @size-change="$emit('updatePageSize', $event)"
      />
    </div>
  </el-card>
</template>
