import { Inject, Req } from '@tsed/common'
import { Unauthorized } from '@tsed/exceptions'
import { MongooseModel } from '@tsed/mongoose'
import { Arg, OnVerify, Protocol } from '@tsed/passport'
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt'
import { User } from '../models/user/User'

@Protocol<StrategyOptions>({
  name: 'jwt',
  useStrategy: Strategy,
  settings: {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.ACCESS_TOKEN_SECRET
  }
})
export class JwtProtocol implements OnVerify {
  constructor (@Inject(User) private readonly UserModel: MongooseModel<User>) {}

  async $onVerify (@Req() req: Req, @Arg(0) user: User): Promise<boolean> {
    const admin = await this.UserModel.findOne({ _id: user._id }).exec()
    if (admin === null) throw new Unauthorized('Incorrect login credentials.')

    req.user = {
      _id: admin._id,
      email: admin.email
    }

    return true
  }
}
