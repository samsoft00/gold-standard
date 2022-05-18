import { Get, QueryParams } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { Authorize } from '@tsed/passport'
import dayjs from 'dayjs'
import Decimal from 'decimal.js'
import { Collection, Document, ObjectId, Sort } from 'mongodb'

import dbMgr from '../../services/MongoService'
import { IResponseDto } from '../../types/interfaces/IResponseDto'
import { PaginateResponse } from '../../types/interfaces/PaginateResponse'
import { months } from '../users/UserCtrl'

enum LoanStatus {
  Active = 'active',
  Inactive = 'inactive',
  Declined = 'declined',
}

interface ShelterLoanInfo{}

interface ScholarLoanInfo{}

interface ILoan extends Document{
  _id: string
  userId: string | ObjectId
  status: LoanStatus
  loanPackage: string | ObjectId
  amount: number
  reason: string
  additionalInfo: ShelterLoanInfo | ScholarLoanInfo | null
}

interface ILoanTypes extends Document {
  _id: ObjectId
  title: string
}

interface ILoanSortBy {
  limit: number
  amount?: number
  loan_status: string
  month_joined?: string
  loanType?: ObjectId
  previous_cursor?: string
  next_cursor?: string
}

const formatLoanQuery = (query: ILoanSortBy): any => {
  query.month_joined = query.month_joined?.toLowerCase() ?? ''

  const amount = new Decimal(query.amount ?? '-')
  const isMonthJoined = months[query.month_joined] >= 0 ?? false

  return {
    ...(isMonthJoined && {
      createdAt: {
        $gte: dayjs().month(months[query.month_joined]).startOf('month'),
        $lt: dayjs().month(months[query.month_joined]).endOf('month')
      }
    }),
    ...(!amount.isNaN() && { amount: { $gte: amount.toFixed(2) } }),
    ...(query.loan_status in LoanStatus && { status: query.loan_status })
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

    const totalLoan = await this.Loan.countDocuments()

    const loanList = await this.Loan.aggregate([
      { $match: q, limit, sort },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } }
    ]).toArray()

    if (qryPrev) loanList.reverse()

    if (loanList.length > 0) {
      q._id = { $lt: new dbMgr.Id(loanList[loanList.length - 1]._id) }
      let check = await this.Loan.findOne(q)
      hasNext = check !== null

      q._id = { $gt: new dbMgr.Id(loanList[0]._id) }
      check = await this.Loan.findOne(q)
      hasPrev = check !== null
    }

    return new PaginateResponse(loanList, totalLoan, hasNext, hasPrev)
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
}
