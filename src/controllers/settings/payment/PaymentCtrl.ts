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
   *
   * - Fund Wallet
   * Amount
   * Payment Option
   * Pay with saved bank card
   *
   * - Add new card
   * card number
   * card expiry
   * cvv
   * default
   *
   * - Withdraw to paystack
   * Amount
   * Choose option
   * Admin Wallet or Paystack Wallet
   *
   * Complete transaction using 4 digit PIN
   */
}
