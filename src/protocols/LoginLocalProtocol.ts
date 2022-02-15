import { BodyParams, Configuration, Inject } from '@tsed/common'
import { Unauthorized } from '@tsed/exceptions'
import { OnVerify, Protocol } from '@tsed/passport'
import { IStrategyOptions, Strategy } from 'passport-local'
import { MongooseModel } from '@tsed/mongoose'
import jwt from 'jsonwebtoken'

import { User } from '../models/user/User'
import { AuthService } from '../services/user/AuthService'

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
    @Inject(User) private readonly UserModel: MongooseModel<User>,
    @Configuration() private readonly config: Configuration) {}

  async $onVerify (@BodyParams() creds: Credentials): Promise<any> {
    const { email, password } = creds

    const user = await this.UserModel.findOne({ email }).exec()
    if (user === null || [undefined, ''].includes(user.password)) throw new Unauthorized(DEFAULT_ERR_MESSAGE)

    const check = await this.authService.validatePassword(user.password, password)
    if (!check) throw new Unauthorized(DEFAULT_ERR_MESSAGE)

    if (Object.is(user.is_disabled, true)) throw new Unauthorized('Account disabled or Unauthorized Access')

    // Generate token
    const token = this.createJwt(user)
    return { user: user.toJSON(), token }
  }

  createJwt (user: User): string {
    const { secret, signOptions } = this.config.get('auth')
    // const now = Date.now()

    return jwt.sign(
      {
        // sub: user._id,
        // exp: now + signOptions.expiresIn * 1000,
        // iat: now
        _id: user._id,
        email: user.email,
        is_disabled: user.is_disabled
      },
      secret,
      { expiresIn: signOptions.expiresIn }
    )
  }
}
