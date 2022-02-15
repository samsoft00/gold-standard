import { ObjectID } from '@tsed/mongoose'
import { Request } from 'express'

export interface IUserRequest extends Request {
  user: {
    _id: ObjectID
    email: string
    name?: string
  }
}
