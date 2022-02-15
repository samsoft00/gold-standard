import { ObjectID } from '@tsed/mongoose'

declare module 'express' {
  export interface Request {
    user: {
      _id: ObjectID
      email: string
      name?: string
    }
  }
}
