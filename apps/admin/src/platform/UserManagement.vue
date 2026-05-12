<script setup lang="ts">
import type { AdminUser, UserRole, UserStatus } from '../types'

defineProps<{
  users: AdminUser[]
  currentUserId?: string
  isLoadingUsers: boolean
  isSuperAdmin: boolean
  updatingUserIds: Set<string>
}>()

defineEmits<{
  updateUserRole: [user: AdminUser, role: UserRole]
  updateUserStatus: [user: AdminUser, status: UserStatus]
}>()
</script>

<template>
  <el-card shadow="never" class="users-card">
    <template #header>User Management</template>
    <el-table v-loading="isLoadingUsers" :data="users" height="560">
      <el-table-column prop="phoneNumber" label="Phone" width="150" />
      <el-table-column prop="displayName" label="Name" min-width="150" show-overflow-tooltip />
      <el-table-column label="Role" width="180">
        <template #default="{ row }">
          <el-select
            :model-value="row.role"
            size="small"
            :disabled="!isSuperAdmin || updatingUserIds.has(row.id)"
            @change="$emit('updateUserRole', row, $event as UserRole)"
          >
            <el-option label="User" value="user" />
            <el-option label="Admin" value="admin" />
            <el-option label="Super Admin" value="super_admin" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="Status" width="140">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'" effect="plain">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="Created" width="220" />
      <el-table-column label="Actions" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'active'"
            type="danger"
            size="small"
            :loading="updatingUserIds.has(row.id)"
            :disabled="row.id === currentUserId"
            @click="$emit('updateUserStatus', row, 'disabled')"
          >
            Disable
          </el-button>
          <el-button
            v-else
            type="success"
            size="small"
            :loading="updatingUserIds.has(row.id)"
            @click="$emit('updateUserStatus', row, 'active')"
          >
            Enable
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>
