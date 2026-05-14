import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { httpObservabilityMiddleware } from './observability/http-observability.middleware'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.use(httpObservabilityMiddleware)
  app.enableCors({
    origin: true,
    credentials: true
  })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  )
  app.setGlobalPrefix('api')
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000)
}

void bootstrap()
