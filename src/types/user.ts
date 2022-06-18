import { ObjectId } from 'mongodb'

// eslint-disable-next-line
export type UserQueryParams = {
  name?: string
  limit: number
  user_status: string
  year_join?: string
  month_join?: string
  previous_cursor?: string
  next_cursor?: string
}

export enum Gender {
  FEMALE = 'Female',
  MALE = 'Male',
  UNKNOW = 'Unknown'
}

export interface UserList {
  _id: ObjectId
  name: string
  email: string
  phoneNumber: number
  gender: Gender
  verified: boolean
  active: boolean
  isBanned: boolean
  createdAt: Date
}

export const months: { [key: string]: number } = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
}
