import 'dotenv/config'
import { PlatformAcceptMimesMiddleware, PlatformApplication } from '@tsed/common'
import { Configuration, Inject } from '@tsed/di'
import '@tsed/platform-express'
import Path from 'path'
import cors from 'cors'
import morgan from 'morgan'
import helmet from 'helmet'
import express from 'express'
import compress from 'compression'

import './errors/ErrorHandler'
import { HomeCtrl } from './controllers/HomeCtrl'

const rootDir = Path.resolve(__dirname)
const PASSWORD_EXP = Math.floor(Date.now() / 1000) + 60 * 60 * 7 // 1hours
const PASSWORD_RESET_EXP = Math.floor(Date.now() / 1000) + 60 * 60 * 1 // 1hours
const REFRESH_EXP = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 1 // 7 days

@Configuration({
  rootDir,
  mount: {
    '/': [HomeCtrl],
    '/api/v1': [`${rootDir}/controllers/**/*.ts`]
  },
  componentsScan: [`${rootDir}/protocols/**/*.ts`],
  exclude: ['**/*.spec.ts'],
  acceptMimes: ['application/json'],
  auth: {
    secret: process.env.ACCESS_TOKEN_SECRET,
    refreshSecret: process.env.REFRESH_SECRET,
    signOptions: { expiresIn: PASSWORD_EXP, refreshExpIn: REFRESH_EXP },
    resetPasswordExp: PASSWORD_RESET_EXP
  },
  emailTemplate: {
    ADMIN_INVITE: 'd-5d0e5d575efd4c93a397937df28cb3c7'
  },
  mail: {
    name: 'GS Cooperative',
    email: process.env.DEFAULT_EMAIL,
    sendgridApikey: process.env.SENDGRID_API_KEY
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  configKeys: {
    AES_KEY: process.env.AES_KEY,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY
  },
  database: {
    DB_URL: process.env.DB_URL,
    DB_NAME: process.env.DB_NAME,
    MAX_POOL_SIZE: process.env.MAX_POOL_SIZE
  }
})
export class GoldStandard {
  @Inject()
  app: PlatformApplication

  // @Inject()
  // mongoService: MongoService

  private $beforeRoutesInit (): void {
    this.middleware()
    // detach(this.mongoService.connect())
  }

  private middleware (): void {
    const corsOptions = {
      credentials: true,
      origin: true,
      optionsSuccessStatus: 200
    }

    this.app
      .use(cors(corsOptions))
      .use(PlatformAcceptMimesMiddleware)
      .use(compress({}))
      .use(helmet({ contentSecurityPolicy: false }))
      .use(morgan('dev'))
      .use(express.json())
      .use(
        express.urlencoded({
          extended: true
        })
      )
  }
}
