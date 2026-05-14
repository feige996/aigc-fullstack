<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AdminUser, UserRole, UserStatus } from '../types'

const props = defineProps<{
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

const searchQuery = ref('')
const roleFilter = ref<UserRole | 'all'>('all')
const statusFilter = ref<UserStatus | 'all'>('all')

const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return props.users.filter((user) => {
    const matchesQuery =
      !query ||
      user.phoneNumber.toLowerCase().includes(query) ||
      user.displayName?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    const matchesRole =
      roleFilter.value === 'all' || user.role === roleFilter.value
    const matchesStatus =
      statusFilter.value === 'all' || user.status === statusFilter.value

    return matchesQuery && matchesRole && matchesStatus
  })
})
</script>

<template>
  <el-card shadow="never" class="users-card">
    <template #header>
      <div class="card-toolbar">
        <span>User Management</span>
        <div class="filters">
          <el-input
            v-model="searchQuery"
            clearable
            placeholder="Search phone, name, id"
          />
          <el-select v-model="roleFilter" placeholder="Role">
            <el-option label="All Roles" value="all" />
            <el-option label="User" value="user" />
            <el-option label="Admin" value="admin" />
            <el-option label="Super Admin" value="super_admin" />
          </el-select>
          <el-select v-model="statusFilter" placeholder="Status">
            <el-option label="All Statuses" value="all" />
            <el-option label="Active" value="active" />
            <el-option label="Disabled" value="disabled" />
          </el-select>
        </div>
      </div>
    </template>
    <el-table
      v-loading="isLoadingUsers"
      :data="filteredUsers"
      height="560"
      empty-text="No matching users"
    >
      <el-table-column prop="phoneNumber" label="Phone" width="150" />
      <el-table-column
        prop="displayName"
        label="Name"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="Role" width="180">
        <template #default="{ row }">
          <el-tooltip
            :disabled="isSuperAdmin"
            content="Only super admins can change roles"
            placement="top"
          >
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
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="Status" width="140">
        <template #default="{ row }">
          <el-tag
            :type="row.status === 'active' ? 'success' : 'danger'"
            effect="plain"
          >
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
