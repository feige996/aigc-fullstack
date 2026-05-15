<script setup lang="ts">
defineProps<{
  currentPassword: string
  newPassword: string
  isChangingPassword: boolean
  successMessage: string
}>()

defineEmits<{
  'update:currentPassword': [value: string]
  'update:newPassword': [value: string]
  changePassword: []
}>()
</script>

<template>
  <section class="panel account-panel">
    <h2>账号安全</h2>
    <label>
      当前密码
      <input
        :value="currentPassword"
        type="password"
        autocomplete="current-password"
        @input="$emit('update:currentPassword', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      新密码
      <input
        :value="newPassword"
        type="password"
        autocomplete="new-password"
        @input="$emit('update:newPassword', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button type="button" :disabled="isChangingPassword" @click="$emit('changePassword')">
      {{ isChangingPassword ? '修改中...' : '修改密码' }}
    </button>
    <p v-if="successMessage" class="success">{{ successMessage }}</p>
  </section>
</template>
