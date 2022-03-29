import { Authorize } from '@tsed/passport'
import { Get, QueryParams, Req } from '@tsed/common'
import { Controller } from '@tsed/di'

import dbo from '../../services/MongoService'
import dayjs from 'dayjs'
import { ObjectId, Sort } from 'mongodb'
import Decimal from 'decimal.js'

enum RangeType {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
}

interface TranzQueryParams {
  name?: string
  limit: number
  range?: RangeType
  previous_cursor?: ObjectId
  next_cursor?: ObjectId
}

export enum TransactionType {
  Deposit = 'deposit',
  Withdraw = 'withdraw',
}

export interface ITransaction {
  _id: ObjectId
  user: string | ObjectId
  type: TransactionType
  amount: number
  breakingFee: number
  currency: string
  descriptionType: string
  date: Date
}

@Authorize()
@Controller({ path: '/transaction' })
export class TransctionCtrl {
  /**
     *  1. Fetch all transactions
     *  - name
     *  - user_id
     *  - amount
     *  - date
     *  - status
     */

  @Get('/')
  async fetchAllTransactions (@Req() req: Req, @QueryParams() query: TranzQueryParams): Promise<any> {
    const { name, range } = query

    const q = {
      ...(typeof name !== 'undefined' && { name: { $regex: `.*${name}.*`, $options: 'i' } }),
      ...(range === RangeType.Daily && {
        date: {
          $gte: dayjs().startOf('day').toDate(),
          $lt: dayjs().endOf('day').toDate()
        }
      }),
      ...(range === RangeType.Weekly && {
        date: {
          $gte: dayjs().startOf('week').toDate(),
          $lt: dayjs().endOf('week').toDate()
        }
      }),
      ...(range === RangeType.Monthly && {
        date: {
          $gte: dayjs().startOf('month').toDate(),
          $lt: dayjs().endOf('month').toDate()
        }
      })
    }

    const sort: Sort = { _id: -1, createdAt: 1 }
    const limit = isNaN(query.limit) ? 30 : +query.limit
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

    const totalCount = await dbo.db().collection('transactions').countDocuments(q)
    const r = await dbo.db().collection('transactions').aggregate<ITransaction>([
      { $match: q },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          user: { _id: 1, name: 1 },
          type: 1,
          descriptionType: 1,
          amount: 1,
          breakingFee: 1,
          currency: 1,
          date: 1
        }
      }
    ]).sort(sort).limit(limit).toArray()

    if (qryPrev) r.reverse()

    if (r.length > 0) {
      Object.assign(q, { _id: { $lt: new dbo.Id(r[r.length - 1]._id) } })
      hasNext = (await dbo.db().collection('transactions').countDocuments(q)) > 0

      Object.assign(q, { _id: { $gt: new dbo.Id(r[0]._id) } })
      hasPrev = (await dbo.db().collection('transactions').countDocuments(q)) > 0
    }

    const data = r.map((d: ITransaction) => {
      return {
        _id: d._id,
        user: d.user,
        type: d.type,
        amount: new Decimal(d.amount).toFixed(2),
        breakingFee: new Decimal(d.breakingFee).toFixed(2),
        currency: d.currency,
        descriptionType: d.descriptionType,
        date: d.date
      }
    })

    return {
      statusCode: 200,
      message: 'successful',
      data,
      pagination: {
        total_users: totalCount,
        ...(hasNext && { next_cursor: r[r.length - 1]._id }),
        ...(hasPrev && { previous_cursor: r[0]._id })
      }
    }
  }
}
