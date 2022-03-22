import { Delete, Name, Required } from '@tsed/schema'
import { Get, PathParams, QueryParams, Req, Res } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { Transform, pipeline } from 'stream'
import { Authorize } from '@tsed/passport'
import { ObjectId, Sort } from 'mongodb'
import { stringify } from 'csv'
import { promisify } from 'util'
import dayjs from 'dayjs'

import { UserService } from '../../services/user/UserService'
import { IResponseDto } from '../../types/interfaces/IResponseDto'
import { BadRequest, NotFound } from '@tsed/exceptions'
import dbo from '../../services/MongoService'

const asyncPipeline = promisify(pipeline)

export interface UserQueryParams {
  name?: string
  limit: number
  user_status: string
  year_join?: number
  month_join?: string
  previous_cursor?: string
  next_cursor?: string
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

const months: { [key: string]: number } = {
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
  query.month_join = query.month_join ?? ''
  query.year_join = parseInt(query.month_join ?? '')
  query.name = decodeURIComponent(query.name ?? '')

  return {
    // isDeleted: { $exists: false },
    // ...(query.name !== '' && { name: { $regex: /query.name/, $options: 'i' } }),
    ...(['active', 'inactive'].includes(query.user_status) && { active: { $exists: true, $eq: query.user_status } }),
    ...(query.month_join !== '' && { createdAt: { $month: dayjs().month(months[query.month_join]).toDate() } }),
    ...(!isNaN(query.year_join) && { createdAt: { $year: dayjs().year(query.year_join).toDate() } })

  }
}

@Authorize()
@Controller({ path: '/user' })
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
    @Configuration() readonly config: Configuration) { }

  @Get('/')
  async fetchAllUsers (@Req() req: Req,
    @Required() @QueryParams() query: UserQueryParams): Promise<any> {
    const q = formatQry(query)

    const sort: Sort = { _id: -1, createdAt: 1 }
    const limit = +query.limit > 30 ? 30 : +query.limit
    const qryPrev = query.previous_cursor !== undefined && ObjectId.isValid(query.previous_cursor)
    const qryNext = query.next_cursor !== undefined && ObjectId.isValid(query.next_cursor)

    let hasNext: boolean = false
    let hasPrev: boolean = false

    if (qryPrev) {
      q._id = { $gt: new dbo.Id(query.previous_cursor) }
      sort._id = 1
    } else if (qryNext) {
      q._id = { $lt: new dbo.Id(query.next_cursor) }
    }

    const r = await dbo.db().collection('users').find(q, { sort, limit }).toArray()

    if (qryPrev) r.reverse()

    if (r.length > 0) {
      q._id = { $lt: new dbo.Id(r[r.length - 1]._id) }
      let check = await dbo.db().collection('users').findOne(q)
      hasNext = check !== null

      q._id = { $gt: new dbo.Id(r[0]._id) }
      check = await dbo.db().collection('users').findOne(q)
      hasPrev = check !== null
    }

    console.log(r.length, query, q)

    const data = r.map(l => {
      return {
        _id: l._id,
        name: l.name,
        email: l.email,
        active: l.active,
        profileImageUrl: l.profileImageUrl,
        is_banned: l.isBanned,
        is_deleted: l.isDeleted,
        createdAt: l.createdAt
      }
    })

    return {
      statusCode: 200,
      message: 'successful',
      data,
      ...(hasNext && { next_cursor: r[r.length - 1]._id }),
      ...(hasPrev && { previous_cursor: r[0]._id })
    }
  }

  @Get('/:user_id')
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

  @Delete('/:user_id')
  async deleteUser (@Req() req: Req, @Required() @PathParams('user_id') userId: string): Promise<IResponseDto<any>> {
    if (!ObjectId.isValid(userId)) throw new BadRequest('Invalid user id')
    const ERR_MSG = 'Error occur while updating user, kindly confirm user ID and try again'

    const result = await dbo.db().collection('users').findOneAndUpdate(
      { _id: new dbo.Id(userId) },
      { $set: { isDeleted: true } },
      { returnDocument: 'after' }
    )

    if (result.ok !== 1) throw new BadRequest(ERR_MSG)
    if ((result.lastErrorObject != null) &&
      'updatedExisting' in result.lastErrorObject &&
      result.lastErrorObject.updatedExisting !== true) {
      throw new BadRequest(ERR_MSG)
    }

    return {
      statusCode: 200,
      message: 'successful',
      data: result.value
    }
  }

  @Get('/download/export-csv')
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
