import { Configuration, Inject, Injectable, Logger } from '@tsed/common'
import sgMail from '@sendgrid/mail'
import { EmailData } from '@sendgrid/helpers/classes/email-address'

interface IMailSettings {
  name: string
  email: string
  sendgridApikey: string
}

/**
 * GSC Mail Service
 */
@Injectable()
export class MailService {
  private readonly sender: EmailData

  @Inject()
  private readonly logger: Logger

  constructor (@Configuration() readonly config: Configuration) {
    const { name, email, sendgridApikey } = this.config.get<IMailSettings>('email')

    this.sender = { email, name }

    sgMail.setApiKey(sendgridApikey)
  }

  async send (data: sgMail.MailDataRequired): Promise<void> {
    Object.assign(data, { ...(data.from === undefined && { from: this.sender }) })
    console.log(data)
    const response = await sgMail.send(data)

    this.logger.info(`Email sent successfully with statusCode: ${response[0].statusCode}`)
    this.logger.info(response[0].headers)
    this.logger.info(response[0].body)
  }
}
