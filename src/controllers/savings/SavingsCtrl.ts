import customParseFormat from 'dayjs/plugin/customParseFormat'
import { QueryParams, Req, Res } from '@tsed/common'
import { Controller } from '@tsed/di'
import { Get } from '@tsed/schema'
import { stringify } from 'csv'
import dayjs from 'dayjs'
import { ObjectId, Sort } from 'mongodb'

import dbo from '../../services/MongoService'
import { Transform, pipeline } from 'stream'
import Decimal from 'decimal.js'
import { promisify } from 'util'

dayjs.extend(customParseFormat)
const asyncPipeline = promisify(pipeline)

export interface INubanAccount {
  id: number
  bank: string
  account_name: string
  account_number: string
}

export interface ISavingsInterest {
  month: Date
  amount: number
}

interface IUser {
  _id: ObjectId
  name: string
}

export interface ISavings {
  _id: string
  user: string | ObjectId | IUser
  interests: ISavingsInterest[]
  nubanAccount: INubanAccount
  autoSavePlanCode: string | null
  autoSaveSuscriptionCode: string | null
  walletBalance: number
  withdrawalDate: Date | null
  totalSavings: number
  createdAt: Date
  updatedAt: Date
}

enum SavingsStatus {
  Active = 'active',
  Inactive = 'inactive'
}

interface ISavingsQuery{
  limit: number
  date_range: string
  user_status: SavingsStatus
  previous_cursor: ObjectId
  next_cursor: ObjectId
}

@Controller('/savings')
export class SavingsCtrl {
  formatQuery (query: ISavingsQuery): {q: any, limit: number, sort: Sort} {
    const [startDate, endDate] = [undefined, null, ''].includes(query.date_range)
      ? []
      : query.date_range.split('|')

    query.limit = !isNaN(query.limit) ? Number(query.limit) : 30
    const sort: Sort = { _id: -1 }

    const q = {
      ...((dayjs(startDate, 'YYYY-MM-DD', true).isValid() && dayjs(endDate, 'YYYY-MM-DD', true).isValid()) && {
        createdAt: {
          $gte: dayjs(startDate).startOf('day').toDate(),
          $lt: dayjs(endDate).endOf('day').toDate()
        }
      })
    }

    return { q, limit: query.limit, sort }
  }

  @Get('/')
  async getSavings (@Req() req: Req, @QueryParams() query: ISavingsQuery): Promise<any> {
    const savingModel = dbo.db().collection('savings')

    const [startDate, endDate] = [undefined, null, ''].includes(query.date_range)
      ? []
      : query.date_range.split('|')

    query.limit = !isNaN(query.limit) ? Number(query.limit) : 30
    const sort: Sort = { _id: -1 }

    const q = {
      ...((dayjs(startDate, 'YYYY-MM-DD', true).isValid() && dayjs(endDate, 'YYYY-MM-DD', true).isValid()) && {
        createdAt: {
          $gte: dayjs(startDate).startOf('day').toDate(),
          $lt: dayjs(endDate).endOf('day').toDate()
        }
      })
    }
    const qryPrev = query.previous_cursor !== undefined && ObjectId.isValid(query.previous_cursor)
    const qryNext = query.next_cursor !== undefined && ObjectId.isValid(query.next_cursor)

    let hasNext: boolean = false
    let hasPrev: boolean = false

    if (qryPrev) {
      Object.assign(q, { _id: { $gt: new ObjectId(query.previous_cursor) } })
      sort._id = 1
    } else if (qryNext) {
      Object.assign(q, { _id: { $lt: new ObjectId(query.next_cursor) } })
    }

    const totalCount = await savingModel.countDocuments(q)
    const r = await savingModel.aggregate<ISavings>([
      { $match: q },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          user: { _id: 1, name: 1 },
          autoSavePlanCode: 1,
          autoSaveSuscriptionCode: 1,
          walletBalance: 1,
          withdrawalDate: 1,
          totalSavings: 1,
          interests: [],
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]).sort(sort).limit(query.limit).toArray()
    if (qryPrev) r.reverse()

    if (r.length > 0) {
      Object.assign(q, { _id: { $lt: new dbo.Id(r[r.length - 1]._id) } })
      hasNext = (await savingModel.countDocuments(q)) > 0

      Object.assign(q, { _id: { $gt: new dbo.Id(r[0]._id) } })
      hasPrev = (await savingModel.countDocuments(q)) > 0
    }

    const payload = r.map(saving => {
      Object.assign(saving, {
        totalSavings: new Decimal(saving.totalSavings).toFixed(2),
        walletBalance: new Decimal(saving.walletBalance).toFixed(2),

        interests: saving.interests.map(interest => {
          return {
            month: interest.month.toISOString(),
            amount: new Decimal(interest.amount).toFixed(2)
          }
        })
      })

      return saving
    })

    return {
      statusCode: 200,
      message: 'successful',
      data: payload,
      pagination: {
        total_users: totalCount,
        ...(hasNext && { next_cursor: r[r.length - 1]._id }),
        ...(hasPrev && { previous_cursor: r[0]._id })
      }
    }
  }

  @Get('/download/export-csv')
  async downloadCSVFile (@Req() req: Req, @Res() res: Res,
    @QueryParams() query: ISavingsQuery): Promise<void> {
    const filePrx = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const { q, sort } = this.formatQuery(query)

    const setHeaders = (): void => {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
              `attachment; filename="savings-${filePrx.replace(/[^A-Za-z0-9]/g, '')}-original.csv"`)
    }

    const csvStringify = stringify({
      header: true,
      columns: [
        { header: 'Name of User', key: 'name' },
        { header: 'Wallet Balance', key: 'walletBalance' },
        { header: 'Total Savings', key: 'totalSavings' },
        { header: 'Interests', key: 'interests' },
        { header: 'Auto Save Plan Code', key: 'autoSavePlanCode' },
        { header: 'Auto Save Suscription', key: 'autoSaveSuscriptionCode' },
        { header: 'Status', key: 'status' }
      ]
    })

    const transformData = (data: ISavings): any => {
      console.log(data)
      const user = data.user as IUser

      return {
        name: user.name,
        walletBalance: new Decimal(data.walletBalance).toFixed(2),
        totalSavings: new Decimal(data.totalSavings).toFixed(2),
        interests: data.interests.map(i => new Decimal(i.amount).toFixed(2)).join(', '),
        autoSavePlanCode: data.autoSavePlanCode,
        autoSaveSuscriptionCode: data.autoSaveSuscriptionCode,
        createdAt: dayjs(data.createdAt).format('YYYY-MM-DD')
      }
    }

    setHeaders()

    const cursor = await dbo.db().collection('savings').aggregate<ISavings>([
      { $match: q },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' }
    ]).sort(sort)

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
