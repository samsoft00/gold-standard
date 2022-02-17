import { Description, Enum, Name, Optional, Pattern, Required, Summary, Title } from '@tsed/schema'
import { Get, QueryParams, Req } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import dayjs from 'dayjs'

import { UserService } from '../../services/user/UserService'

export class UserQueryParams {
  @Optional()
  @Description('Search user by name')
  name?: string

  @Required()
  @Description('Total number of expected records')
  limit: number = 10

  @Enum('active', 'inactive')
  @Description('Current user status')
  user_status: string

  @Pattern(/^d{4}/)
  @Description('Year joined, e.g 2022')
  year_joined?: number

  @Title('Month joined')
  @Description('month joined, e.g Febuary')
  month_joined?: string
}

@Controller({ path: '/users' })
@Name('Users')
export class UserCtrl {
  /**
     * Search user by
     * Manage users
     * Delete user
     * View a user
     */
  months: {[key: string]: number} = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
  }

  constructor (
    private readonly userService: UserService,
    @Configuration() readonly config: Configuration) {}

  @Get('/')
  @Summary('fetch all users')
  async fetchAllUsers (@Req() req: Req,
    @Required() @QueryParams() query: UserQueryParams): Promise<any> {
    // validate query params
    query.limit += 0
    const limit = query.limit > 30 ? 30 : query.limit

    query.month_joined = query.month_joined ?? ''
    query.year_joined = parseInt(query.month_joined ?? '')
    query.name = decodeURIComponent(query.name ?? '')

    const q = {
      ...(['active', 'inactive'].includes(query.user_status) && { active: { $exists: true, $eq: query.user_status } }),
      // ...(query.name !== '' && { name: { $regex: /query.name/, $options: 'i' } }),
      ...(query.month_joined !== '' && { createdAt: { $month: dayjs().month(this.months[query.month_joined]).toDate() } }),
      ...(!isNaN(query.year_joined) && { createdAt: { $year: dayjs().year(query.year_joined).toDate() } })
    }

    const results = await this.userService.fetchAll(q, {
      limit,
      sort: {
        _id: 1,
        createdAt: 1
      },
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        active: 1,
        profileImageUrl: 1,
        // Ban Account
        // Delete
        createdAt: 1
      }
    })

    return {
      statusCode: 200,
      message: 'successful',
      data: results
    }
  }
}
