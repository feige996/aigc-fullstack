<script setup lang="ts">
defineProps<{
  phoneNumber: string
  password: string
}>()

defineEmits<{
  'update:phoneNumber': [value: string]
  'update:password': [value: string]
  login: []
}>()
</script>

<template>
  <el-card shadow="never" class="auth-card">
    <template #header>Sign In</template>
    <el-form label-position="top">
      <el-form-item label="Phone">
        <el-input
          :model-value="phoneNumber"
          @update:model-value="$emit('update:phoneNumber', String($event))"
        />
      </el-form-item>
      <el-form-item label="Password">
        <el-input
          :model-value="password"
          type="password"
          show-password
          @update:model-value="$emit('update:password', String($event))"
        />
      </el-form-item>
      <div class="auth-actions">
        <el-button type="primary" @click="$emit('login')">Login</el-button>
      </div>
    </el-form>
  </el-card>
</template>
