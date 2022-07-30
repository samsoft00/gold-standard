import { Controller } from '@tsed/di'
import { Authorize } from '@tsed/passport'
import { AutomatedMessageCtrl } from './message/MessageCtrl'
import { PaymentCtrl } from './payment/PaymentCtrl'

/**
 * - Automated Messages []
 * key: MONEY_SAVED
 * title: "Money Saved"
 * message: "Your money is saved"
 * tags ["name", "amount", "prev_balance", "available_balance"]
 */

@Authorize()
@Controller({ path: '/settings', children: [PaymentCtrl, AutomatedMessageCtrl] })
export class SettingsCtrl {}
