import { Description, Enum, Name, Optional, Pattern, Required, Summary, Title } from '@tsed/schema'
import { Get, PathParams, QueryParams, Req, Res } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { Transform, pipeline } from 'stream'
import { stringify } from 'csv'
import { promisify } from 'util'
import dayjs from 'dayjs'

import { UserService } from '../../services/user/UserService'
import dbo from '../../services/MongoService'
import { ObjectId } from 'mongodb'
import { BadRequest, NotFound } from '@tsed/exceptions'
import { IResponseDto } from '../../types/interfaces/IResponseDto'

const asyncPipeline = promisify(pipeline)

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

enum Gender {
  FEMALE = 'Female',
  MALE = 'Male',
  UNKNOW = 'Unknown'
}

interface UserList {
  _id: ObjectId
  name: string
  email: string
  phoneNumber: number
  gender: Gender
  verified: boolean
  active: boolean
  isBanned: boolean
  createdAt: Date
}

const months: {[key: string]: number} = {
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

const formatQry = (query: UserQueryParams): any => {
  query.month_joined = query.month_joined ?? ''
  query.year_joined = parseInt(query.month_joined ?? '')
  query.name = decodeURIComponent(query.name ?? '')

  return {
    ...(['active', 'inactive'].includes(query.user_status) && { active: { $exists: true, $eq: query.user_status } }),
    // ...(query.name !== '' && { name: { $regex: /query.name/, $options: 'i' } }),
    ...(query.month_joined !== '' && { createdAt: { $month: dayjs().month(months[query.month_joined]).toDate() } }),
    ...(!isNaN(query.year_joined) && { createdAt: { $year: dayjs().year(query.year_joined).toDate() } })
  }
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

  constructor (
    private readonly userService: UserService,
    @Configuration() readonly config: Configuration) {}

  @Get('/')
  @Summary('fetch all users')
  async fetchAllUsers (@Req() req: Req,
    @Required() @QueryParams() query: UserQueryParams): Promise<any> {
    // validate query params
    query.limit += 0
    query.limit = query.limit > 30 ? 30 : query.limit

    const q = formatQry(query)

    const results = await this.userService.fetchAll(q, {
      limit: query.limit,
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

  @Get('/:user_id')
  @Summary('view a users details')
  async viewUserDetails (@Req() req: Req, @Required() @PathParams('user_id') userId: string): Promise<IResponseDto<any>> {
    if (!ObjectId.isValid(userId)) throw new BadRequest('Invalid user id')

    const user = await dbo.db().collection('users').findOne({ _id: new dbo.Id(userId) })
    if (user === null) throw new NotFound(`User ID: ${userId} not found`)

    delete user.password
    delete user.__v

    return {
      statusCode: 200,
      message: 'successful',
      data: user
    }
  }

  @Get('/download-csv')
  @Summary('download a CSV file of the users')
  async downloadCSVFile (@Req() req: Req, @Res() res: Res,
    @Required() @QueryParams() query: UserQueryParams): Promise<void> {
    const q = formatQry(query)
    const filePrx = dayjs().format('YYYY-MM-DD HH:mm:ss')

    const setHeaders = (): void => {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="gsc-${filePrx.replace(/[^A-Za-z0-9]/g, '')}-original.csv"`)
    }

    const csvStringify = stringify({
      header: true,
      columns: [
        { header: 'User ID', key: 'userId' },
        { header: 'Name of User', key: 'name' },
        { header: 'Email Address', key: 'email' },
        { header: 'Gender', key: 'gender' },
        { header: 'Status', key: 'active' },
        { header: 'Banned Account', key: 'isBanned' },
        { header: 'Date Joined', key: 'createdAt' }
      ]
    })

    const transformData = (data: UserList): any => {
      return {
        userId: data._id.toString(),
        name: data.name,
        email: data.email,
        gender: data.gender,
        active: Object.is(data.active, true) ? 'Active' : 'InActive',
        isBanned: typeof data.isBanned === 'undefined' ? 'False' : data.isBanned,
        createdAt: dayjs(data.createdAt).format('YYYY-MM-DD')
      }
    }

    setHeaders()

    const cursor = await dbo.db().collection('users').find(q)
    await asyncPipeline(cursor.stream(), new Transform({
      writableObjectMode: true,
      readableObjectMode: true,
      transform (chuck, enc, done) {
        const ll = transformData(chuck)

        this.push(ll)
        done()
      }
    }), csvStringify, res)
  }
}
