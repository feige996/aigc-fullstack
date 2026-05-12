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
    <h2>Account</h2>
    <label>
      Current Password
      <input
        :value="currentPassword"
        type="password"
        @input="$emit('update:currentPassword', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      New Password
      <input
        :value="newPassword"
        type="password"
        @input="$emit('update:newPassword', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button type="button" :disabled="isChangingPassword" @click="$emit('changePassword')">
      {{ isChangingPassword ? 'Changing...' : 'Change Password' }}
    </button>
    <p v-if="successMessage" class="success">{{ successMessage }}</p>
  </section>
</template>
