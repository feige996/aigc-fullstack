import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GenerationModule } from './generation/generation.module'
import { HealthController } from './health.controller'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    GenerationModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
