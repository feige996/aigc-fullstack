#!/usr/bin/env node

import { copyFileSync, existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function main() {
  console.log('[setup] checking local development prerequisites')

  ensureEnvFile()
  checkDirectory('node_modules', 'Run `pnpm install` to install Node workspace dependencies.')
  checkDirectory('apps/ai-service/.venv', 'Run `cd apps/ai-service && uv sync` to install Python dependencies.')
  await checkCommand('docker', ['--version'], 'Install Docker and start it before running local infrastructure.')

  console.log('')
  console.log('[setup] next steps')
  console.log('1. docker compose -f infra/compose/docker-compose.yml up -d')
  console.log('2. pnpm dev')
  console.log('3. pnpm doctor')
}

function ensureEnvFile() {
  if (existsSync('.env')) {
    console.log('[ok] .env already exists')
    return
  }

  if (!existsSync('.env.example')) {
    console.log('[fail] .env.example missing. Cannot create .env.')
    process.exitCode = 1
    return
  }

  copyFileSync('.env.example', '.env')
  console.log('[ok] created .env from .env.example')
}

function checkDirectory(path, hint) {
  if (existsSync(path)) {
    console.log(`[ok] ${path} exists`)
    return
  }

  console.log(`[warn] ${path} missing. ${hint}`)
}

async function checkCommand(command, args, hint) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 5000 })
    console.log(`[ok] ${command} available - ${stdout.trim()}`)
  } catch {
    console.log(`[warn] ${command} unavailable. ${hint}`)
  }
}

main().catch((error) => {
  console.error(`[fail] setup crashed - ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
