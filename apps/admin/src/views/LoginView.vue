<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminSession } from '../composables/useAdminSession'
import AuthCard from '../platform/AuthCard.vue'

const api = useAdminSession()
const route = useRoute()
const router = useRouter()
const phoneNumber = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoggingIn = ref(false)

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function safeRedirectPath(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return '/tasks'
  }

  if (value === '/login') {
    return '/tasks'
  }

  return value
}

async function authenticate() {
  errorMessage.value = ''

  if (!phoneNumber.value.trim() || !password.value) {
    errorMessage.value = '请输入手机号和密码'
    return
  }

  if (isLoggingIn.value) {
    return
  }

  isLoggingIn.value = true

  try {
    await api.authenticate('login', {
      phoneNumber: phoneNumber.value.trim(),
      password: password.value,
      displayName: '',
    })
    const profile = await api.loadProfile()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      await api.signOut(false)
      errorMessage.value = 'No admin access'
      return
    }

    await router.push(safeRedirectPath(route.query.redirect))
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '登录失败')
  } finally {
    isLoggingIn.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-copy">
        <p>智枢运营台</p>
        <h1>登录后管理生成运营任务</h1>
      </div>

      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        class="alert"
      />

      <AuthCard
        v-model:phone-number="phoneNumber"
        v-model:password="password"
        :is-submitting="isLoggingIn"
        @login="authenticate"
      />
    </section>
  </main>
</template>
