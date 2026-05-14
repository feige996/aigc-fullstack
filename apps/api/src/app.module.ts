import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { join } from 'node:path'
import { AdminModule } from './admin/admin.module'
import { AssetsModule } from './assets/assets.module'
import { AuthModule } from './auth/auth.module'
import { validateEnv } from './config/env.validation'
import { GenerationModule } from './generation/generation.module'
import { HealthController } from './health.controller'
import { ProjectsModule } from './projects/projects.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', join(process.cwd(), '../../.env')],
      validate: validateEnv
    }),
    AdminModule,
    AssetsModule,
    AuthModule,
    GenerationModule,
    ProjectsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
