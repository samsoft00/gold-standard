import { BodyParams, Req } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { Authorize } from '@tsed/passport'
import { Post } from '@tsed/schema'
import { Collection, ObjectId } from 'mongodb'
import { IMessageBody, MessageType } from '../../types'
import { AutomatedMessageCtrl } from './message/MessageCtrl'
import { PaymentCtrl } from './payment/PaymentCtrl'

import dbMgr from '../../services/MongoService'
import { BadRequest } from '@tsed/exceptions'
import { SmsService } from '../../services/sms/SmsService'
import { PhoneUtility } from '../../utils/PhoneUtility'
import { pick } from 'lodash'
import { IResponseDto } from '../../types/interfaces/IResponseDto'

/**
 * - Automated Messages []
 * key: MONEY_SAVED
 * title: "Money Saved"
 * message: "Your money is saved"
 * tags ["name", "amount", "prev_balance", "available_balance"]
 */

@Authorize()
@Controller({ path: '/settings', children: [PaymentCtrl, AutomatedMessageCtrl] })
export class SettingsCtrl {
  MessageSettingModel: Collection<IMessageBody>
  LoanModel: Collection<any>

  constructor (
    @Configuration() readonly config: Configuration,
    private readonly smsService: SmsService,
    private readonly phoneUtil: PhoneUtility) {
    this.MessageSettingModel = dbMgr.db().collection<IMessageBody>('automated_messages')
    this.LoanModel = dbMgr.db().collection<any>('loans')
  }

  // send reminder
  @Post('/send-reminder')
  async sendReminder (@Req() req: Req, @BodyParams() body: any): Promise<IResponseDto<any>> {
    const payload = pick(body, ['loan_id'])
    if (!ObjectId.isValid(payload.loan_id)) throw new BadRequest('Invalid loan id')

    const loanPipe = [
      { $match: { _id: { $eq: new dbMgr.Id(payload.loan_id) } } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, phoneNumber: 1, email: 1 } }],
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
    ]

    const { msg, loan } = await new Promise<{msg: IMessageBody| null, loan: any}>((resolve, reject) => {
      Promise.all([
        this.MessageSettingModel.findOne({ key: MessageType.LOAN_OVERDUE }),
        this.LoanModel.aggregate(loanPipe).toArray()
      ])
        .then(([msg, loans]) => resolve({ msg, loan: loans[0] }))
        .catch(reject)
    })

    if (msg === null) throw new BadRequest('Failed to find overdue loan message')
    if (loan === null) throw new BadRequest('Failed to find loan')

    const phoneNumber = this.phoneUtil.formatPhoneNumber('07063317344') // loan.user.phoneNumber
    /*
    await this.smsService.send({
      body: msg.message,
      to: phoneNumber
    })
    */
    return {
      statusCode: 200,
      message: `Message sent to ${phoneNumber}`,
      data: {}
    }
  }
}
