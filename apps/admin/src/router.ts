import { createRouter, createWebHistory } from 'vue-router'
import { useAdminSession } from './composables/useAdminSession'
import AdminLayout from './layouts/AdminLayout.vue'
import AccountView from './views/AccountView.vue'
import LoginView from './views/LoginView.vue'
import ProjectsView from './views/ProjectsView.vue'
import TasksView from './views/TasksView.vue'
import UsersView from './views/UsersView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/tasks',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/',
      component: AdminLayout,
      meta: {
        requiresAuth: true,
      },
      children: [
        {
          path: 'tasks',
          name: 'tasks',
          component: TasksView,
          meta: {
            title: '任务运营',
          },
        },
        {
          path: 'projects',
          name: 'projects',
          component: ProjectsView,
          meta: {
            title: '项目管理',
          },
        },
        {
          path: 'users',
          name: 'users',
          component: UsersView,
          meta: {
            title: '用户管理',
          },
        },
        {
          path: 'account',
          name: 'account',
          component: AccountView,
          meta: {
            title: '账号设置',
          },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/tasks',
    },
  ],
})

router.beforeEach(async (to) => {
  const api = useAdminSession()

  if (to.meta.requiresAuth && !api.accessToken.value) {
    return {
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (to.meta.requiresAuth) {
    const profile = await api.loadProfile()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      await api.signOut(false)

      return {
        path: '/login',
        query: {
          redirect: to.fullPath,
        },
      }
    }
  }

  if (to.path === '/login' && api.accessToken.value) {
    const redirect =
      typeof to.query.redirect === 'string' ? to.query.redirect : '/tasks'
    return redirect
  }

  return true
})
