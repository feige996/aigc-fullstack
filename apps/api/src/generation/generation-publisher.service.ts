import { Injectable } from '@nestjs/common'
import type { TaskRequestMessage } from '@aigc/shared-contracts'
import { RabbitmqService } from '../rabbitmq/rabbitmq.service'

@Injectable()
export class GenerationPublisherService {
  constructor(private readonly rabbitmqService: RabbitmqService) {}

  publishGenerationRequest(message: TaskRequestMessage) {
    return this.rabbitmqService.publishGenerationRequest(message)
  }
}
