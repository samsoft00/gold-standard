import { Document } from 'mongodb'

export enum MessageType {
  AUTO_DEBIT_SUCCESSFUL = 'AUTO_DEBIT_SUCCESSFUL',
  LOAN_DAYS_BEFORE_DUE = 'LOAN_DAYS_BEFORE_DUE',
  AUTO_DEBIT_FAILED = 'AUTO_DEBIT_FAILED',
  LOAN_DISBURSED = 'LOAN_DISBURSED',
  LOAN_DISBURSING = 'LOAN_DISBURSING',
  LOAN_DECLINED = 'LOAN_DECLINED',
  LOAN_OVERDUE = 'LOAN_OVERDUE',
  MONEY_SAVED = 'MONEY_SAVED',
}

export interface IMessageBody extends Document {
  key: MessageType
  title: string
  message?: string
}

export interface IResponseDto<T> {
  statusCode: number
  message: string
  data: T
}

export const payload: IMessageBody[] = [
  {
    key: MessageType.AUTO_DEBIT_SUCCESSFUL,
    title: 'Auto Debit Successful',
    message: ''
  },
  {
    key: MessageType.AUTO_DEBIT_FAILED,
    title: 'Auto Debit Failed',
    message: ''
  },
  {
    key: MessageType.MONEY_SAVED,
    title: 'Money Saved',
    message: ''
  },
  {
    key: MessageType.LOAN_DISBURSED,
    title: 'Loan Disbursed',
    message: ''
  },
  {
    key: MessageType.LOAN_DAYS_BEFORE_DUE,
    title: 'Loan Days Before Due',
    message: ''
  },
  {
    key: MessageType.LOAN_DISBURSING,
    title: 'Loan Disbursing',
    message: ''
  },
  {
    key: MessageType.LOAN_DECLINED,
    title: 'Loan Declined',
    message: ''
  },
  {
    key: MessageType.LOAN_OVERDUE,
    title: 'Loan Overdue',
    message: ''
  }
]
