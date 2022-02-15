import { Default, Email, Format, Property } from '@tsed/schema'

export class Admin {
  @Property()
  _id: string

  @Email()
  email: string

  @Property()
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
