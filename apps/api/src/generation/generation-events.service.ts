import { Injectable, MessageEvent as NestMessageEvent } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'

interface TaskEventPayload {
  taskId: string
  userId?: string
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

  streamForUser(userId: string): Observable<NestMessageEvent> {
    return new Observable<NestMessageEvent>((subscriber) => {
      const subscription = this.events$.subscribe((event) => {
        const payload = event.data as TaskEventPayload

        if (payload.userId === userId) {
          subscriber.next(event)
        }
      })

      return () => subscription.unsubscribe()
    })
  }

  publishTaskEvent(event: string, payload: TaskEventPayload) {
    this.events$.next({
      type: event,
      data: payload
    })
  }
}
