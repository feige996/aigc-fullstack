#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const checks = []

async function main() {
  await checkCommand('node', ['--version'])
  await checkCommand('pnpm', ['--version'])
  await checkCommand('uv', ['--version'])
  await checkCommand('docker', ['--version'])
  checkFile('.env', 'Run `cp .env.example .env` before local development.')
  await checkDockerContainer('mysql container', ['aigc-mysql', 'mysql-novel'])
  await checkDockerContainer('redis container', ['aigc-redis'])
  await checkDockerContainer('rabbitmq container', ['aigc-rabbitmq'])
  await checkDockerContainer('minio container', ['aigc-minio'])
  await checkHttp('api health', 'http://localhost:3000/api/health')
  await checkHttp('minio health', 'http://localhost:9000/minio/health/live')
  await checkRabbitQueues()

  const failed = checks.filter((check) => check.status === 'fail')
  const warned = checks.filter((check) => check.status === 'warn')

  console.log('')
  console.log(`[doctor] ${checks.length - failed.length - warned.length} ok, ${warned.length} warn, ${failed.length} fail`)

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

async function checkCommand(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 5000 })
    pass(`${command} available`, stdout.trim())
  } catch {
    fail(`${command} unavailable`, `Install ${command} and try again.`)
  }
}

function checkFile(path, hint) {
  if (existsSync(path)) {
    pass(`${path} exists`)
    return
  }

  fail(`${path} missing`, hint)
}

async function checkDockerContainer(label, names) {
  for (const name of names) {
    try {
      const { stdout } = await execFileAsync('docker', ['inspect', '-f', '{{.State.Running}}', name], {
        timeout: 5000
      })

      if (stdout.trim() === 'true') {
        pass(`${label} running`, name)
        return
      }
    } catch {
      // Try the next known local container name.
    }
  }

  fail(`${label} unavailable`, 'Run `docker compose -f infra/compose/docker-compose.yml up -d`.')
}

async function checkHttp(name, url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })

    if (response.ok) {
      pass(name, `${response.status} ${url}`)
      return
    }

    fail(name, `${response.status} ${url}`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    fail(name, `${url} (${detail})`)
  }
}

async function checkRabbitQueues() {
  let stdout

  try {
    const result = await execFileAsync(
      'docker',
      ['exec', 'aigc-rabbitmq', 'rabbitmqctl', 'list_queues', 'name', 'messages', 'consumers'],
      { timeout: 10000 }
    )
    stdout = result.stdout
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    fail('rabbitmq queues', `Unable to list queues (${detail})`)
    return
  }

  const queues = parseQueueRows(stdout)
  const imageQueue = queues.get('image.generate.queue')

  if (!imageQueue) {
    fail('image.generate.queue missing', 'Start API once so it can declare the queue topology.')
    return
  }

  if (imageQueue.consumers > 0) {
    pass('image.generate.queue consumer', `messages=${imageQueue.messages} consumers=${imageQueue.consumers}`)
    return
  }

  const status = imageQueue.messages > 0 ? 'fail' : 'warn'
  record(
    status,
    'image.generate.queue consumer',
    `messages=${imageQueue.messages} consumers=0. Start worker with \`pnpm --filter @aigc/ai-service worker\` or \`pnpm dev\`.`
  )
}

function parseQueueRows(stdout) {
  const queues = new Map()

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('Timeout:') || trimmed.startsWith('Listing queues') || trimmed === 'name\tmessages\tconsumers') {
      continue
    }

    const [name, messages, consumers] = trimmed.split(/\s+/)

    if (!name || messages === undefined || consumers === undefined) {
      continue
    }

    queues.set(name, {
      messages: Number(messages),
      consumers: Number(consumers)
    })
  }

  return queues
}

function pass(label, detail) {
  record('ok', label, detail)
}

function fail(label, detail) {
  record('fail', label, detail)
}

function record(status, label, detail) {
  checks.push({ status, label, detail })
  const prefix = status === 'ok' ? '[ok]' : status === 'warn' ? '[warn]' : '[fail]'
  console.log(`${prefix} ${label}${detail ? ` - ${detail}` : ''}`)
}

main().catch((error) => {
  console.error(`[fail] doctor crashed - ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
