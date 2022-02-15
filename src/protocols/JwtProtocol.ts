import { Req } from '@tsed/common'
import { Unauthorized } from '@tsed/exceptions'
import { Arg, OnVerify, Protocol } from '@tsed/passport'
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt'

import dbo from '../services/MongoService'
import { Admin } from '../models/admin/Admin'

@Protocol<StrategyOptions>({
  name: 'jwt',
  useStrategy: Strategy,
  settings: {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.ACCESS_TOKEN_SECRET
  }
})
export class JwtProtocol implements OnVerify {
  async $onVerify (@Req() req: Req, @Arg(0) user: Admin): Promise<boolean> {
    const admin = await dbo.db().collection('admins').findOne({ _id: user._id })
    if (admin === null) throw new Unauthorized('Incorrect login credentials.')

    req.user = {
      _id: admin._id,
      email: admin.email
    }

    return true
  }
}
