<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  currentPassword: string
  newPassword: string
  isChangingPassword: boolean
}>()

const emit = defineEmits<{
  'update:currentPassword': [value: string]
  'update:newPassword': [value: string]
  changePassword: []
}>()

const canSubmit = computed(
  () =>
    props.currentPassword.length > 0 &&
    props.newPassword.length >= 8 &&
    !props.isChangingPassword,
)

function submit() {
  if (!props.currentPassword) {
    ElMessage.error('请输入当前密码')
    return
  }

  if (!props.newPassword) {
    ElMessage.error('请输入新密码')
    return
  }

  if (props.newPassword.length < 8) {
    ElMessage.error('新密码至少 8 位')
    return
  }

  if (props.isChangingPassword) {
    return
  }

  emit('changePassword')
}
</script>

<template>
  <el-card shadow="never" class="account-card">
    <template #header>账号</template>
    <el-form label-position="top" class="account-form" @submit.prevent="submit">
      <el-form-item label="当前密码" required>
        <el-input
          :model-value="currentPassword"
          type="password"
          show-password
          autocomplete="current-password"
          @update:model-value="$emit('update:currentPassword', String($event))"
        />
      </el-form-item>
      <el-form-item label="新密码" required>
        <el-input
          :model-value="newPassword"
          type="password"
          show-password
          autocomplete="new-password"
          @update:model-value="$emit('update:newPassword', String($event))"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          native-type="submit"
          :disabled="!canSubmit"
          :loading="isChangingPassword"
        >
          修改密码
        </el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>
