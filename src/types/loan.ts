import { Document, ObjectId } from 'mongodb'

export enum LoanStatus {
  Active = 'active',
  Inactive = 'inactive',
  Declined = 'declined',
}

export interface ILoan extends Document{
  _id: string
  userId: string | ObjectId
  status: LoanStatus
  loanPackage: string | ObjectId
  amount: number
  reason: string
  additionalInfo: any
}

export interface ILoanTypes extends Document {
  _id: ObjectId
  title: string
}

export interface ILoanSortBy {
  limit: number
  amount?: number
  loan_status: string
  month_joined?: string
  loan_type?: ObjectId
  previous_cursor?: string
  next_cursor?: string
}
