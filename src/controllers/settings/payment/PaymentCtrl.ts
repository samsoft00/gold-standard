import { Controller } from '@tsed/di'

// https://paystack.com/docs/api/#dedicated-virtual-account-create
@Controller({ path: '/payment' })
export class PaymentCtrl {
  /**
   * Paystack balance
   * Paystack Account {current balance, admin balance }
   * withdraw
   * fund wallet
   * card: {cards, generate new card }
   */
}
