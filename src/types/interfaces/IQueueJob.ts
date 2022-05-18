
export enum JobType {
  RESET_PASSWORD = 'reset_password',
  SEND_INVITE = 'invite'
}

export interface IQueue {
  jobName: string
  email: string
}

export interface IUserJob extends IQueue {
  email: string
  [key: string]: string
}
