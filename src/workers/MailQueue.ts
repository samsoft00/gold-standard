import { Configuration, Injectable } from '@tsed/common'
import Queue, { Job, JobOptions } from 'bull'
import { ResponseError } from '@sendgrid/mail'

import { detach } from '../utils/detach'
import { IEmailJob } from '../types/interfaces/IQueueJob'
import { MailService } from '../services/email/MailService'
import { helpers, classes } from '@sendgrid/helpers'

@Injectable()
export class MailQueue<T extends IEmailJob> {
  queue: Queue.Queue<T>
  protected opts: JobOptions

  constructor (private readonly mailService: MailService,
    @Configuration() readonly config: Configuration) {
  }

  init (queueName: string): void {
    this.queue = new Queue(queueName, this.config.get<string>('redisUrl', process.env.REDIS_URL))
    this.opts = { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }

    detach(this.queue.process(3, this.queueProcessor.bind(this)))
  }

  async add (data: T, opts?: JobOptions): Promise<Queue.Job<T>> {
    return await this.queue.add(data, this.opts)
  }

  async queueProcessor (job: Job<T>): Promise<void> {
    const { email, subject, templateId, ...data } = job.data

    try {
      const nameEmail = helpers.splitNameEmail(email)

      const msg = {
        to: new classes.EmailAddress({ name: nameEmail[0], email }),
        templateData: data,
        subject: subject,
        templateId: templateId
      }

      await this.mailService.send(msg)
    } catch (error) {
      console.log(error)
      console.log((error as ResponseError).response.body)
    }
  }
}
