import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CreateGenerationTaskDto } from './dto/create-generation-task.dto'
import { GenerationService } from './generation.service'

@Controller('generation/tasks')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

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

  @Get(':taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.generationService.getTask({
      userId: 'mock_user_001',
      taskId
    })
  }
}
