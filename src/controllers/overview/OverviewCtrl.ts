/**
 * Pending Loan
 * -----
 * Name:
 * Loan Category:
 * Date:
 * - Approve and Decline loan
 *
 * Money Saved
 * Loan Disbursed
 * Website Visits
 *
 * Monetary Transactions
 *
 * OverDue Loans[]
 * - limit 5
 * Full name
 * Loan Amount
 * Refund
 * Due Date
 *
 * Recent Transactions[]
 * -- limit 5
 * Type
 * User ID
 * Name of User
 * Amount
 * Date
 *
 * Audience Demographic (100%)
 * Male
 * Female
 *
 * Audience Age (100%)
 * > 18 years old
 * 20 - 35 years old
 * 36 - 50 years old
 * > 50 years old
 */
import dbMgr from '../../services/MongoService'

import { Get, QueryParams, Req } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { Collection, Document, Sort } from 'mongodb'
import { AnyObject, ILoanRepayment, IResponseDto, months, monthToStr } from '../../types'
import qs from 'query-string'
import dayjs from 'dayjs'
import got from 'got'

interface AudienceAge {
  [key: string]: number
}

interface AudienceDemographic {
  male: number
  female: number
  unknown: number
}

interface IAudienceResponse {
  demograhic: AudienceDemographic
  age_range: AudienceAge[]
}

interface RecentTransactions {
  type: string
  userID: string
  name: string
  amount: number
  date: string
}

interface OverDueLoans {
  full_name: string
  loan_amount: number
  loan_repayment_type: string
  refund: number
  due_date: string
}

interface Analytics {
  money_saved: number
  loan_disbursed: number
  website_visits: number
}

const DefaultLimit: string = '5'

// @Authorize()
@Controller({ path: '/dashboard' })
export class OverviewCtrl {
  user: Collection
  loan: Collection
  savings: Collection
  loanrepayments: Collection

  constructor (@Configuration() readonly config: Configuration) {
    this.user = dbMgr.db().collection('users')
    this.loan = dbMgr.db().collection('loans')
    this.savings = dbMgr.db().collection('savings')
    this.loanrepayments = dbMgr.db().collection('loanrepayments')
  }

  @Get('/analytics')
  async getAnalytics (@Req() req: Req): Promise<Analytics> {
    const savingsPipeline = [
      { $group: { _id: null, totalSaved: { $sum: '$totalSavings' } } }
    ]
    const loanPipeline = [
      { $match: { status: 'active' } },
      { $group: { _id: null, loanDisbursed: { $sum: '$amount' } } }
    ]

    const data: {
      loanDisbursed: number
      moneySaved: number
    } = await new Promise((resolve, reject) => {
      Promise.all([
        this.loan.aggregate(loanPipeline).toArray(),
        this.savings.aggregate(savingsPipeline).toArray()
      ])
        .then(([loan, savings]) => {
          resolve({
            loanDisbursed: loan[0].loanDisbursed,
            moneySaved: savings[0].totalSaved
          })
        })
        .catch(err => reject(err))
    })

    return {
      money_saved: data.moneySaved,
      loan_disbursed: data.loanDisbursed,
      website_visits: 0
    }
  }

