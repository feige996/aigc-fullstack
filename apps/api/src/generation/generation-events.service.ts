import { Injectable, MessageEvent as NestMessageEvent } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'

interface TaskEventPayload {
  taskId: string
  status: string
  stage: string
  failureCode?: string | null
}

@Injectable()
export class GenerationEventsService {
  private readonly events$ = new Subject<NestMessageEvent>()

  stream(): Observable<NestMessageEvent> {
    return this.events$.asObservable()
  }

  publishTaskEvent(event: string, payload: TaskEventPayload) {
    this.events$.next({
      type: event,
      data: payload
    })
  }
}
