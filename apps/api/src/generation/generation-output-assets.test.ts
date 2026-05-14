import assert from 'node:assert/strict'
import test from 'node:test'
import type { TaskResultMessage } from '@aigc/shared-contracts'
import { buildOutputAssetCreates } from './generation-output-assets'

const task = {
  id: 'task_1',
  userId: 'user_1',
  projectId: 'project_1'
}

test('buildOutputAssetCreates maps s3 output paths to asset records', () => {
  const message: TaskResultMessage = {
    traceId: 'trace_1',
    taskId: 'task_1',
    attemptId: 'attempt_1',
    status: 'succeeded',
    provider: 'mock-provider',
    outputs: [
      {
        type: 'image',
        objectPath: 's3://aigc-assets/aigc/mock/user_1/task_1/output.png',
        width: 1,
        height: 1
      }
    ]
  }

  assert.deepEqual(buildOutputAssetCreates({ task, message }), [
    {
      userId: 'user_1',
      projectId: 'project_1',
      taskId: 'task_1',
      type: 'model_output_raw',
      status: 'active',
      provider: 'mock-provider',
      bucket: 'aigc-assets',
      objectKey: 'aigc/mock/user_1/task_1/output.png',
      mimeType: 'image/png',
      size: null,
      width: 1,
      height: 1,
      duration: undefined,
      checksum: null,
      expiresAt: null
    }
  ])
})

test('buildOutputAssetCreates keeps non-s3 object paths in the default bucket', () => {
  const message: TaskResultMessage = {
    traceId: 'trace_1',
    taskId: 'task_1',
    attemptId: 'attempt_1',
    status: 'succeeded',
    provider: 'video-provider',
    outputs: [
      {
        type: 'video',
        objectPath: 'aigc/videos/output.mp4',
        duration: 8
      }
    ]
  }

  const [asset] = buildOutputAssetCreates({ task: { ...task, projectId: null }, message })

  assert.equal(asset.bucket, 'aigc-assets')
  assert.equal(asset.objectKey, 'aigc/videos/output.mp4')
  assert.equal(asset.mimeType, 'video/mp4')
  assert.equal(asset.projectId, null)
  assert.equal(asset.duration, 8)
})
