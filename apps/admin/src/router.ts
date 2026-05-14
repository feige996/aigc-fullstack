import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/tasks',
    },
    {
      path: '/tasks',
      component: { template: '<div />' },
    },
    {
      path: '/projects',
      component: { template: '<div />' },
    },
    {
      path: '/users',
      component: { template: '<div />' },
    },
    {
      path: '/account',
      component: { template: '<div />' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/tasks',
    },
  ],
})
