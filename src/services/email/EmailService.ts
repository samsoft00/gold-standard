import { Configuration, Inject, Injectable } from '@tsed/di'
import { AttachmentData } from '@sendgrid/helpers/classes/attachment'
import helpers from '@sendgrid/helpers'
import sgMail from '@sendgrid/mail'
import { isObject } from '@tsed/core'
import { Logger } from '@tsed/common'

type EmailData = string|{ name?: string, email: string }

interface MailSettings {
  email: string
  sender: string
  sendgridApikey: string
}

interface EmailPayload {
  receiver: EmailData
  content: string
  subject: string
  attachRequired: boolean
  file: AttachmentData
}

/**
 * GSC Email Service
 */
@Injectable()
export class MailService {
  senderName: string
  senderEmail: string

  @Inject()
  logger: Logger

  constructor (@Configuration() private readonly config: Configuration) {
    const { email, sender, sendgridApikey } = this.config.get<MailSettings>('email')

    this.senderName = sender
    this.senderEmail = email

    sgMail.setApiKey(sendgridApikey)
  }

  async sendEmail (payload: EmailPayload): Promise<void> {
    const { receiver } = payload

    const r = {
      ...(isObject(receiver) && { name: receiver.name, email: receiver.email }),
      ...(!isObject(receiver) && { email: receiver })
    }

    const [fromEmail, toEmail] = [
      new helpers.classes.EmailAddress({ name: this.senderName, email: this.senderEmail }),
      new helpers.classes.EmailAddress(r as EmailData)
    ]

    const mail = new helpers.classes.Mail({
      to: toEmail.toJSON(),
      from: fromEmail.toJSON(),
      subject: payload.subject,
      content: [{ type: 'text/html', value: payload.content }]
    })

    if (payload.attachRequired) {
      const attach = new helpers.classes.Attachment()
      const contentType = payload.file.type ?? 'application/pdf'

      attach.setType(contentType)
      attach.setContent(payload.file.content)
      attach.setFilename(payload.file.filename)
      attach.setDisposition('attachment')

      mail.addAttachment(attach)
    }

    const response = await sgMail.send(mail as any)

    this.logger.info(`Email sent successfully with statusCode: ${response[0].statusCode}`)
    this.logger.info(response[0].headers)
  }

  /**
     * Load content from templates
     * & compile using LIQUIDJS
     */
//   async loadContent (template, tmpobj) {
//     return engine.renderFile(template, tmpobj)
//   }
}
