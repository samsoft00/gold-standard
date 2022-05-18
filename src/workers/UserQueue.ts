import { Configuration, Injectable } from '@tsed/di'
import Queue, { Job, JobOptions } from 'bull'
import sgMail, { ResponseError } from '@sendgrid/mail'

import { detach } from '../utils/detach'
import { IQueue } from '../types/interfaces/IQueueJob'
import { MailService } from '../services/email/MailService'

@Injectable()
export class UserQueue<T extends IQueue> {
  queue: Queue.Queue<T>
  protected opts: JobOptions

  constructor (private readonly mailService: MailService,
    @Configuration() readonly config: Configuration) {
  }

  init (queueName: string): void {
    this.queue = new Queue(queueName, this.config.get<string>('redisUrl', process.env.REDIS_URL))
    this.opts = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    }

    detach(this.queue.process(3, this.queueProcessor.bind(this)))
  }

  async add (data: T, opts?: JobOptions): Promise<Queue.Job<T>> {
    return await this.queue.add(data, this.opts)
  }

  async queueProcessor (job: Job<T>): Promise<void> {
    const template = this.config.get<{[key: string]: string}>('emailTemplate')
    const { data } = job

    try {
      const msg: sgMail.MailDataRequired = {
        to: data.email,
        from: 'gsmcsdev@gmail.com', // GS Cooperative <
        templateId: template.ADMIN_INVITE,
        dynamicTemplateData: data
      }

      console.log(job.data)
      console.log(msg)
      await this.mailService.send(msg)
    } catch (error) {
      console.log(error)
      console.log((error as ResponseError).response.body)
    }

    // const { jobName } = job.data

    // switch (jobName) {
    //   case JobType.SEND_INVITE:
    //     await this.$this.sendInvite(job.data)
    //     return await Promise.resolve()
    //   default:
    //     return await Promise.resolve()
    // }
  }
}
