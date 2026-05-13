#!/usr/bin/env node

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api'
const phoneNumber = process.env.SMOKE_PHONE_NUMBER ?? '13900139000'
const password = process.env.SMOKE_PASSWORD ?? 'password123'
const prompt = process.env.SMOKE_PROMPT ?? 'smoke test product photo'
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 30000)
const intervalMs = Number(process.env.SMOKE_INTERVAL_MS ?? 1000)

async function main() {
  log(`api=${apiBaseUrl}`)
  log(`user=${phoneNumber} timeoutMs=${timeoutMs} intervalMs=${intervalMs}`)

  const auth = await login()
  log(`authenticated user=${auth.user.phoneNumber} role=${auth.user.role}`)

  const profile = await apiFetch('/auth/me', auth.accessToken)
  log(`profile id=${profile.id}`)

  const createdTask = await apiFetch('/generation/tasks', auth.accessToken, {
    method: 'POST',
    body: {
      type: 'text_to_image',
      model: 'mock-image-v1',
      prompt,
      ratio: '1:1',
      referenceAssetIds: []
    }
  })
  log(`created task=${createdTask.taskId} status=${createdTask.status}`)

  const task = await waitForTask(auth.accessToken, createdTask.taskId)
  log(`final task=${task.taskId} status=${task.status} stage=${task.stage}`)

  if (task.status !== 'succeeded') {
    throw new Error(`Expected task to succeed, got ${task.status}`)
  }

  const outputAssets = task.assets ?? []

  if (outputAssets.length === 0) {
    throw new Error(`Expected task ${task.taskId} to have at least one output asset`)
  }

  const firstAsset = outputAssets[0]
  log(`output assets=${outputAssets.length} first=${firstAsset.objectKey}`)

  const download = await apiFetch(`/assets/${firstAsset.assetId}/download`, auth.accessToken, {
    method: 'POST'
  })
  const file = await downloadFile(download.url)
  log(`download status=${file.status} contentType=${file.contentType} bytes=${file.byteLength}`)

  if (file.byteLength === 0) {
    throw new Error(`Expected downloaded asset ${firstAsset.assetId} to be non-empty`)
  }
}

async function login() {
  const url = `${apiBaseUrl}/auth/login`
  const response = await safeFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phoneNumber,
      password
    })
  })

  if (!response.ok) {
    throw new Error(
      [
        `Login failed: ${response.status} ${await response.text()}`,
        'Check that the API is running, the database is reachable, and the seed user exists.',
        'Default local credentials are SMOKE_PHONE_NUMBER=13900139000 and SMOKE_PASSWORD=password123.'
      ].join('\n')
    )
  }

  return response.json()
}

async function waitForTask(accessToken, taskId) {
  const startedAt = Date.now()
  let lastTask

  while (Date.now() - startedAt < timeoutMs) {
    const task = await apiFetch(`/generation/tasks/${taskId}`, accessToken)
    lastTask = task
    log(`poll task=${task.taskId} status=${task.status}`)

    if (['succeeded', 'failed', 'final_failed', 'canceled', 'rejected', 'expired'].includes(task.status)) {
      return task
    }

    await sleep(intervalMs)
  }

  const lastStatus = lastTask ? `${lastTask.status}/${lastTask.stage}` : 'unknown'
  const hints = [`Timed out waiting for task ${taskId}. Last status=${lastStatus}.`]

  if (lastTask && lastTask.status === 'queued') {
    hints.push('The task is still queued. Run `pnpm doctor` and check the AI worker consumer.')
    hints.push('If image.generate.queue consumers=0, start worker with `pnpm dev` or `pnpm --filter @aigc/ai-service worker`.')
  }

  throw new Error(hints.join('\n'))
}

async function apiFetch(path, accessToken, init = {}) {
  const url = `${apiBaseUrl}${path}`
  const response = await safeFetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  })

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

async function safeFetch(url, init) {
  try {
    return await fetch(url, init)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      [
        `Request failed: ${url} (${detail})`,
        'Check that the API is running with `pnpm dev` or `pnpm dev:generation`.',
        'Run `pnpm doctor` for local service diagnostics.'
      ].join('\n')
    )
  }
}

async function downloadFile(url) {
  const response = await safeFetch(url)

  if (!response.ok) {
    throw new Error(
      [
        `Download failed: ${response.status} ${await response.text()}`,
        'Check MinIO and object storage settings, then run `pnpm doctor`.'
      ].join('\n')
    )
  }

  const buffer = await response.arrayBuffer()

  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'unknown',
    byteLength: buffer.byteLength
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function log(message) {
  console.log(`[smoke] ${message}`)
}

main().catch((error) => {
  console.error(`[smoke] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
