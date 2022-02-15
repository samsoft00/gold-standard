import { Lowercase, Model, Trim, Unique } from '@tsed/mongoose'
import { Default, Email, Format } from '@tsed/schema'
import { BaseModel } from '../BaseModel'

@Model({ name: 'admin' })
export class User extends BaseModel {
  @Trim()
  @Unique(true)
  @Email()
  @Lowercase(true)
  email: string

  @Trim()
  password: string

  reset_expires?: number

  reset_token?: string

  @Default(false)
  is_disabled: boolean = false

  @Format('date-time')
  @Default(Date.now)
  timestamp: Date = new Date()

  last_login_ip?: string

  toJSON (): any {
    return {
      _id: this._id,
      email: this.email
    }
  }
}
