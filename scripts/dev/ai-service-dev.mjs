#!/usr/bin/env node

import { spawn } from 'node:child_process'
import net from 'node:net'

const DEFAULT_HOST = '0.0.0.0'
const DEFAULT_PORT = 8000
const PORT_SEARCH_LIMIT = 20

async function main() {
  const host = process.env.AI_SERVICE_HOST || DEFAULT_HOST
  const configuredPort = process.env.AI_SERVICE_PORT || process.env.PORT
  const startPort = parsePort(configuredPort, DEFAULT_PORT)
  const explicitPort = Boolean(configuredPort)
  const port = explicitPort ? startPort : await findAvailablePort(host, startPort)

  if (explicitPort && !(await isPortAvailable(host, port))) {
    console.error(`[ai-service] port ${port} is already in use. Set AI_SERVICE_PORT to another port.`)
    process.exit(1)
  }

  if (port !== startPort) {
    console.log(`[ai-service] port ${startPort} is in use; starting FastAPI on ${port} instead.`)
  }

  const child = spawn(
    'uv',
    ['run', 'uvicorn', 'src.main:app', '--reload', '--host', host, '--port', String(port)],
    {
      stdio: 'inherit'
    }
  )

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      child.kill(signal)
    })
  }
}

function parsePort(value, fallback) {
  if (!value) {
    return fallback
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`[ai-service] invalid port: ${value}`)
    process.exit(1)
  }

  return port
}

async function findAvailablePort(host, startPort) {
  for (let port = startPort; port <= startPort + PORT_SEARCH_LIMIT; port += 1) {
    if (await isPortAvailable(host, port)) {
      return port
    }
  }

  console.error(`[ai-service] no available port found from ${startPort} to ${startPort + PORT_SEARCH_LIMIT}.`)
  process.exit(1)
}

function isPortAvailable(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => {
        resolve(true)
      })
    })

    server.listen(port, host)
  })
}

main().catch((error) => {
  console.error(`[ai-service] dev startup failed - ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
