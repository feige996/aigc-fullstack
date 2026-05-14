import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aigcGenerationFeature,
  rabbitExchanges,
  rabbitQueues,
  rabbitRoutingKeys,
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
