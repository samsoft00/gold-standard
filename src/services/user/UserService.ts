import { Injectable } from '@tsed/di'
import { FindOptions } from 'mongodb'
import dbo from '../MongoService'

/**
 * Users
 * - ID
 * - name
 * - email
 * - phoneNumber
 * - gender
 * - type
 * - dateOfBirth
 * - profileImageUrl
 * - authTypeFactor
 * - customerCode
 * - bvn
 * - bvn_verified
 * - verified
 * - verification_code
 * - active ~ Status (Active/Inactive)
 * - createdAt - Join Date
 * - updatedAt
 *
 * sort by
 * - User Status
 * - Year Joined
 * - Month Joined
 *
 * Download file
 */

@Injectable()
export class UserService {
  /**
     * Fetch all users
     * @param query
     */
  async fetchAll (q: any, opt: FindOptions): Promise<any> {
    // handle pagination here
    const r = await dbo.db().collection('users').find(q, {
      sort: opt.sort,
      limit: opt.limit,
      projection: opt.projection
    }).toArray()

    return r
  }
}
