import 'dotenv/config'
import { PlatformAcceptMimesMiddleware, PlatformApplication } from '@tsed/common'
import { Configuration, Inject } from '@tsed/di'
import '@tsed/platform-express'
import '@tsed/swagger'
import Path from 'path'
import cors from 'cors'
import morgan from 'morgan'
import helmet from 'helmet'
import express from 'express'
import compress from 'compression'

import './errors/ErrorHandler'
import { specOS3 } from './utils/specOS3'
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
  componentsScan: [
    `${rootDir}/protocols/**/*.ts`
  ],
  exclude: ['**/*.spec.ts'],
  swagger: [{ path: '/api/docs', specVersion: '3.0.1', spec: specOS3 }],
  acceptMimes: ['application/json'],
  auth: {
    secret: process.env.ACCESS_TOKEN_SECRET,
    refreshSecret: process.env.REFRESH_SECRET,
    signOptions: { expiresIn: PASSWORD_EXP, refreshExpIn: REFRESH_EXP },
    resetPasswordExp: PASSWORD_RESET_EXP
  },
  email: {
    name: 'Gold Standard',
    sender: process.env.DEFAULT_EMAIL,
    sendgridApikey: process.env.SENDGRID_API_KEY
  },
  configKeys: {
    AES_KEY: process.env.AES_KEY
  }
})
export class GoldStandard {
  @Inject()
  app: PlatformApplication

  private $beforeRoutesInit (): void {
    this.middleware()
  }

  private middleware (): void {
    const corsOptions = {
      credentials: true,
      origin: [],
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