  @Get('/monetary-transactions')
  async getMonetaryTransactions (
    @Req() req: Req,
      @QueryParams() query: {from_month: string, to_month: string}): Promise<IResponseDto<any>> {
    const dateRange = {
      createdAt: {
        $gte: dayjs().month(months[query.from_month]).startOf('month').toDate(),
        $lt: dayjs().month(months[query.to_month]).endOf('month').toDate()
      }
    }

    const loanPipe = [
      { $match: { ...dateRange, status: { $eq: 'active' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%m', date: '$createdAt' } },
          loan_disbursed: { $sum: '$amount' }
        }
      }
    ]

    const savingPipe = [
      { $match: { ...dateRange } },
      {
        $group: {
          _id: { $dateToString: { format: '%m', date: '$createdAt' } },
          total_saved: { $sum: '$totalSavings' }
        }
      }
    ]

    interface MonthlyData {
      _id: string
      month: string
      loan_disbursed: number
      total_saved: number
    }

    const data: MonthlyData[] = await new Promise((resolve, reject) => {
      Promise.all([
        this.loan.aggregate(loanPipe).toArray(),
        this.savings.aggregate(savingPipe).toArray()
      ])
        .then(([loans, savings]) => {
          const maxLen = Math.max(loans.length, savings.length)

          const r = new Array(maxLen)
            .fill({})
            .map((items, i) => {
              const loan = loans[i] !== undefined ? loans[i] : { _id: i, loan_disbursed: 0 }
              const saving = savings[i] !== undefined ? savings[i] : { _id: i, total_saved: 0 }

              return Object.assign({}, items, {
                ...loan,
                ...saving
              })
            }).map((data, _) => {
              const j = Object.assign({}, data, {
                month: monthToStr[data._id],
                ...data
              })
              return j
            })

          r.sort((a, b) => a._id - b._id)
          resolve(r)
        })
        .catch(err => reject(err))
    })

    return {
      data,
      statusCode: 200,
      message: 'success'
    }
  }

  /* Audience Demographic (100%)
  * Male
  * Female
  *
  * Audience Age (100%)
  * > 18 years old
  * 20 - 35 years old
  * 36 - 50 years old
  * > 50 years old
  */
  @Get('/audience')
  async getAudience (@Req() req: Req): Promise<IResponseDto<IAudienceResponse>> {
    const audiencePipeline = [
      {
        $group: {
          _id: null,
          total_male: { $sum: { $cond: [{ $eq: ['Male', '$gender'] }, 1, 0] } },
          total_female: { $sum: { $cond: [{ $eq: ['Female', '$gender'] }, 1, 0] } },
          total_unknown: { $sum: { $cond: [{ $eq: ['Unknown', '$gender'] }, 1, 0] } },
          total: { $sum: 1 }
        }
      },
      { // $round: [ "$value", 1 ]
        $project: {
          _id: 0,
          male: { $round: [{ $multiply: [{ $divide: ['$total_male', '$total'] }, 100] }, 1] },
          female: { $round: [{ $multiply: [{ $divide: ['$total_female', '$total'] }, 100] }, 1] },
          unknown: { $round: [{ $multiply: [{ $divide: ['$total_unknown', '$total'] }, 100] }, 1] }
        }
      }
    ]

    const agePipeline = [
      {
        $addFields: {
          age: { $dateDiff: { startDate: '$dateOfBirth', endDate: '$$NOW', unit: 'year' } }
        }
      },
      {
        $group: {
          _id: {
            $concat: [
              { $cond: [{ $lte: ['$age', 0] }, 'unknown age', ''] },
              { $cond: [{ $and: [{ $gt: ['$age', 0] }, { $lt: ['$age', 20] }] }, 'above 18 years old', ''] },
              { $cond: [{ $and: [{ $gte: ['$age', 20] }, { $lt: ['$age', 36] }] }, '20 - 35 years old', ''] },
              { $cond: [{ $and: [{ $gte: ['$age', 36] }, { $lt: ['$age', 50] }] }, '36 - 50 years old', ''] },
              { $cond: [{ $and: [{ $gte: ['$age', 50] }] }, 'above 50 years old', ''] }
            ]
          },
          total: { $sum: 1 }
        }
      }
    ]

    const result: IAudienceResponse = await new Promise((resolve, reject) => {
      Promise.all([
        this.user.aggregate(agePipeline).toArray(),
        this.user.aggregate(audiencePipeline).toArray()
      ])
        .then(([age, audience]) => {
          resolve({
            demograhic: {
              male: audience[0].male,
              female: audience[0].female,
              unknown: audience[0].unknown
            },
            age_range: age.map((age, i) => ({ age: age._id, count: age.total }))
              .sort((a, b) => a.count - b.count)
          })
        })
        .catch(err => reject(err))
    })

    return {
      data: result,
      statusCode: 200,
      message: 'success'
    }
  }

  // * Recent Transactions[]
  // * -- limit 5
  // * Type
  // * User ID
  // * Name of User
  // * Amount
  // * Date
  @Get('/recent-transactions')
  async getRecentTransactions (@Req() req: Req, @QueryParams() limit: string): Promise<IResponseDto<RecentTransactions[]>> {
    const configKey = this.config.get<AnyObject>('configKeys')
    const BASE_URL = 'https://api.paystack.co/'

    const client = got.extend({
      prefixUrl: BASE_URL,
      headers: {
        Authorization: `Bearer ${configKey.PAYSTACK_SECRET_KEY as string}`
      }
    })

    const tranxQry = qs.stringify({ page: 1, perPage: 5 })
    const trnx = await client.get(`transaction?${tranxQry}`).json() as any

    const transactions: RecentTransactions[] = []

    for (const trn of trnx.data) {
      const customer: {[key: string]: string} = trn.customer

      transactions.push({
        userID: customer.id, // this should be retrieved from transaction meta-data
        name: `${customer.first_name} ${customer.last_name}`,
        amount: trn.amount,
        type: ['Loan', 'Savings'][Math.floor(Math.random() * 2)], // this should be retrieved from transaction meta-data
        date: trn.created_at
      })
    }

    return {
      data: transactions,
      statusCode: 200,
      message: 'Transactions retrieved'
    }
  }

  //   * OverDue Loans[]
  //   * - limit 5
  //   * Full name
  //   * Loan Amount
  //   * Refund
  //   * Due Date
  //   *
  @Get('/overdue-loans')
  async getOverDueLoans (@Req() req: Req, @QueryParams() limit: string = DefaultLimit): Promise<IResponseDto<OverDueLoans[]>> {
    const sort: Sort = { createdAt: -1 }

    const overduePipe: Document[] | undefined = [
      {
        $lookup: {
          from: 'loans',
          localField: 'loanId',
          foreignField: '_id',
          pipeline: [
            { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
            { $replaceRoot: { newRoot: { $mergeObjects: [{ $arrayElemAt: ['$user', 0] }, '$$ROOT'] } } },
            { $project: { user: 0 } }
          ],
          as: 'loan'
        }
      },
      { $unwind: { path: '$loans', preserveNullAndEmptyArrays: true } }
    ]

    const repayment = await this.loanrepayments.aggregate<ILoanRepayment[]>(overduePipe).sort(sort).limit(5).toArray() as any[]
    const overDueLoans: OverDueLoans[] = []

    for (const repay of repayment) {
      overDueLoans.push({
        full_name: `${repay.loan[0].name as string}`,
        loan_repayment_type: repay.type,
        loan_amount: repay.total,
        refund: repay.repaid,
        due_date: repay.date
      })
    }

    return {
      data: overDueLoans,
      statusCode: 200,
      message: 'Overdue loans retrieved'
    }
  }
}
