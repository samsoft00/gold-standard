import { BodyParams, Configuration, Controller, Inject, PathParams, Post } from '@tsed/common'
import { Get, Required, Returns, Summary } from '@tsed/schema'
import jwt, { JwtPayload } from 'jsonwebtoken'
import Joi from 'joi'

import userQueueProcessor from '../../workers/UserQueue'
import { IResponseDto } from '../../types/interfaces/IResponseDto'
import { detach } from '../../utils/detach'
import { NotFound } from '@tsed/exceptions'
import { AuthService } from '../../services/user/AuthService'
import { MongooseModel } from '@tsed/mongoose'
import { User } from '../../models/user/User'
import { IUserJob, JobType } from '../../types'
import Queue, { JobOptions } from 'bull'

interface InviteUser {
  email: string
}

@Controller({ path: '/admin' })
export class UserCtrl {
  queue: Queue.Queue<IUserJob>
  queueOptn: JobOptions

  constructor (
    private readonly authService: AuthService,
    @Configuration() readonly config: Configuration,
    @Inject(User) private readonly UserModel: MongooseModel<User>) {
    this.queue = new Queue('UserQueue', config.get<string>('redisUrl', process.env.REDIS_URL))
    this.queueOptn = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    }

    detach(this.queue.process(3, userQueueProcessor))
  }

  // @Summary('Endpoint to onboard new user')
  // @Returns(200, IResponseDto)
  @Post('/')
  async inviteUser (@BodyParams() @Required() payload: InviteUser): Promise<any> {
    const configKeys = this.config.get('configKeys')

    const user = await this.UserModel.create(payload)
    const link = jwt.sign({ id: user._id }, configKeys.AES_KEY, { expiresIn: '3h' })

    detach(this.queue.add({
      jobName: JobType.SEND_INVITE,
      email: payload.email,
      inviteLink: link
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    }))

    return {
      statusCode: 200,
      message: 'successful',
      data: null
    }
  }

  @Get('/validate-link/:invite_link')
  @Summary('Endpoint to validate link')
  async validateLink (@PathParams('invite_link') @Required() link: string): Promise<any> {
    const configKeys = this.config.get('configKeys')
    jwt.verify(link, configKeys.AES_KEY) as JwtPayload

    return {
      statusCode: 200,
      message: 'successful',
      data: null
    }
  }

  @Post('/accept-invite/:invite_link')
  @Summary('Endpoint to accept invites')
  @Returns(200, IResponseDto)
  async acceptInvite (
    @PathParams('invite_link') @Required() inviteLink: string,
      @BodyParams() payload: any): Promise<IResponseDto<any>> {
    const configKeys = this.config.get('configKeys')

    const schema = Joi.object({
      password: Joi.string()
        .label('Password')
        .regex(/^[a-zA-Z0-9!@#$%&*]{3,25}$/)
        .required()
        .messages({
          'any.only': 'Password is require, confirm and try again',
          'string.pattern.base': 'Password must be at least 8 characters long, include both lower and upper case, 1 numeric and 1 special characters.'
        }),
      confirm_password: Joi.any()
        .label('Confirm password')
        .valid(Joi.ref('password'))
        .required()
        .messages({ 'any.only': 'Password and confirm password must match' })
    })

    await schema.validateAsync(payload)

    const decoded = jwt.verify(inviteLink, configKeys.AES_KEY) as JwtPayload
    const user = await this.UserModel.findById(decoded.id)

    if (user == null) throw new NotFound('user not found')

    const hashPassword = await this.authService.hashPassword(payload.password)
    await this.UserModel.updateOne({ _id: user._id }, { password: hashPassword })

    return {
      statusCode: 200,
      message: 'successful',
      data: null
    }
  }
}
