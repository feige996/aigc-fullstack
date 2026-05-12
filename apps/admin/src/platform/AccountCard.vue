<script setup lang="ts">
defineProps<{
  currentPassword: string
  newPassword: string
  isChangingPassword: boolean
}>()

defineEmits<{
  'update:currentPassword': [value: string]
  'update:newPassword': [value: string]
  changePassword: []
}>()
</script>

<template>
  <el-card shadow="never" class="account-card">
    <template #header>Account</template>
    <el-form label-position="top" class="account-form">
      <el-form-item label="Current Password">
        <el-input
          :model-value="currentPassword"
          type="password"
          show-password
          @update:model-value="$emit('update:currentPassword', String($event))"
        />
      </el-form-item>
      <el-form-item label="New Password">
        <el-input
          :model-value="newPassword"
          type="password"
          show-password
          @update:model-value="$emit('update:newPassword', String($event))"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="isChangingPassword" @click="$emit('changePassword')">
          Change Password
        </el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>
