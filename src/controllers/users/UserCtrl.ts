import { Get, Req } from '@tsed/common'
import { Name, Summary } from '@tsed/schema'
import { Configuration, Controller } from '@tsed/di'
import { UserService } from '../../services/user/UserService'

@Controller({ path: '/users' })
@Name('Users')
export class UserCtrl {
  /**
     * Search user by
     * Manage users
     * Delete user
     * View a user
     */

  constructor (
    private readonly userService: UserService,
    @Configuration() readonly config: Configuration) {}

  @Get('/')
  @Summary('fetch all users')
  async fetchAllUsers (@Req() req: Req): Promise<void> {}
}
