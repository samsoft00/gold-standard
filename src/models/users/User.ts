import { Property, Required } from '@tsed/schema'

export class UserModel {
  _id: string

  @Property()
  name: string

  @Property()
  @Required()
  email: string

  phoneNumber: number
  gender: string
  dateOfBirth: Date | null
  profileImageUrl: string
  password: string
  type: string

  nextOfKin: string | null

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
