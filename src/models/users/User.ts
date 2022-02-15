import { Property } from '@tsed/schema'

export class User {
  @Property()
  _id: string

  @Property()
  name: string
}
