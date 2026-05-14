<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminPageActions } from '../composables/useAdminPageActions'
import { useAdminSession } from '../composables/useAdminSession'
import type { ActiveView } from '../types'

const route = useRoute()
const router = useRouter()
const api = useAdminSession()
const pageActions = useAdminPageActions()
const currentUser = api.currentUser

const activeView = computed<ActiveView>(() => {
  if (route.name === 'users') {
    return 'users'
  }

  if (route.name === 'projects') {
    return 'projects'
  }

  if (route.name === 'account') {
    return 'account'
  }

  return 'tasks'
})
const pageTitle = computed(() => String(route.meta.title ?? 'Generation Tasks'))
const pageDescription = computed(() => {
  if (!currentUser.value) {
    return 'Inspect task state, attempts, and failure signals.'
  }

  return `Signed in as ${currentUser.value.phoneNumber}`
})

async function setActiveView(view: ActiveView) {
  await router.push({ name: view })
}

async function signOut() {
  await api.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="232px" class="aside">
      <div class="brand">AIGC Admin</div>
      <el-menu
        :default-active="activeView"
        background-color="#1f2937"
        text-color="#d1d5db"
        active-text-color="#fff"
        @select="(index: string) => setActiveView(index as ActiveView)"
      >
        <el-menu-item index="tasks">Tasks</el-menu-item>
        <el-menu-item index="projects">Projects</el-menu-item>
        <el-menu-item index="users">Users</el-menu-item>
        <el-menu-item index="account">Account</el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div>
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageDescription }}</p>
        </div>
        <div class="header-actions">
          <span v-if="currentUser" class="user-pill">{{
            currentUser.role
          }}</span>
          <el-button @click="signOut">Sign Out</el-button>
          <el-button
            v-if="pageActions.refreshHandler.value"
            type="primary"
            :loading="pageActions.refreshLoading.value"
            @click="pageActions.refreshCurrentPage"
          >
            Refresh
          </el-button>
        </div>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
