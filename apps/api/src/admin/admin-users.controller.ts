import { Body, Controller, Get, Param, Patch } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthenticatedUser } from '../auth/auth.types'
import { AdminUsersService } from './admin-users.service'
import { UpdateUserRoleDto } from './dto/update-user-role.dto'
import { UpdateUserStatusDto } from './dto/update-user-status.dto'

@Controller('admin/users')
@Roles('admin', 'super_admin')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  listUsers() {
    return this.adminUsersService.listUsers()
  }

  @Patch(':userId/status')
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto
  ) {
    return this.adminUsersService.updateStatus(actor, userId, dto.status)
  }

  @Patch(':userId/role')
  @Roles('super_admin')
  updateRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserRoleDto
  ) {
    return this.adminUsersService.updateRole(actor, userId, dto.role)
  }
}
