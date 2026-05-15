<script setup lang="ts">
defineProps<{
  phoneNumber: string
  password: string
  displayName: string
  errorMessage: string
  successMessage: string
}>()

defineEmits<{
  'update:phoneNumber': [value: string]
  'update:password': [value: string]
  'update:displayName': [value: string]
  login: []
  register: []
}>()
</script>

<template>
  <section class="panel auth-panel">
    <label>
      手机号
      <input
        :value="phoneNumber"
        type="tel"
        autocomplete="username"
        @input="$emit('update:phoneNumber', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      密码
      <input
        :value="password"
        type="password"
        autocomplete="current-password"
        @input="$emit('update:password', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      显示名称
      <input
        :value="displayName"
        type="text"
        autocomplete="name"
        @input="$emit('update:displayName', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <div class="controls">
      <button type="button" @click="$emit('login')">登录</button>
      <button type="button" class="secondary-button" @click="$emit('register')">注册</button>
    </div>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="success">{{ successMessage }}</p>
  </section>
</template>
