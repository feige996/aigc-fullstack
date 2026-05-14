import { createRouter, createWebHistory } from 'vue-router'

const authStorageKey = 'aigc.admin.auth'

function hasStoredAccessToken() {
  const rawValue = localStorage.getItem(authStorageKey)

  if (!rawValue) {
    return false
  }

  try {
    const parsed = JSON.parse(rawValue) as { accessToken?: string }
    return Boolean(parsed.accessToken)
  } catch {
    return Boolean(rawValue)
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/tasks',
    },
    {
      path: '/login',
      component: { template: '<div />' },
    },
    {
      path: '/tasks',
      component: { template: '<div />' },
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/projects',
      component: { template: '<div />' },
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/users',
      component: { template: '<div />' },
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/account',
      component: { template: '<div />' },
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/tasks',
    },
  ],
})

router.beforeEach((to) => {
  const isAuthenticated = hasStoredAccessToken()

  if (to.meta.requiresAuth && !isAuthenticated) {
    return {
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (to.path === '/login' && isAuthenticated) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/tasks'
    return redirect
  }

  return true
})
