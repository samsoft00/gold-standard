import { Configuration, Inject, Injectable, Logger } from '@tsed/common'
import Queue, { Job, JobOptions } from 'bull'
import { ResponseError } from '@sendgrid/mail'

import { detach } from '../utils/detach'
import { IEmailJob } from '../types/interfaces/IQueueJob'
import { ISendMail, MailService } from '../services/email/MailService'

@Injectable()
export class MailQueue<T extends IEmailJob> {
  queue: Queue.Queue<T>
  protected opts: JobOptions

  @Inject()
  logger: Logger

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
    const { email, templateId, params } = job.data

    try {
      const [name] = email.split('@', 1)

      const msg: ISendMail = {
        to: { name, email },
        templateId: templateId,
        params: { name, ...params }
      }

      const response = await this.mailService.sendMail(msg)
      this.logger.info(msg, response)
    } catch (error) {
      console.log((error as ResponseError).response.body)
    }
  }
}
