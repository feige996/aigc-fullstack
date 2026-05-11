import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { GenerationModule } from './generation/generation.module'
import { HealthController } from './health.controller'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AuthModule,
    GenerationModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
