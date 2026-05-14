<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAdminPageActions } from '../composables/useAdminPageActions'
import { useAdminSession } from '../composables/useAdminSession'
import UserManagement from '../platform/UserManagement.vue'
import type { AdminUser, UserRole, UserStatus } from '../types'

const api = useAdminSession()
const pageActions = useAdminPageActions()
const currentUser = api.currentUser
const users = ref<AdminUser[]>([])
const isLoadingUsers = ref(false)
const updatingUserIds = ref(new Set<string>())
const isSuperAdmin = computed(() => currentUser.value?.role === 'super_admin')

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function loadUsers() {
  isLoadingUsers.value = true

  try {
    const result = await api.requestJson<{ items: AdminUser[] }>(
      '/admin/users',
      {},
      'Load users',
    )
    users.value = result.items
  } catch (error) {
    ElMessage.error(toErrorMessage(error, 'Load users failed'))
  } finally {
    isLoadingUsers.value = false
  }
}

async function updateUserStatus(user: AdminUser, status: UserStatus) {
  await updateUser(user.id, `/admin/users/${user.id}/status`, {
    status,
  })
}

async function updateUserRole(user: AdminUser, role: UserRole) {
  await updateUser(user.id, `/admin/users/${user.id}/role`, {
    role,
  })
}

async function updateUser(
  userId: string,
  path: string,
  body: Record<string, string>,
) {
  updatingUserIds.value = new Set(updatingUserIds.value).add(userId)

  try {
    const updatedUser = await api.requestJson<AdminUser>(
      path,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'Update user',
    )
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
    :is-loading-users="isLoadingUsers"
    :is-super-admin="isSuperAdmin"
    :updating-user-ids="updatingUserIds"
    @update-user-role="updateUserRole"
    @update-user-status="updateUserStatus"
  />
</template>
