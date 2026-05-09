import { Body, Controller, Post } from '@nestjs/common'
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
}
