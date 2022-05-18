import { Configuration, Injectable, ProviderScope, ProviderType } from '@tsed/common'
import 'dotenv/config'
import { Db, MongoClient, ObjectId } from 'mongodb'
import { detach } from '../utils/detach'

let db: Db, client: MongoClient
const DB_URL = process.env.DB_URL ?? 'mongodb+srv://lamarr:lamarrpassword@cluster0.mbq3p.mongodb.net/myFirstDatabase?retryWrites=true&w=majority'
const MAX_POOL_SIZE: any = process.env.MAX_POOL_SIZE ?? 50

export default {
  Id: ObjectId,
  db: () => {
    return db
  },
  client: () => {
    return client
  },
  connect: async () => {
    client = new MongoClient(DB_URL, {
      maxPoolSize: MAX_POOL_SIZE
    })

    await client.connect()
    db = client.db(process.env.DB_NAME)
  },
  close: async () => {
    return detach(client.close())
  }
}

@Injectable({
  type: ProviderType.SERVICE,
  scope: ProviderScope.SINGLETON
})
export class MongoService {
  private db: Db
  private client: MongoClient

  constructor (@Configuration() readonly config: Configuration) {}

  public getDb (): Db {
    return this.db
  }

  getClient (): MongoClient {
    return this.client
  }

  async connect (): Promise<void> {
    const configKey = this.config.get<{[key: string]: string}>('database')

    this.client = new MongoClient(configKey.DB_URL, {
      maxPoolSize: Number(configKey.MAX_POOL_SIZE)
    })

    await client.connect()
    this.db = client.db(configKey.DB_NAME)
  }

  async close (): Promise<void> {
    return detach(client.close())
  }
}
