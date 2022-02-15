import { $log } from '@tsed/common'
import { PlatformExpress } from '@tsed/platform-express'
import db from './services/MongoService'
import { GoldStandard } from './GoldStandard'

async function server (): Promise<void> {
  try {
    Object.assign($log, { name: 'GoldStandard', level: 'info' })
    $log.debug('Start server...')

    const platform = await PlatformExpress.bootstrap(GoldStandard, {
      // extra settings
      port: process.env.PORT ?? 3116,
      logger: { logRequest: false, disableBootstrapLog: true }
    })

    // Test flight.
    if (process.env.AUTO_SHUTDOWN_AFTER !== undefined) {
      const exitAfter = parseInt(process.env.AUTO_SHUTDOWN_AFTER, 10)

      if (!isFinite(exitAfter)) {
        throw new Error('Invalid number passed to env variable AUTO_SHUTDOWN_AFTER')
      }
      $log.info(`Cool, I will shut down after ${exitAfter}`)

      setTimeout(() => {
        $log.info(`Cool, I waited ${exitAfter} seconds and will exit now`)

        platform.stop().then(rr => process.exit(0)).catch(e => { throw e })
      }, exitAfter * 1000)
    }

    await db.connect()
    await platform.listen()

    $log.debug('Server initialized')
  } catch (er) {
    $log.error(er)
  }
}

export default server()
