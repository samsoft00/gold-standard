import { Inject, Service } from '@tsed/di'
import { MongooseModel } from '@tsed/mongoose'
import { User } from '../../models/user/User'

@Service()
export class UserService {
  @Inject(User)
  private readonly User: MongooseModel<User>

  /**
   * Find a user by his ID
   * @param id
   * @returns {User|null}
   */
  async find (id: string): Promise<User|null> {
    const user = await this.User.findById(id).exec()
    return user
  }

  /**
   * Find a user by email address
   * @param email
   * @returns {User|null}
   */
  async findByEmail (email: string): Promise<User|null> {
    const user = await this.User.findOne({ email }).exec()
    return user
  }

  async findOrCreate (user: Partial<User>): Promise<any> {}

  /**
   * @param payload
   * @returns Promise<User>
   */
  async save (payload: Partial<User>): Promise<User> {
    const model = new this.User(payload)
    await model.updateOne(payload, { upsert: true })

    return model
  }
}
