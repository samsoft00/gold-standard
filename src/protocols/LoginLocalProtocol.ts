import { BodyParams, Configuration } from '@tsed/common'
import { Unauthorized } from '@tsed/exceptions'
import { OnVerify, Protocol } from '@tsed/passport'
import { IStrategyOptions, Strategy } from 'passport-local'
import jwt from 'jsonwebtoken'

import dbo from '../services/MongoService'
import { IAuthUser } from '../controllers/auth/AuthCtrl'
import { AuthService } from '../services/user/AuthService'
import { ObjectId } from 'mongodb'
import dayjs from 'dayjs'

const DEFAULT_ERR_MESSAGE = 'Invalid login credentials, check and try again.'

interface Credentials {
  email: string
  password: string
}

@Protocol<IStrategyOptions>({
  name: 'login',
  useStrategy: Strategy,
  settings: {
    usernameField: 'email',
    passwordField: 'password'
  }
})
export class LoginLocalProtocol implements OnVerify {
  constructor (
    private readonly authService: AuthService,
    @Configuration() private readonly config: Configuration) {}

  async $onVerify (@BodyParams() creds: Credentials): Promise<any> {
    const { email, password } = creds

    const user = await dbo.db().collection<IAuthUser>('admins').findOne({ email })
    if (user === null || [undefined, ''].includes(user.password)) throw new Unauthorized(DEFAULT_ERR_MESSAGE)

    // check for last login attempt
    if (user.last_login_attempt !== undefined && user.last_login_attempt > dayjs().unix() - 5) {
      await this.updateLastLoginAttempt(user._id)
      throw new Unauthorized('Too many login attempts, please try again in 5 minutes.')
    }

    const check = await this.authService.validatePassword(user.password ?? 'default', password)
    if (!check) throw new Unauthorized(DEFAULT_ERR_MESSAGE)

    if (Object.is(user.is_disabled, true)) throw new Unauthorized('Account disabled or Unauthorized Access')

    // Generate token
    delete user.password
    const token = this.createJwt(user)
    return { user: user, token }
  }

  async updateLastLoginAttempt (id: ObjectId): Promise<void> {
    await dbo.db().collection('admins').updateOne(
      { _id: id },
      { $set: { last_login_attempt: dayjs().unix() } }
    )
  }

  createJwt (user: any): string {
    const { secret, signOptions } = this.config.get('auth')
    // const now = Date.now()

    return jwt.sign(
      {
        _id: user._id,
        email: user.email,
        is_disabled: user.is_disabled
      },
      secret,
      { expiresIn: signOptions.expiresIn }
    )
  }
}
