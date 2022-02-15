import BugsnagPluginExpress from '@bugsnag/plugin-express'
import dotenv from 'dotenv'
import Bugsnag from '@bugsnag/js'

dotenv.config()

Bugsnag.start({
  apiKey: String(process.env.BUGSNAP_API_KEY),
  appType: 'gsc-standard',
  plugins: [BugsnagPluginExpress],
  enabledReleaseStages: ['production', 'staging', 'development', 'dev'],
  logger: null
})

export { Bugsnag as BugsnagHandler }
