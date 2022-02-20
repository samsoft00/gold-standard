import { BodyParams, Configuration, Controller, PathParams, Post } from '@tsed/common'
import { Description, Get, Name, Required, Returns, Summary } from '@tsed/schema'
import jwt, { JwtPayload } from 'jsonwebtoken'
import dbo from '../../services/MongoService'
import Joi from 'joi'

import userQueueProcessor from '../../workers/UserQueue'
import { IResponseDto } from '../../types/interfaces/IResponseDto'
import { detach } from '../../utils/detach'
import { BadRequest, NotFound } from '@tsed/exceptions'
import { AuthService } from '../../services/user/AuthService'
import { IUserJob, JobType } from '../../types'
import Queue, { JobOptions } from 'bull'
import dayjs from 'dayjs'
import { Authorize } from '@tsed/passport'
import { OpenApiJwtAuth } from '../../decorators/OpenApiJwtAuth'

export class AcceptInvite {
  @Required()
  password: string

  @Required()
  confirm_password: string
}

@Controller({ path: '/admin' })
@Name('Admin')
export class AdminCtrl {
  queue: Queue.Queue<IUserJob>
  queueOptn: JobOptions

  constructor (
    private readonly authService: AuthService,
    @Configuration() readonly config: Configuration) {
    this.queue = new Queue('UserQueue', config.get<string>('redisUrl', process.env.REDIS_URL))
    this.queueOptn = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    }

    detach(this.queue.process(3, userQueueProcessor))
  }

  @Post('/')
  @OpenApiJwtAuth()
  @Authorize()
  @Summary('Endpoint to onboard new administrator')
  async inviteUser (@Required() @BodyParams('email') email: string): Promise<any> {
    const configKeys = this.config.get('configKeys')

    if (!/^[+a-z0-9._-]+@[a-z0-9._-]+\.[a-z0-9_-]+$/.test(email)) {
      throw new BadRequest('Email invalid. Confirm and try again')
    }

    const result = await dbo.db().collection('admins').insertOne({
      email,
      is_disabled: false,
      created_date: new Date()
    })

    const link = jwt.sign({ id: result.insertedId.toString() }, configKeys.AES_KEY, { expiresIn: '3h' })

    detach(this.queue.add({
      jobName: JobType.SEND_INVITE,
      inviteLink: link,
      email
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

  @Get('/validate-link/:invite_token')
  @Summary('Endpoint to validate link')
  @Description('Validate invite link')
  async validateLink (@Required() @PathParams('invite_token') link: string): Promise<any> {
    const configKeys = this.config.get('configKeys')
    jwt.verify(link, configKeys.AES_KEY) as JwtPayload

    return {
      statusCode: 200,
      message: 'successful',
      data: null
    }
  }

  @Post('/accept-invite/:invite_token')
  @(Returns(400, NotFound).Description('Admin not found'))
  @Summary('Endpoint to accept invites')
  async acceptInvite (
    @Required() @PathParams('invite_token') inviteLink: string,
      @BodyParams() payload: AcceptInvite): Promise<IResponseDto<any>> {
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

    const admin = await dbo.db().collection('admins').findOne({ _id: new dbo.Id(decoded.id) })
    if (admin === null) throw new NotFound('Admin not found')

    const hashPassword = await this.authService.hashPassword(payload.password)
    await dbo.db().collection('admins').updateOne(
      { _id: admin._id },
      { $set: { password: hashPassword, updated_datetime: dayjs().format('YYYY-MM-DDTHH:mm:ss') } }
    )

    return {
      statusCode: 200,
      message: 'successful',
      data: null
    }
  }
}
