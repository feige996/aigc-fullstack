import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashGenerationPayload,
  serializeTask,
  taskAccessWhere,
  toPrismaJson,
} from './generation.serializer';

test('taskAccessWhere allows admins to see all tasks', () => {
  assert.deepEqual(
    taskAccessWhere({ id: 'admin_1', phoneNumber: '13900139000', role: 'admin', status: 'active' }),
    {},
  );
  assert.deepEqual(
    taskAccessWhere({ id: 'root_1', phoneNumber: '13900139001', role: 'super_admin', status: 'active' }),
    {},
  );
});

test('taskAccessWhere scopes regular users to their own tasks', () => {
  assert.deepEqual(
    taskAccessWhere({ id: 'user_1', phoneNumber: '13900139002', role: 'user', status: 'active' }),
    {
      userId: 'user_1',
    },
  );
});

test('hashGenerationPayload is deterministic for the same payload shape', () => {
  const payload = {
    type: 'text_to_image',
    model: 'mock-image-v1',
    prompt: 'product photo',
    ratio: '1:1',
    referenceAssetIds: [],
  };

  assert.equal(hashGenerationPayload(payload), hashGenerationPayload({ ...payload }));
});

test('serializeTask converts dates and nested assets to API-friendly fields', () => {
  const createdAt = new Date('2026-05-14T00:00:00.000Z');
  const updatedAt = new Date('2026-05-14T01:00:00.000Z');
  const completedAt = new Date('2026-05-14T02:00:00.000Z');
  const startedAt = new Date('2026-05-14T00:05:00.000Z');
  const endedAt = new Date('2026-05-14T00:06:00.000Z');

  const task = serializeTask({
    id: 'task_1',
    userId: 'user_1',
    projectId: null,
    type: 'text_to_image',
    model: 'mock-image-v1',
    status: 'succeeded',
    stage: 'completed',
    failureCode: null,
    billingStatus: 'none',
    currentAttemptId: 'attempt_1',
    maxAttempts: 3,
    inputPayload: { prompt: 'product photo' },
    resultPayload: null,
    usagePayload: null,
    createdAt,
    updatedAt,
    completedAt,
    currentAttempt: {
      id: 'attempt_1',
      taskId: 'task_1',
      attemptNo: 1,
      status: 'failed',
      stage: 'provider_generate',
      provider: 'mock',
      providerTaskId: 'provider_task_1',
      failureCode: 'PROVIDER_FAILED',
      retryable: true,
      idempotencyKey: 'task_1:attempt:1',
      inputPayloadHash: 'hash_1',
      rawError: {
        code: 'PROVIDER_FAILED',
        message: 'provider failed',
        type: 'ProviderError',
      },
      startedAt,
      endedAt,
      createdAt,
      updatedAt,
    },
    attempts: [
      {
        id: 'attempt_1',
        taskId: 'task_1',
        attemptNo: 1,
        status: 'failed',
        stage: 'provider_generate',
        provider: 'mock',
        providerTaskId: 'provider_task_1',
        failureCode: 'PROVIDER_FAILED',
        retryable: true,
        idempotencyKey: 'task_1:attempt:1',
        inputPayloadHash: 'hash_1',
        rawError: {
          code: 'PROVIDER_FAILED',
          message: 'provider failed',
          type: 'ProviderError',
        },
        startedAt,
        endedAt,
        createdAt,
        updatedAt,
      },
    ],
    assets: [
      {
        id: 'asset_1',
        userId: 'user_1',
        projectId: null,
        taskId: 'task_1',
        type: 'model_output_raw',
        status: 'active',
        provider: 'mock-provider',
        bucket: 'aigc-assets',
        objectKey: 'aigc/mock/output.png',
        mimeType: 'image/png',
        size: null,
        checksum: null,
        width: 1,
        height: 1,
        duration: null,
        expiresAt: null,
        deletedAt: null,
        createdAt,
        updatedAt,
      },
    ],
  });

  assert.equal(task.taskId, 'task_1');
  assert.equal(task.createdAt, createdAt.toISOString());
  assert.equal(task.completedAt, completedAt.toISOString());
  assert.equal(task.currentAttempt?.id, 'attempt_1');
  assert.equal(task.currentAttempt?.attemptId, 'attempt_1');
  assert.equal(task.currentAttempt?.startedAt, startedAt.toISOString());
  assert.equal(task.currentAttempt?.endedAt, endedAt.toISOString());
  assert.deepEqual(task.currentAttempt?.rawError, {
    code: 'PROVIDER_FAILED',
    message: 'provider failed',
    type: 'ProviderError',
  });
  assert.equal(task.attempts?.[0]?.id, 'attempt_1');
  assert.equal(task.attempts?.[0]?.provider, 'mock');
  assert.equal(task.attempts?.[0]?.providerTaskId, 'provider_task_1');
  assert.equal(task.attempts?.[0]?.createdAt, createdAt.toISOString());
  assert.equal(task.assets?.[0]?.assetId, 'asset_1');
  assert.equal(task.assets?.[0]?.createdAt, createdAt.toISOString());
});

test('toPrismaJson removes undefined values through JSON serialization', () => {
  assert.deepEqual(toPrismaJson({ prompt: 'product photo', ratio: undefined }), {
    prompt: 'product photo',
  });
});
