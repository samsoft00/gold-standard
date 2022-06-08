
export enum JobType {
  RESET_PASSWORD = 'reset_password',
  SEND_INVITE = 'invite'
}

export interface IQueue {
  jobName: string
}

export interface ISmsJob extends IQueue {
  to: string
  body: string
}
export interface IEmailJob extends IQueue{
  templateId: string
  email: string
  params: {
    [key: string]: string
  }
}

export interface IUserJob extends IQueue {
  email: string
  [key: string]: string
}
