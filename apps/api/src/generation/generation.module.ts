import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { GenerationController } from './generation.controller'
import { GenerationService } from './generation.service'

@Module({
  imports: [PrismaModule],
  controllers: [GenerationController],
  providers: [GenerationService]
})
export class GenerationModule {}
