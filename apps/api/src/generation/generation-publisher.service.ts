import { Injectable } from '@nestjs/common'
import type { GenerationRequestMessage } from '@aigc/shared-contracts'
import { RabbitmqService } from '../rabbitmq/rabbitmq.service'

@Injectable()
export class GenerationPublisherService {
  constructor(private readonly rabbitmqService: RabbitmqService) {}

  publishGenerationRequest(message: GenerationRequestMessage) {
    return this.rabbitmqService.publishGenerationRequest(message)
  }
}
