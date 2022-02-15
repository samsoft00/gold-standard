import { Job } from 'bull'
import { IUserJob } from '../types'

/**
 * This handle user queue
 * @param job
 * @returns boolean
 */
export default async function (job: Job<IUserJob>): Promise<boolean> {
  const { jobName } = job.data

  switch (jobName) {
    case 'invite':
      console.log(job.data)
      return await Promise.resolve(true)
  }

  return await Promise.resolve(true)
}
