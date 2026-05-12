#!/usr/bin/env node

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api'
const phoneNumber = process.env.SMOKE_PHONE_NUMBER ?? '13900139000'
const password = process.env.SMOKE_PASSWORD ?? 'password123'
const prompt = process.env.SMOKE_PROMPT ?? 'smoke test product photo'
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 30000)
const intervalMs = Number(process.env.SMOKE_INTERVAL_MS ?? 1000)

async function main() {
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

  log(`output assets=${outputAssets.length} first=${outputAssets[0].objectKey}`)
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
    throw new Error(`Login failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

async function waitForTask(accessToken, taskId) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const task = await apiFetch(`/generation/tasks/${taskId}`, accessToken)
    log(`poll task=${task.taskId} status=${task.status}`)

    if (['succeeded', 'failed', 'final_failed', 'canceled', 'rejected', 'expired'].includes(task.status)) {
      return task
    }

    await sleep(intervalMs)
  }

  throw new Error(`Timed out waiting for task ${taskId}`)
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
    throw new Error(`Request failed: ${url} (${detail})`)
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
