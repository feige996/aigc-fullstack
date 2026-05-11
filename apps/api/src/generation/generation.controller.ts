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

  @Get(':taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.generationService.getTask({
      userId: 'mock_user_001',
      taskId
    })
  }
}
