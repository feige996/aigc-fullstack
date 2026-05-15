<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  phoneNumber: string
  password: string
  isSubmitting: boolean
}>()

const emit = defineEmits<{
  'update:phoneNumber': [value: string]
  'update:password': [value: string]
  login: []
}>()

const canSubmit = computed(
  () => props.phoneNumber.trim().length > 0 && props.password.length > 0,
)

function submit() {
  if (props.isSubmitting) {
    return
  }

  emit('login')
}
</script>

<template>
  <el-card shadow="never" class="auth-card">
    <template #header>登录</template>
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="手机号" required>
        <el-input
          :model-value="phoneNumber"
          autocomplete="username"
          @update:model-value="$emit('update:phoneNumber', String($event))"
        />
      </el-form-item>
      <el-form-item label="密码" required>
        <el-input
          :model-value="password"
          type="password"
          show-password
          autocomplete="current-password"
          @update:model-value="$emit('update:password', String($event))"
        />
      </el-form-item>
      <div class="auth-actions">
        <el-button
          type="primary"
          native-type="submit"
          :disabled="!canSubmit || isSubmitting"
          :loading="isSubmitting"
        >
          登录
        </el-button>
      </div>
    </el-form>
  </el-card>
</template>
