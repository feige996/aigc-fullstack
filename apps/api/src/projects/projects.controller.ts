import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthenticatedUser } from '../auth/auth.types'
import { CreateProjectDto } from './dto/create-project.dto'
import { ProjectsService } from './projects.service'

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  createProject(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.createProject(user, dto)
  }

  @Get()
  listProjects(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.listProjects(user)
  }

  @Get(':projectId')
  getProject(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string) {
    return this.projectsService.getProject(user, projectId)
  }
}
