import { Inject, Injectable, Logger, Configuration } from '@tsed/common'
import twilio from 'twilio'
import { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message'

interface ISmsSettings {
  accountSid: string
  authToken: string
  phoneNumber: string
}

@Injectable()
export class SmsService {
  protected sender: string
  protected twilio: twilio.Twilio

  @Inject()
  private readonly logger: Logger

  /**
     * This handle twilio sms
     * Author: Oyewole Abayomi
     */
  constructor (@Configuration() readonly config: Configuration) {
    const { accountSid, authToken, phoneNumber } = this.config.get<ISmsSettings>('twilio')
    this.sender = phoneNumber

    this.twilio = twilio(accountSid, authToken)
  }

  async send (data: MessageListInstanceCreateOptions): Promise<void> {
    console.log(data, this.sender)
    await this.twilio.messages.create({
      body: data.body,
      from: this.sender,
      to: data.to
    })

    this.logger.info(`SMS sent successfully to ${data.to}`)
  }
}
