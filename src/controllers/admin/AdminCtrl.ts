import { BodyParams, Get, PathParams, Post, QueryParams } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { Put, Required } from '@tsed/schema'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { createHash } from 'crypto'
import dayjs from 'dayjs'
import Joi from 'joi'

import dbo from '../../services/MongoService'
import { IResponseDto } from '../../types/interfaces/IResponseDto'
import { detach } from '../../utils/detach'
import { BadRequest, NotFound } from '@tsed/exceptions'
import { AuthService } from '../../services/user/AuthService'
import { JobType } from '../../types'
import { MailQueue } from '../../workers/MailQueue'
import { IEmailJob } from '../../types/interfaces/IQueueJob'
import { Authorize } from '@tsed/passport'

const INVITE_TEMPLATE = process.env.INVITE_TEMPLATE

interface AddAdmin {
  name: string
  email: string
}
interface AdminDto {
  name: string
  email: string
  image_url: string
  is_disabled: boolean
  created_date: Date
  updated_date: Date
}
export class AcceptInvite {
  @Required()
  password: string

  @Required()
  confirm_password: string
}

@Controller({ path: '/admin' })
export class AdminCtrl {
  constructor (private readonly emailQueue: MailQueue<IEmailJob>,
    private readonly authService: AuthService,
    @Configuration() readonly config: Configuration) {
    this.emailQueue.init('userQueue')
  }

  @Get('/')
  async getAdmins (@QueryParams('is_disabled') isDisable: boolean): Promise<IResponseDto<AdminDto[]>> {
    const admins = await dbo.db().collection('admins').find({
      is_disabled: isDisable || false
    }).toArray()

    const results = admins.map(admin => {
      return {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
        image_url: admin.image_url,
        is_disabled: admin.is_disabled,
        created_date: admin.created_date,
        updated_date: admin.updated_date
      }
    })

    return {
      statusCode: 200,
      message: 'successful',
      data: results as any
    }
  }

  @Authorize()
  @Put('/:id/disable')
  async disableAdmin (@PathParams('id') adminId: string): Promise<any> {
    const admin = await dbo.db().collection('admins').findOne({ _id: new dbo.Id(adminId) })
    if (admin === null) throw new NotFound('Account not found')

    await dbo.db().collection('admins').updateOne(
      { _id: admin._id },
      { $set: { is_disabled: true, updated_date: dayjs().format('YYYY-MM-DDTHH:mm:ss') } }
    )

    return {
      statusCode: 200,
      message: 'successful',
      data: null
    }
  }

  @Authorize()
  @Post('/invite-user')
  async inviteUser (@Required() @BodyParams() request: AddAdmin): Promise<any> {
    const configKeys = this.config.get('configKeys')

    if (!/^[+a-z0-9._-]+@[a-z0-9._-]+\.[a-z0-9_-]+$/.test(request.email)) {
      throw new BadRequest('Email invalid. Confirm and try again')
    }

    const imageUrl = createHash('md5').update(request.email).digest('hex').toString()

    const result = await dbo.db().collection('admins').insertOne({
      name: request.name,
      email: request.email,
      image_url: `https://www.gravatar.com/avatar/${imageUrl}?s=200&d=identicon`,
      is_disabled: false,
      created_date: new Date()
    })

    const link = jwt.sign({ id: result.insertedId.toString() }, configKeys.AES_KEY, { expiresIn: '3h' })

    detach(this.emailQueue.add({
      email: request.email,
      jobName: JobType.SEND_INVITE,
      templateId: INVITE_TEMPLATE as string,
      params: {
        name: request.name,
        inviteLink: link,
        subject: 'You are invited'
      }
    }))

    return {
      statusCode: 200,
      message: 'successful',
      data: null
    }
  }

  @Get('/validate-link/:invite_token')
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
    if (admin === null) throw new NotFound('Account not found')

    const hashPassword = await this.authService.hashPassword(payload.password)
    await dbo.db().collection('admins').updateOne(
      { _id: admin._id },
      { $set: { password: hashPassword, updated_date: dayjs().format('YYYY-MM-DDTHH:mm:ss') } }
    )

    return {
      statusCode: 200,
      message: 'successful',
      data: null
    }
  }
}
