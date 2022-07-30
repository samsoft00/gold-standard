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

export interface IUser {
  _id: string
  name: string
  email: string
  phoneNumber: number
  gender: string
  dateOfBirth: Date | null
  profileImageUrl: string
  password: string
  type: string
  nextOfKin: string | ObjectId | null
  bvn: number | null
  bvn_verified: boolean
  customerCode: string | null
  verified: boolean
  verification_code: string | null
  active: boolean
  isBanned: boolean
  isDeleted: boolean
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

export const monthToStr: { [key: string]: string } = {
  '01': 'january',
  '02': 'february',
  '03': 'march',
  '04': 'april',
  '05': 'may',
  '06': 'june',
  '07': 'july',
  '08': 'august',
  '09': 'september',
  10: 'october',
  11: 'november',
  12: 'december'
}
