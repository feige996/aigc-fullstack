import type { NextFunction, Request, Response } from 'express'
import { createRequestContext } from './observability'

function pickHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function writeJsonLog(payload: Record<string, unknown>) {
  console.log(JSON.stringify(payload))
}

export function httpObservabilityMiddleware(req: Request, res: Response, next: NextFunction) {
  const { requestId, traceId } = createRequestContext({
    requestId: pickHeader(req.header('x-request-id')),
    traceId: pickHeader(req.header('x-trace-id'))
  })
  const startedAt = Date.now()
  let logged = false

  res.setHeader('x-request-id', requestId)
  res.setHeader('x-trace-id', traceId)

  const logRequest = (outcome: 'ok' | 'aborted') => {
    if (logged) {
      return
    }

    logged = true

    writeJsonLog({
      level: outcome === 'ok' ? 'info' : 'warn',
      event: 'http_request',
      requestId,
      traceId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      outcome
    })
  }

  res.once('finish', () => {
    logRequest('ok')
  })
  res.once('close', () => {
    logRequest('aborted')
  })

  next()
}
