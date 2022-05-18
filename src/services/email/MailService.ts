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
    const { name, email, sendgridApikey } = this.config.get<IMailSettings>('mail')

    this.sender = { name, email }

    sgMail.setApiKey(sendgridApikey)
  }

  async send (data: any): Promise<void> {
    const { to, subject, templateId, ...templateData } = data

    const payload: sgMail.MailDataRequired = {
      from: this.sender,
      to,
      subject,
      templateId,
      dynamicTemplateData: templateData
      // personalizations: [{
      //   to: [{ email: to }],
      //   dynamicTemplateData: templateData
      // }]
    }
    const response = await sgMail.send(payload)

    this.logger.info(`Email sent successfully with statusCode: ${response[0].statusCode}`)
    this.logger.info(response[0].headers)
    this.logger.info(response[0].body)
  }
}
