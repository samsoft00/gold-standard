
export enum JobType {
  RESET_PASSWORD = 'reset_password',
  SEND_INVITE = 'invite'
}

interface IQueue {
  jobName: string
}

export interface IUserJob extends IQueue {
  email: string
  [key: string]: string
}
