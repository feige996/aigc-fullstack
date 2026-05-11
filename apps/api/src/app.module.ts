import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AdminModule } from './admin/admin.module'
import { AssetsModule } from './assets/assets.module'
import { AuthModule } from './auth/auth.module'
import { GenerationModule } from './generation/generation.module'
import { HealthController } from './health.controller'
import { ProjectsModule } from './projects/projects.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
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
