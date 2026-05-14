import { Controller, Get } from '@nestjs/common'
import { Public } from './auth/public.decorator'

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      service: 'api',
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        http: 'ready'
      }
    }
  }
}
