import { OpenSpec3, OpenSpecInfo } from '@tsed/openspec'

const specInfo: OpenSpecInfo = {
  title: 'Gold Standard Corp API',
  version: require('../../package.json').version,
  description: 'An API documented for Gold Standard Corp'
}

export const specOS3: Partial<OpenSpec3> = {
  info: specInfo,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: ''
      }
    }
  }
}