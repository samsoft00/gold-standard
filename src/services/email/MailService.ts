import { Configuration, Injectable } from '@tsed/common'
import sgMail from '@sendgrid/mail'

export type IEmailRecipient = string | { name?: string, email: string }

export interface ISendMail {
  to: IEmailRecipient | IEmailRecipient[]
  subject?: string
  text?: string
  html?: string
  templateId?: string
  params?: {
    [key: string]: string | any[] | any
  }
}

export interface IMailSettings {
  name: string
  email: string
  sendgridApikey: string
}

/**
 * GSC Mail Service
 */
@Injectable()
export class MailService {
  private readonly sender: any
  private readonly sendgrid = sgMail

  constructor (@Configuration() readonly config: Configuration) {
    const { name, email, sendgridApikey } = this.config.get<IMailSettings>('mail')

    this.sendgrid.setApiKey(sendgridApikey)
    this.sender = { name, email }
  }

  async sendMail (mail: ISendMail): Promise<[sgMail.ClientResponse, {}]> {
    if (!mail.templateId && !mail.subject) throw new Error('Either templateId or subject must be present') // eslint-disable-line

    const mailObject: Partial<sgMail.MailDataRequired> = {
      subject: mail.subject,
      dynamicTemplateData: mail.params,
      to: mail.to,
      from: this.sender,
      templateId: undefined
    }

    Object.assign(mailObject, {
      ...(mail.templateId !== undefined && { templateId: mail.templateId }),
      ...(mail.html !== undefined && { html: mail.html }),
      ...(mail.text !== undefined && { text: mail.text })
    })

    return await this.sendgrid.send(mailObject as never, false)
  }
}
