import { Job } from 'bull'
import { IUserJob, JobType } from '../types'

/**
 * This handle user queue
 * @param job
 * @returns boolean
 */
export default async function (job: Job<IUserJob>): Promise<boolean> {
  const { jobName } = job.data

  switch (jobName) {
    case JobType.SEND_INVITE:
      console.log(job.data)
      return await Promise.resolve(true)
    case JobType.RESET_PASSWORD:
      console.log(job.data)
      return await Promise.resolve(true)
  }

  return await Promise.resolve(true)
}
