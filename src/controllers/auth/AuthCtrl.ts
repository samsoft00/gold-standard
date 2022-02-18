import { BodyParams, PathParams, Post, QueryParams, Req } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { BadRequest, NotFound, Unauthorized } from '@tsed/exceptions'
import { Get, Name, Pattern, Property, Required, Summary } from '@tsed/schema'
import { Authenticate, Authorize } from '@tsed/passport'
import { v4 } from 'uuid'
import Joi from 'joi'

import userQueueProcessor from '../../workers/UserQueue'
import { IUserJob, IUserRequest, JobType } from '../../types'
import { AuthService } from '../../services/user/AuthService'
import dbo from '../../services/MongoService'
import { RedisCache } from '../../utils/Cache'
import { detach } from '../../utils/detach'
import { validate } from 'email-validator'
import Queue, { JobOptions } from 'bull'
import dayjs from 'dayjs'
import { JwtAuth } from '../../decorators/jwtAuth'

class ResetPassword {
  @Required()
  password: string

  @Required()
  confirm_password: string
}

class UpdatePassword {
  @Required()
  @Property()
  @Pattern(/^[a-zA-Z0-9!@#$%&*]{3,25}$/)
  current_password: string

  @Required()
  @Property()
  @Pattern(/^[a-zA-Z0-9!@#$%&*]{3,25}$/)
  password: string

  @Required()
  @Property()
  @Pattern(/^[a-zA-Z0-9!@#$%&*]{3,25}$/)
  confirm_password: string
}

@Controller('/auth')
@Name('Auth')
export class AuthCtrl {
  queue: Queue.Queue<IUserJob>
  queueOptn: JobOptions

  constructor (
    private readonly redisCache: RedisCache,
    private readonly authService: AuthService,
    @Configuration() readonly config: Configuration) {
    this.queue = new Queue('UserQueue', config.get<string>('redisUrl', process.env.REDIS_URL))
    this.queueOptn = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    }

    detach(this.queue.process(3, userQueueProcessor))
  }

  @Post('/login')
  @Authenticate('login')
  @Summary('This endpoint authenticate user')
  async login (@Req() req: Req,
    @Required() @BodyParams('email') _email: string,
    @Required() @BodyParams('password') _password: string): Promise<any> {
    return { statusCode: 200, message: 'Logged in successful', data: req.user }
  }

  // Logout user
  @Post('/logout')
  @JwtAuth()
  @Authorize()
  @Summary('Logout administrator')
  async logOutUser (@Req() req: IUserRequest): Promise<any> {
    if (req.headers === null || !('authorization' in req.headers)) {
      throw new Unauthorized('Unable to validate authorization key!')
    }

    await this.redisCache.addToBlackList(req)
    return { statusCode: 200, message: 'You have successfully logged out', data: null }
  }

  // Update/Change password
  @Post('/update-password')
  @Authorize() // @Authorize('jwt')
  @JwtAuth()
  @Summary('Update/change password')
  async changePassword (@Req() req: IUserRequest, @BodyParams() body: UpdatePassword): Promise<any> {
    const schema = Joi.object({
      current_password: Joi.string().label('Current password')
        .required(),
      password: Joi.string().label('Password')
        .regex(/^[a-zA-Z0-9!@#$%&*]{3,25}$/)
        .required()
        .messages({
          'any.only': 'Password is require, confirm and try again',
          'string.pattern.base': 'Password must be at least 8 characters long, include both lower and upper case, 1 numeric and 1 special characters.'
        }),
      confirm_password: Joi.any().label('Confirm password')
        .valid(Joi.ref('password'))
        .required()
        .messages({ 'any.only': 'Password and confirm password must match' })
    })

    await schema.validateAsync(body)

    const customer = await dbo.db().collection('admins').findOne({ _id: req.user?._id })
    if (customer === null) throw new NotFound('User not found')

    const check = await this.authService.validatePassword(customer.password, body.current_password)
    if (!check) throw new BadRequest('Current password did not match our record!')

    const newPassword = await this.authService.hashPassword(body.password)
    await dbo.db().collection('admins').updateOne(
      { _id: customer._id },
      { $set: { password: newPassword, updated_datetime: dayjs().format('YYYY-MM-DDTHH:mm:ss') } }
    )

    return { statusCode: 200, message: 'Password update successfully!', data: {} }
  }

  // Reset Password
  @Post('/reset/:reset_token')
  @Summary('reset password')
  async resetPassword (
    @Required() @PathParams('reset_token') resetToken: string,
      @BodyParams() body: ResetPassword): Promise<any> {
    const currentTime = Math.floor(Date.now() / 1000)

    const customer = await dbo.db().collection('admins').findOne({ reset_token: resetToken })

    if (customer === null || Number(customer.reset_expires) < currentTime) {
      throw new BadRequest('Password reset token is invalid or expired')
    }
    const schema = Joi.object({
      password: Joi.string().label('password')
        .regex(/^[a-zA-Z0-9!@#$%&*]{3,25}$/)
        .required(),
      confirm_password: Joi.any().label('confirm password')
        .valid(Joi.ref('password'))
        .required()
        .messages({ 'any.only': 'Password and confirm password must match' })
    })
    await schema.validateAsync(body)

    const hash = await this.authService.hashPassword(body.password)
    await dbo.db().collection('admins').updateOne(
      { id: customer.id },
      { $set: { password: hash }, $unset: { reset_expires: 1, reset_token: 1 } }
    )

    return {
      statusCode: 200,
      message: 'Password reset successfully, please login to proceed!',
      data: {}
    }
  }

  // Generate password reset link
  @Post('/reset-password')
  @Summary('Generate password reset link')
  async generateResetLink (@Required() @BodyParams('email') email: string): Promise<any> {
    email = email.trim().split(' ')[0]

    if (!validate(email)) throw new BadRequest('Valid email is required to reset password!')
    const msg = `If an account exists for ${email}, you will receive password reset instructions.`

    const customer = await dbo.db().collection('admins').findOne({ email: email })
    if (customer === null) throw new BadRequest(msg)

    const resetHash = v4()
    const resetExpires = Math.floor(Date.now() / 1000) + 60 * 60 * 24

    await dbo.db().collection('admins').updateOne(
      { email: customer.email },
      { $set: { reset_expires: resetExpires, reset_token: resetHash } }
    )

    // send mail
    detach(this.queue.add({
      jobName: JobType.RESET_PASSWORD,
      email: customer.email,
      reset_token: encodeURIComponent(resetHash),
      frontend_login_url: this.config.get<string>('front_end_url')
    }, this.queueOptn))

    const data = {}
    // For test purpose
    if (Object.is(this.config.env, 'test')) {
      Object.assign(data, { reset_token: resetHash })
    }

    return {
      statusCode: 200,
      message: msg,
      data
    }
  }

  // Validate reset password token
  @Get('/confirm-reset-token')
  @Summary('Confirm reset password token')
  async validateResetPasswordToken (@QueryParams('reset_hash') resetHash: string): Promise<any> {
    const currentTime = Math.floor(Date.now() / 1000)
    const errMsg = 'Invalid or expire reset details'

    if (resetHash.trim() === '') throw new BadRequest('Password reset hash is required!')

    const customer = await dbo.db().collection('admins').findOne({ reset_token: decodeURIComponent(resetHash) })
    if (customer === null || Number(customer.reset_expires) < currentTime) {
      throw new BadRequest(errMsg)
    }

    return {
      statusCode: 200,
      message: 'Password reset hash is valid!',
      data: {}
    }
  }
}
