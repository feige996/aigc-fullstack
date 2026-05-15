<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminAuthApi } from '../api'
import { useAdminSession } from '../composables/useAdminSession'
import AccountCard from '../platform/AccountCard.vue'

const api = useAdminSession()
const router = useRouter()
const currentPassword = ref('')
const newPassword = ref('')
const isChangingPassword = ref(false)

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function changePassword() {
  isChangingPassword.value = true

  try {
    await adminAuthApi.changePassword(currentPassword.value, newPassword.value)

    currentPassword.value = ''
    newPassword.value = ''
    ElMessage.success('Password changed. Please sign in again.')
    await api.signOut(false)
    await router.push({ name: 'login' })
  } catch (error) {
    ElMessage.error(toErrorMessage(error, 'Change password failed'))
  } finally {
    isChangingPassword.value = false
  }
}
</script>

<template>
  <AccountCard
    v-model:current-password="currentPassword"
    v-model:new-password="newPassword"
    :is-changing-password="isChangingPassword"
    @change-password="changePassword"
  />
</template>
