import { BodyParams, PathParams, Req } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { BadRequest, InternalServerError } from '@tsed/exceptions'
import { Authorize } from '@tsed/passport'
import { Get, Put, Summary } from '@tsed/schema'
import { Collection, ObjectId } from 'mongodb'
import dbMgr from '../../services/MongoService'
import { IMessageBody, IResponseDto, payload } from '../../types'

/**
 * - Automated Messages []
 * key: MONEY_SAVED
 * title: "Money Saved"
 * message: "Your money is saved"
 * tags ["name", "amount", "prev_balance", "available_balance"]
 */

@Controller({ path: '/automated-message' })
export class AutomatedMessageCtrl {
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

@Authorize()
@Controller({ path: '/settings', children: [AutomatedMessageCtrl] })
export class SettingsCtrl {}
