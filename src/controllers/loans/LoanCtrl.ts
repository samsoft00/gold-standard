import { BodyParams, Get, PathParams, Put, QueryParams } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { BadRequest } from '@tsed/exceptions'
import { Authorize } from '@tsed/passport'
import dayjs from 'dayjs'
import Decimal from 'decimal.js'
import { Collection, ObjectId, Sort } from 'mongodb'

import dbMgr from '../../services/MongoService'
import { ILoanSortBy, ILoanTypes, ILoan, months } from '../../types'
import { IResponseDto } from '../../types/interfaces/IResponseDto'
import { PaginateResponse } from '../../types/interfaces/PaginateResponse'

const formatLoanQuery = (query: ILoanSortBy): any => {
  query.month_joined = query.month_joined?.toLowerCase() ?? ''

  const isMonthJoined = months[query.month_joined] >= 0 ?? false

  return {
    ...(isMonthJoined && {
      createdAt: {
        $gte: dayjs().month(months[query.month_joined]).startOf('month'),
        $lt: dayjs().month(months[query.month_joined]).endOf('month')
      }
    }),
    ...(query.amount !== undefined && { amount: { $gte: new Decimal(query.amount).toNumber() } }),
    ...(query.loan_status !== undefined && { status: { $eq: query.loan_status } })
  }
}

@Authorize()
@Controller({ path: '/loan' })
export class LoanCtrl {
  Loan: Collection<ILoan>
  LoanPackages: Collection<ILoanTypes>

  /**
     * 1. Get all loans
     * 2. Get loan by id
     * 3. Get loan types
     */
  constructor (@Configuration() readonly config: Configuration) {
    this.Loan = dbMgr.db().collection<ILoan>('loans')
    this.LoanPackages = dbMgr.db().collection<ILoanTypes>('loanpackages')
  }

  @Get('/')
  async getAllLoans (@QueryParams() query: ILoanSortBy): Promise<any> {
    const q = formatLoanQuery(query)

    const sort: Sort = { _id: -1, createdAt: 1 }
    const limit = +query.limit > 30 ? 30 : +query.limit
    const qryPrev = query.previous_cursor !== undefined && ObjectId.isValid(query.previous_cursor)
    const qryNext = query.next_cursor !== undefined && ObjectId.isValid(query.next_cursor)

    let hasNext: boolean = false
    let hasPrev: boolean = false

    if (qryPrev) {
      q._id = { $gt: new dbMgr.Id(query.previous_cursor) }
      sort._id = 1
    } else if (qryNext) {
      q._id = { $lt: new dbMgr.Id(query.next_cursor) }
    }

    const loanPipe = [
      { $match: q },
      {
        $lookup: {
          from: 'loanpackages',
          localField: 'loanPackage',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1, title: 1 } }],
          as: 'package'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1, name: 1, profileImageUrl: 1 } }],
          as: 'user'
        }
      },
      { $unwind: { path: '$package', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
    ]

    const { loanList, count } = await new Promise<{loanList: any[], count: number}>((resolve, reject) => {
      Promise.all([
        this.Loan.aggregate(loanPipe).limit(limit).sort(sort).toArray(),
        this.Loan.countDocuments(q, {})
      ])
        .then(([loanList, count]) => resolve({ loanList, count }))
        .catch(reject)
    })

    if (qryPrev) loanList.reverse()

    if (loanList.length > 0) {
      q._id = { $lt: new dbMgr.Id(loanList[loanList.length - 1]._id) }
      let check = await this.Loan.findOne(q)
      hasNext = check !== null

      q._id = { $gt: new dbMgr.Id(loanList[0]._id) }
      check = await this.Loan.findOne(q)
      hasPrev = check !== null
    }
    // console.log(loanList, totalLoan)
    return new PaginateResponse(loanList, count, hasNext, hasPrev)
  }

  @Get('/loan-types')
  async getLoanTypes (): Promise<IResponseDto<ILoanTypes[]>> {
    const loanTypes = await this.LoanPackages.find().toArray()

    return {
      statusCode: 200,
      message: 'Success',
      data: loanTypes
    }
  }

  @Get('/:loanId')
  async getLoanById (@PathParams('loanId') loanId: string): Promise<IResponseDto<any>> {
    const loan = await this.Loan.aggregate([
      { $match: { _id: new dbMgr.Id(loanId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1, name: 1, profileImageUrl: 1 } }],
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'loanpackages',
          localField: 'loanPackage',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1, title: 1 } }],
          as: 'package'
        }
      },
      {
        $lookup: {
          from: 'loanrepayments',
          localField: '_id',
          foreignField: 'loanId',
          as: 'repayments'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$package', preserveNullAndEmptyArrays: true } }
    ]).toArray()

    return {
      statusCode: 200,
      message: 'Success',
      data: loan[0]
    }
  }

  @Get('/:userId/user')
  async getLoansByUserId (@PathParams('userId') userId: string): Promise<IResponseDto<any>> {
    const loans = await this.Loan.aggregate([
      { $match: { userId: new dbMgr.Id(userId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1, name: 1, profileImageUrl: 1 } }],
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'loanpackages',
          localField: 'loanPackage',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 1, title: 1 } }],
          as: 'package'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$package', preserveNullAndEmptyArrays: true } }
    ]).toArray()

    return {
      statusCode: 200,
      message: 'Success',
      data: loans
    }
  }

  // Accept || Decline loan
  @Put('/update-loan/:loanId')
  async UpdateLoanStatus (
    @BodyParams() body: any,
      @PathParams('loanId') loanID: string): Promise<IResponseDto<any>> {
    if (!dbMgr.Id.isValid(loanID)) throw new BadRequest('Invalid loan ID')

    if (!['active', 'inactive', 'declined'].includes(body.status)) throw new BadRequest('Invalid loan status')

    await this.Loan.findOneAndUpdate(
      { _id: new dbMgr.Id(loanID) },
      { $set: { status: body.status } })

    return {
      statusCode: 200,
      message: 'Success',
      data: {}
    }
  }
}
