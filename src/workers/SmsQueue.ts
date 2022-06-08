import { Configuration, Injectable } from '@tsed/di'
import { SmsService } from '../services/sms/SmsService'
import { ISmsJob } from '../types'

@Injectable()
export class SmsQueue<T extends ISmsJob> {
  constructor (private readonly mailService: SmsService,
    @Configuration() readonly config: Configuration) {
  }

  async sendMessage (data: T): Promise<void> {
    return await this.mailService.send(data)
  }
}
