import { Service } from '@tsed/common'
import { BinaryLike, pbkdf2Sync, randomBytes } from 'crypto'

@Service()
export class AuthService {
  async hashPassword (password: string): Promise<string> {
    return await new Promise((resolve, reject) => {
      try {
        const salt = randomBytes(16).toString('hex')
        const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex')

        return resolve(`${salt}$${hash}`)
      } catch (error) {
        return reject(error)
      }
    })
  }

  async validatePassword (accPass: string, password: BinaryLike): Promise<boolean> {
    return await new Promise((resolve) => {
      const creds = accPass.split('$')
      const hash = pbkdf2Sync(password, String(creds.shift()), 10000, 512, 'sha512').toString('hex')
      return Object.is(creds.pop(), hash) ? resolve(true) : resolve(false)
    })
  };
}
