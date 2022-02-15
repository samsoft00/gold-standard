import { ObjectId } from 'mongodb'
import { Request } from 'express'

export interface IUserRequest extends Request {
  user: {
    _id: ObjectId
    email: string
    name?: string
  }
}
