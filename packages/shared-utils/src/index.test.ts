import assert from 'node:assert/strict'
import test from 'node:test'
import { assertNever, createId } from './index.js'

test('createId joins prefix and value with an underscore', () => {
  assert.equal(createId('task', 'abc123'), 'task_abc123')
})

test('assertNever throws a readable error for unexpected values', () => {
  assert.throws(() => assertNever('unexpected' as never), /Unexpected value: unexpected/)
})
