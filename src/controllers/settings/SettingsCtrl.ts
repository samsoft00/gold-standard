import { BodyParams, PathParams, Req } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { BadRequest, InternalServerError } from '@tsed/exceptions'
import { Authorize } from '@tsed/passport'
import { Get, Put, Summary } from '@tsed/schema'
import { Collection, Document, ObjectId } from 'mongodb'
import dbMgr from '../../services/MongoService'

/**
 * - Automated Messages []
 * key: MONEY_SAVED
 * title: "Money Saved"
 * message: "Your money is saved"
 * tags ["name", "amount", "prev_balance", "available_balance"]
 */

enum MessageType {
  AUTO_DEBIT_SUCCESSFUL = 'AUTO_DEBIT_SUCCESSFUL',
  LOAN_DAYS_BEFORE_DUE = 'LOAN_DAYS_BEFORE_DUE',
  AUTO_DEBIT_FAILED = 'AUTO_DEBIT_FAILED',
  LOAN_DISBURSED = 'LOAN_DISBURSED',
  LOAN_DISBURSING = 'LOAN_DISBURSING',
  LOAN_DECLINED = 'LOAN_DECLINED',
  LOAN_OVERDUE = 'LOAN_OVERDUE',
  MONEY_SAVED = 'MONEY_SAVED',
}

interface IMessageBody extends Document {
  key: MessageType
  title: string
  message?: string
}

export interface IResponseDto<T> {
  statusCode: number
  message: string
  data: T
}

const payload: IMessageBody[] = [
  {
    key: MessageType.AUTO_DEBIT_SUCCESSFUL,
    title: 'Auto Debit Successful',
    message: ''
  },
  {
    key: MessageType.AUTO_DEBIT_FAILED,
    title: 'Auto Debit Failed',
    message: ''
  },
  {
    key: MessageType.MONEY_SAVED,
    title: 'Money Saved',
    message: ''
  },
  {
    key: MessageType.LOAN_DISBURSED,
    title: 'Loan Disbursed',
    message: ''
  },
  {
    key: MessageType.LOAN_DAYS_BEFORE_DUE,
    title: 'Loan Days Before Due',
    message: ''
  },
  {
    key: MessageType.LOAN_DISBURSING,
    title: 'Loan Disbursing',
    message: ''
  },
  {
    key: MessageType.LOAN_DECLINED,
    title: 'Loan Declined',
    message: ''
  },
  {
    key: MessageType.LOAN_OVERDUE,
    title: 'Loan Overdue',
    message: ''
  }
]

@Authorize()
@Controller({ path: '/settings' })
export class SettingsCtrl {
  MessageSettingModel: Collection<IMessageBody>

  constructor (@Configuration() readonly config: Configuration) {
    this.MessageSettingModel = dbMgr.db().collection<IMessageBody>('automated_messages')
  }

  @Get('/')
  async getAutomaticMessages (@Req() req: Req): Promise<IResponseDto<IMessageBody[]>> {
    let messageList = await this.MessageSettingModel.find().toArray()
    if (messageList.length === 0) {
      const result = await this.MessageSettingModel.insertMany(payload)
      if (!result.acknowledged) {
        throw new InternalServerError('Failed to create automated messages')
      }
    }

    messageList = await this.MessageSettingModel.find().toArray()
    return {
      statusCode: 200,
      message: 'successful',
      data: messageList
    }
  }

  @Put('/:message_id')
  @Summary('This endpoint update the automatic messages')
  async updateAutomaticMessages (@Req() req: Req, @PathParams('message_id') id: string,
    @BodyParams() body: IMessageBody): Promise<IResponseDto<any>> {
    const { key, message } = body

    const result = await this.MessageSettingModel.updateOne(
      { _id: new ObjectId(id), key },
      { $set: { message } }
    )

    if (result.matchedCount !== 1) {
      throw new BadRequest('Failed to update automated message, confirm your request and try again')
    }

    return {
      statusCode: 200,
      message: 'successful',
      data: {}
    }
  }
}
