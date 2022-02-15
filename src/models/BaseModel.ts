import { ObjectID } from '@tsed/mongoose'

export class BaseModel {
  @ObjectID('id')
  _id: string
}
