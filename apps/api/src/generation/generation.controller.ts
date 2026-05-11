import { Body, Controller, Get, MessageEvent as NestMessageEvent, Param, Post, Sse } from '@nestjs/common'
import { Observable } from 'rxjs'
import { CurrentUser } from '../auth/current-user.decorator'
import { Public } from '../auth/public.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthenticatedUser } from '../auth/auth.types'
import { CreateGenerationTaskDto } from './dto/create-generation-task.dto'
import { GenerationEventsService } from './generation-events.service'
import { GenerationService } from './generation.service'

@Controller('generation/tasks')
export class GenerationController {
  constructor(
    private readonly generationService: GenerationService,
    private readonly generationEventsService: GenerationEventsService
  ) {}

  @Post()
  createTask(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGenerationTaskDto) {
    return this.generationService.createTask({
      userId: user.id,
      dto
    })
  }

  @Get()
  listTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.generationService.listTasks({
      user
    })
  }

  @Get('admin')
  @Roles('admin', 'super_admin')
  listAdminTasks() {
    return this.generationService.listAdminTasks()
  }

  @Sse('events')
  streamEvents(@CurrentUser() user: AuthenticatedUser): Observable<NestMessageEvent> {
    return this.generationEventsService.streamForUser(user.id)
  }

  @Public()
  @Get(':taskId/attempts/:attemptId/execution-state')
  getExecutionState(@Param('taskId') taskId: string, @Param('attemptId') attemptId: string) {
    return this.generationService.getExecutionState({
      taskId,
      attemptId
    })
  }

  @Get(':taskId')
  getTask(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string) {
    return this.generationService.getTask({
      user,
      taskId
    })
  }

  @Post(':taskId/retry')
  retryTask(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string) {
    return this.generationService.retryTask({
      user,
      taskId
    })
  }

  @Post(':taskId/cancel')
  cancelTask(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string) {
    return this.generationService.cancelTask({
      user,
      taskId
    })
  }
}
