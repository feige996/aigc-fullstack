import { randomUUID } from 'node:crypto'

export interface RequestContext {
  requestId: string
  traceId: string
}

export function createRequestContext(headers: {
  requestId?: string | null
  traceId?: string | null
}): RequestContext {
  const requestId = headers.requestId?.trim() || randomUUID()
  const traceId = headers.traceId?.trim() || requestId

  return {
    requestId,
    traceId
  }
}
