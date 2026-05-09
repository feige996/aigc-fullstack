import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module'
import { GenerationController } from './generation.controller'
import { GenerationPublisherService } from './generation-publisher.service'
import { GenerationResultConsumerService } from './generation-result-consumer.service'
import { GenerationService } from './generation.service'

@Module({
  imports: [PrismaModule, RabbitmqModule],
  controllers: [GenerationController],
  providers: [GenerationService, GenerationPublisherService, GenerationResultConsumerService]
})
export class GenerationModule {}
