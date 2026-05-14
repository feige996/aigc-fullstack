#!/usr/bin/env node

import { spawn } from 'node:child_process'

const services = [
  {
    name: 'web',
    dockerfile: 'apps/web/Dockerfile',
    tag: 'aigc-web:local'
  },
  {
    name: 'admin',
    dockerfile: 'apps/admin/Dockerfile',
    tag: 'aigc-admin:local'
  },
  {
    name: 'api',
    dockerfile: 'apps/api/Dockerfile',
    tag: 'aigc-api:local'
  },
  {
    name: 'ai-service',
    dockerfile: 'apps/ai-service/Dockerfile',
    tag: 'aigc-ai-service:local'
  }
]

main().catch((error) => {
  console.error(`[verify-docker-builds] failed - ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const selectedServices = parseSelectedServices(args)
  const targets = selectedServices.length > 0 ? services.filter((service) => selectedServices.includes(service.name)) : services

  if (targets.length === 0) {
    console.error(`[verify-docker-builds] no matching services for: ${selectedServices.join(', ')}`)
    console.error(`[verify-docker-builds] available services: ${services.map((service) => service.name).join(', ')}`)
    process.exit(1)
  }

  for (const service of targets) {
    const commandArgs = ['build', '--file', service.dockerfile, '--tag', service.tag, '.']
    const printable = ['docker', ...commandArgs].join(' ')

    if (dryRun) {
      console.log(`[dry-run] ${printable}`)
      continue
    }

    console.log(`[verify-docker-builds] ${printable}`)
    await run('docker', commandArgs)
  }

  if (dryRun) {
    console.log('')
    console.log('[verify-docker-builds] dry run complete')
  } else {
    console.log('')
    console.log('[verify-docker-builds] all selected Docker images built successfully')
  }
}

function parseSelectedServices(args) {
  const selected = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--service') {
      const value = args[index + 1]

      if (!value) {
        console.error('[verify-docker-builds] --service requires a value')
        process.exit(1)
      }

      selected.push(value)
      index += 1
      continue
    }

    if (arg.startsWith('--service=')) {
      selected.push(arg.slice('--service='.length))
    }
  }

  return selected
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit'
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}
