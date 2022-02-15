import { Service } from '@tsed/common'
import Redis from 'ioredis'
import crypto from 'crypto'
import { IUserRequest } from '../types'

// const redisConfig = config.get('redis')
// const redis = new Redis(redisConfig)

interface RedisData {
  expire?: number
  upsert?: boolean
  args: [string, {[key: string]: string}]
  raw?: boolean
  fnc: (key: string, q: {[key: string]: string}) => Promise<any>
}

const tempCache: {[key: string]: any} = []

@Service()
export class RedisCache extends Redis {
  /**
   * Omoo, searching for new job now is crazy
   * Is there a way to call configuration without constructor
   * **/
  constructor () {
    super(process.env.REDIS_URL)
  }

  // cache redis information
  async cache<T> (email: string, prfx: string, data: RedisData): Promise<T|null> {
    data.raw = Boolean(data.raw)
    data.upsert = Boolean(data.upsert)
    data.expire = Number(data.expire)

    const ex = !isNaN(data.expire) ? data.expire : 60 * 60 * 3
    const key = `${email}:${prfx}:${crypto.createHash('md5').update(JSON.stringify(data.args)).digest('hex')}`

    // test purpose
    if (['test'].includes(String(process.env.NODE_ENV))) {
      const payload = await data.fnc(...data.args)

      if (typeof payload !== 'undefined') {
        tempCache[key] = await data.fnc(...data.args)
      }
      return tempCache[key] ?? null
    }

    const hit = await this.get(key)

    if (hit !== null && !data.upsert) {
      return data.raw ? hit : JSON.parse(hit)
    }

    const result = await data.fnc(...data.args)
    if ([null, undefined].includes(result)) return null

    data.raw
      ? await this.set(key, result, 'EX', ex)
      : await this.set(key, JSON.stringify(result), 'EX', ex)

    return result
  };

  // Drop redis data
  async drop (email: string, key: string): Promise<void> {
    if (['test'].includes(String(process.env.NODE_ENV))) { return }

    const match = await this.keys(`${email}:${key}:*`)
    match.map(async (m) => await this.del(m))
  }

  async isBlacklisted (jwt: string, user: any): Promise<boolean> {
    if (['test'].includes(String(process.env.NODE_ENV))) { return false }

    const hashValue = crypto.createHash('md5')
      .update(JSON.stringify({ token: jwt }))
      .digest('hex').toString()

    const response = await this.sismember(user.id, hashValue)
    return response === 1
  }

  async addToBlackList (req: IUserRequest): Promise<void> {
    // if (['test'].includes(String(process.env.NODE_ENV))) { return }

    const jwt = (req.headers.authorization as string).split(' ')[1]
    const expire = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 2

    const hashValue = crypto.createHash('md5')
      .update(JSON.stringify({ token: jwt }))
      .digest('hex').toString()

    await this.sadd(req.user._id.toString(), hashValue, 'EX', expire)
  }
}
