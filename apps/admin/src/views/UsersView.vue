<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { adminUsersApi } from '../api'
import { useAdminPageActions } from '../composables/useAdminPageActions'
import { useAdminSession } from '../composables/useAdminSession'
import UserManagement from '../platform/UserManagement.vue'
import type { AdminUser, UserRole, UserStatus } from '../types'

const api = useAdminSession()
const pageActions = useAdminPageActions()
const currentUser = api.currentUser
const users = ref<AdminUser[]>([])
const totalUsers = ref(0)
const page = ref(1)
const pageSize = ref(20)
const searchQuery = ref('')
const roleFilter = ref<UserRole | 'all'>('all')
const statusFilter = ref<UserStatus | 'all'>('all')
const isLoadingUsers = ref(false)
const updatingUserIds = ref(new Set<string>())
const isSuperAdmin = computed(() => currentUser.value?.role === 'super_admin')

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function loadUsers() {
  isLoadingUsers.value = true

  try {
    const result = await adminUsersApi.list({
        page: page.value,
        pageSize: pageSize.value,
        search: searchQuery.value.trim(),
        role: roleFilter.value === 'all' ? undefined : roleFilter.value,
        status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      })
    users.value = result.items
    totalUsers.value = result.total
  } catch (error) {
    ElMessage.error(toErrorMessage(error, 'Load users failed'))
  } finally {
    isLoadingUsers.value = false
  }
}

async function updateUserStatus(user: AdminUser, status: UserStatus) {
  try {
    await ElMessageBox.confirm(
      `${status === 'disabled' ? '禁用' : '启用'}用户 ${user.phoneNumber}?`,
      '确认更新用户状态',
      {
        confirmButtonText: status === 'disabled' ? '禁用' : '启用',
        cancelButtonText: '取消',
        type: status === 'disabled' ? 'warning' : 'info',
        confirmButtonClass: status === 'disabled' ? 'el-button--danger' : '',
      },
    )
  } catch {
    return
  }

  await updateUser(user.id, () => adminUsersApi.updateStatus(user.id, status))
}

async function updateUserRole(user: AdminUser, role: UserRole) {
  try {
    await ElMessageBox.confirm(
      `将用户 ${user.phoneNumber} 的角色改为 ${role}?`,
      '确认更新用户角色',
      {
        confirmButtonText: '更新角色',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  await updateUser(user.id, () => adminUsersApi.updateRole(user.id, role))
}

async function updateUser(
  userId: string,
  requestUpdate: () => Promise<AdminUser>,
) {
  updatingUserIds.value = new Set(updatingUserIds.value).add(userId)

  try {
    const updatedUser = await requestUpdate()
    users.value = users.value.map((user) =>
      user.id === updatedUser.id ? updatedUser : user,
    )
    ElMessage.success('User updated.')

    if (updatedUser.id === currentUser.value?.id) {
      currentUser.value = {
        ...currentUser.value,
        role: updatedUser.role,
        status: updatedUser.status,
      }
    }
  } catch (error) {
    ElMessage.error(toErrorMessage(error, 'Update user failed'))
  } finally {
    const nextUpdatingIds = new Set(updatingUserIds.value)
    nextUpdatingIds.delete(userId)
    updatingUserIds.value = nextUpdatingIds
  }
}

function updatePage(nextPage: number) {
  page.value = nextPage
  loadUsers()
}

function updatePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize
  page.value = 1
  loadUsers()
}

let searchTimer: number | undefined

watch([searchQuery, roleFilter, statusFilter], () => {
  page.value = 1
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    loadUsers()
  }, 250)
})

onMounted(() => {
  pageActions.setRefreshAction(loadUsers, isLoadingUsers)
  loadUsers()
})

onUnmounted(() => {
  pageActions.clearRefreshAction(loadUsers)
})
</script>

<template>
  <UserManagement
    :users="users"
    :current-user-id="currentUser?.id"
    :total-users="totalUsers"
    :page="page"
    :page-size="pageSize"
    v-model:search-query="searchQuery"
    v-model:role-filter="roleFilter"
    v-model:status-filter="statusFilter"
    :is-loading-users="isLoadingUsers"
    :is-super-admin="isSuperAdmin"
    :updating-user-ids="updatingUserIds"
    @update-user-role="updateUserRole"
    @update-user-status="updateUserStatus"
    @update-page="updatePage"
    @update-page-size="updatePageSize"
  />
</template>
