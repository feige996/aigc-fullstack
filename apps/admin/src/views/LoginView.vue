<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminSession } from '../composables/useAdminSession'
import AuthCard from '../platform/AuthCard.vue'

const api = useAdminSession()
const route = useRoute()
const router = useRouter()
const phoneNumber = ref('13900139000')
const password = ref('password123')
const errorMessage = ref('')

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

  try {
    await api.authenticate('login', {
      phoneNumber: phoneNumber.value,
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
    errorMessage.value = toErrorMessage(error, 'Login failed')
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-copy">
        <p>AIGC Admin</p>
        <h1>Sign in to manage generation operations.</h1>
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
        @login="authenticate"
      />
    </section>
  </main>
</template>
