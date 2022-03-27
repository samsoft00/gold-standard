import { Indexed, Model, ObjectID, Unique } from '@tsed/mongoose'
import { Property, Required } from '@tsed/schema'

@Model({ collection: 'users' })
export class UserModel {
  @ObjectID('id')
  _id: string

  @Property()
  name: string

  @Property()
  @Required()
  @Unique()
  email: string

  phoneNumber: number
  gender: string
  dateOfBirth: Date | null
  profileImageUrl: string
  password: string
  type: string

  @Indexed()
  @ObjectID('nextOfKin')
  nextOfKin: string | ObjectID | null

  bvn: number | null
  bvn_verified: boolean
  customerCode: string | null
  verified: boolean
  active: boolean
  createdAt: Date
  updatedAt: Date

  isBanned: boolean
  isDeleted: boolean
}
