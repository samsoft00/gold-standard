import { Authorize } from '@tsed/passport'
import { Get, QueryParams, Req } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import qs from 'query-string'
import got from 'got'
import { AnyObject } from '../../types'

enum TransactionStatus {
  FAILED = 'failed',
  SUCCESS = 'success',
  ABANDONED = 'abandond',
}

interface TranzQueryParams {
  perPage?: number
  page?: number
  customer?: number
  status: TransactionStatus
  from: number
  to: number
  amount: number
}

@Authorize()
@Controller({ path: '/transaction' })
export class TransctionCtrl {
  /**
   * Transaction List
   */
  constructor (@Configuration() readonly config: Configuration) {}

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
    const configKey = this.config.get<AnyObject>('configKeys')
    const BASE_URL = 'https://api.paystack.co/'

    const client = got.extend({
      prefixUrl: BASE_URL,
      headers: {
        Authorization: `Bearer ${configKey.PAYSTACK_SECRET_KEY as string}`
      }
    })

    const tranxQry = qs.stringify(query)
    const transactions = await client.get(`transaction?${tranxQry}`).json()

    return transactions
  }
}
