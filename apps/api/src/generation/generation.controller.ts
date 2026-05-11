import { Body, Controller, Get, MessageEvent as NestMessageEvent, Param, Post, Sse } from '@nestjs/common'
import { Observable } from 'rxjs'
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
  createTask(@Body() dto: CreateGenerationTaskDto) {
    return this.generationService.createTask({
      userId: 'mock_user_001',
      dto
    })
  }

  @Get()
  listTasks() {
    return this.generationService.listTasks({
      userId: 'mock_user_001'
    })
  }

  @Sse('events')
  streamEvents(): Observable<NestMessageEvent> {
    return this.generationEventsService.stream()
  }

  @Get(':taskId/attempts/:attemptId/execution-state')
  getExecutionState(@Param('taskId') taskId: string, @Param('attemptId') attemptId: string) {
    return this.generationService.getExecutionState({
      taskId,
      attemptId
    })
  }

  @Get(':taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.generationService.getTask({
      userId: 'mock_user_001',
      taskId
    })
  }

  @Post(':taskId/retry')
  retryTask(@Param('taskId') taskId: string) {
    return this.generationService.retryTask({
      userId: 'mock_user_001',
      taskId
    })
  }

  @Post(':taskId/cancel')
  cancelTask(@Param('taskId') taskId: string) {
    return this.generationService.cancelTask({
      userId: 'mock_user_001',
      taskId
    })
  }
}
