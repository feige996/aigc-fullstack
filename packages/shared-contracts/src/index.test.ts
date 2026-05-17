import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aigcGenerationFeature,
  rabbitExchanges,
  rabbitQueues,
  rabbitRoutingKeys,
  type TaskResultMessage,
  taskStatuses
} from './index.js'

test('shared RabbitMQ contract keeps the generation queue topology stable', () => {
  assert.equal(rabbitExchanges.taskRequest, 'task.request')
  assert.equal(rabbitExchanges.taskResult, 'task.result')
  assert.equal(rabbitQueues.imageGenerate, 'image.generate.queue')
  assert.equal(rabbitRoutingKeys.imageGenerate, 'image.generate')
  assert.equal(rabbitRoutingKeys.taskSucceeded, 'task.succeeded')
  assert.equal(rabbitRoutingKeys.taskFailed, 'task.failed')
})

test('task statuses include terminal states used by polling clients', () => {
  assert.ok(taskStatuses.includes('succeeded'))
  assert.ok(taskStatuses.includes('failed'))
  assert.ok(taskStatuses.includes('final_failed'))
  assert.ok(taskStatuses.includes('canceled'))
  assert.ok(taskStatuses.includes('expired'))
})

test('failed task result messages support structured raw error details', () => {
  const message: TaskResultMessage = {
    traceId: 'trace_1',
    taskId: 'task_1',
    attemptId: 'attempt_1',
    status: 'failed',
    provider: 'mock',
    providerTaskId: null,
    outputs: [],
    error: {
      code: 'PROVIDER_FAILED',
      message: 'provider failed',
      retryable: true,
      type: 'ProviderError',
      class: 'src.providers.base.ProviderError',
      stage: 'provider_generate',
      provider: 'mock'
    }
  }

  assert.equal(message.error?.stage, 'provider_generate')
  assert.equal(message.error?.provider, 'mock')
})

test('AIGC generation feature declares the expected app and admin entries', () => {
  assert.equal(aigcGenerationFeature.domain, 'aigc_generation')
  assert.deepEqual(aigcGenerationFeature.taskTypes, [
    'text_to_image',
    'image_to_image',
    'image_upscale',
    'video_generation'
  ])
  assert.equal(aigcGenerationFeature.webRoutes?.[0]?.entry, 'features/aigc-generation/GenerationWorkspace')
  assert.deepEqual(aigcGenerationFeature.adminMenus?.[0]?.requiredRoles, ['admin', 'super_admin'])
})
