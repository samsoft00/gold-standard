
export enum JobType {
  RESET_PASSWORD = 'reset_password',
  SEND_INVITE = 'invite'
}

export interface IQueue {
  jobName: string
}

export interface IEmailJob extends IQueue{
  subject: string
  templateId: string
  email: string
  [key: string]: string
}

export interface IUserJob extends IQueue {
  email: string
  [key: string]: string
}
