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
import { months, UserList, UserQueryParams } from '../../types'

const asyncPipeline = promisify(pipeline)

const formatQry = (query: UserQueryParams): any => {
  query.month_join = query.month_join ?? ''
  query.name = decodeURIComponent(query.name ?? '')
  query.month_join = query.month_join.toLowerCase()

  const userStatus = query.user_status === 'active' ?? false
  const monthJoined = months[query.month_join] >= 0 ?? false
  const yearJoined = typeof query.year_join !== 'undefined' && query.year_join !== ''

  const response = {
    ...(query.name !== '' && { name: { $regex: query.name, $options: 'i' } }),
    ...(['active', 'inactive'].includes(query.user_status) && { active: { $exists: true, $eq: userStatus } })
  }

  const qryByDate = {
    $gte: dayjs(),
    $lt: dayjs()
  }

  if (monthJoined) {
    Object.assign(qryByDate, {
      $gte: qryByDate.$gte.month(months[query.month_join]).startOf('month'),
      $lt: qryByDate.$lt.month(months[query.month_join]).endOf('month')
    })
  }

  if (yearJoined && typeof query.year_join !== 'undefined') {
    const gte = qryByDate.$gte.year(parseInt(query.year_join))
    const lt = qryByDate.$lt.year(parseInt(query.year_join))

    Object.assign(qryByDate, {
      $gte: monthJoined ? gte : gte.startOf('year'),
      $lt: monthJoined ? lt : lt.endOf('year')
    })
  }

  if (monthJoined || yearJoined) {
    Object.assign(response, {
      createdAt: {
        $gte: qryByDate.$gte.toDate(),
        $lt: qryByDate.$lt.toDate()
      }
    })
  }

  return response
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
    const userModel = dbo.db().collection('users')
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

    // console.log(q, sort, limit)
    const totalUsers = await userModel.countDocuments()
    const r = await userModel.find(q, { sort, limit }).toArray()

    if (qryPrev) r.reverse()

    if (r.length > 0) {
      q._id = { $lt: new dbo.Id(r[r.length - 1]._id) }
      let check = await userModel.findOne(q)
      hasNext = check !== null

      q._id = { $gt: new dbo.Id(r[0]._id) }
      check = await userModel.findOne(q)
      hasPrev = check !== null
    }

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
      pagination: {
        total_users: totalUsers,
        ...(hasNext && { next_cursor: r[r.length - 1]._id }),
        ...(hasPrev && { previous_cursor: r[0]._id })
      }
    }
  }

  @Get('/:user_id')
  async viewUserDetails (@Req() req: Req, @Required() @PathParams('user_id') userId: string): Promise<IResponseDto<any>> {
    if (!ObjectId.isValid(userId)) throw new BadRequest('Invalid user id')

    const findQuery = { $match: { _id: { $eq: new ObjectId(userId) } } }

    const user = await dbo.db().collection('users').aggregate([
      findQuery,
      {
        $lookup: {
          from: 'nextofkins',
          localField: 'nextOfKin',
          foreignField: '_id',
          as: 'next_of_kin'
        }
      },
      {
        $lookup: {
          from: 'kycprofiles',
          localField: '_id',
          foreignField: 'user',
          as: 'kyc'
        }
      },
      {
        $lookup: {
          from: 'cards',
          localField: '_id',
          foreignField: 'user',
          as: 'cards'
        }
      },
      {
        $lookup: {
          from: 'accounts',
          localField: '_id',
          foreignField: 'user',
          as: 'accounts'
        }
      },
      { $unwind: { path: '$next_of_kin', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$kyc', preserveNullAndEmptyArrays: true } }
    ]).toArray()

    if (user.length === 0) throw new NotFound(`User ID: ${userId} not found`)

    return {
      statusCode: 200,
      message: 'successful',
      data: user[0]
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
        `attachment; filename="user-${filePrx.replace(/[^A-Za-z0-9]/g, '')}-original.csv"`)
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
