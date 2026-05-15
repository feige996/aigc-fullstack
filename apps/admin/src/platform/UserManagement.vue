<script setup lang="ts">
import type { AdminUser, UserRole, UserStatus } from '../types'

defineProps<{
  users: AdminUser[]
  currentUserId?: string
  searchQuery: string
  roleFilter: UserRole | 'all'
  statusFilter: UserStatus | 'all'
  totalUsers: number
  page: number
  pageSize: number
  isLoadingUsers: boolean
  isSuperAdmin: boolean
  updatingUserIds: Set<string>
}>()

defineEmits<{
  'update:searchQuery': [value: string]
  'update:roleFilter': [value: UserRole | 'all']
  'update:statusFilter': [value: UserStatus | 'all']
  updateUserRole: [user: AdminUser, role: UserRole]
  updateUserStatus: [user: AdminUser, status: UserStatus]
  updatePage: [page: number]
  updatePageSize: [pageSize: number]
}>()
</script>

<template>
  <el-card shadow="never" class="users-card">
    <template #header>
      <div class="card-toolbar">
        <span>用户管理</span>
        <div class="filters">
          <el-input
            :model-value="searchQuery"
            clearable
            placeholder="搜索手机号、姓名、ID"
            @update:model-value="$emit('update:searchQuery', String($event))"
          />
          <el-select
            :model-value="roleFilter"
            placeholder="角色"
            @update:model-value="$emit('update:roleFilter', $event as UserRole | 'all')"
          >
            <el-option label="全部角色" value="all" />
            <el-option label="用户" value="user" />
            <el-option label="管理员" value="admin" />
            <el-option label="超级管理员" value="super_admin" />
          </el-select>
          <el-select
            :model-value="statusFilter"
            placeholder="状态"
            @update:model-value="$emit('update:statusFilter', $event as UserStatus | 'all')"
          >
            <el-option label="全部状态" value="all" />
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </div>
      </div>
    </template>
    <el-table
      v-loading="isLoadingUsers"
      :data="users"
      height="560"
      empty-text="没有匹配的用户"
    >
      <el-table-column prop="phoneNumber" label="手机号" width="150" />
      <el-table-column
        prop="displayName"
        label="姓名"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="角色" width="180">
        <template #default="{ row }">
          <el-tooltip
            :disabled="isSuperAdmin"
            content="只有超级管理员可以修改角色"
            placement="top"
          >
            <el-select
              :model-value="row.role"
              size="small"
              :disabled="!isSuperAdmin || updatingUserIds.has(row.id)"
              @change="$emit('updateUserRole', row, $event as UserRole)"
            >
              <el-option label="用户" value="user" />
              <el-option label="管理员" value="admin" />
              <el-option label="超级管理员" value="super_admin" />
            </el-select>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="140">
        <template #default="{ row }">
          <el-tag
            :type="row.status === 'active' ? 'success' : 'danger'"
            effect="plain"
          >
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="220" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'active'"
            type="danger"
            size="small"
            :loading="updatingUserIds.has(row.id)"
            :disabled="row.id === currentUserId"
            @click="$emit('updateUserStatus', row, 'disabled')"
          >
            禁用
          </el-button>
          <el-button
            v-else
            type="success"
            size="small"
            :loading="updatingUserIds.has(row.id)"
            @click="$emit('updateUserStatus', row, 'active')"
          >
            启用
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="table-pagination">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :total="totalUsers"
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        @current-change="$emit('updatePage', $event)"
        @size-change="$emit('updatePageSize', $event)"
      />
    </div>
  </el-card>
</template>
