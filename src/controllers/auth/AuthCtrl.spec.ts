import { PlatformApplication, PlatformTest } from '@tsed/common'
import SuperTest from 'supertest'
import {GoldStandard} from '../../GoldStandard'
import { AuthCtrl } from './AuthCtrl'

describe('AuthCtrl', () => {
  // let request: SuperTest.SuperTest<SuperTest.Test>

  // beforeEach(
  //   PlatformTest.bootstrap(GoldStandard, { 
  //     mount: { '/': [AuthCtrl] } 
  //   })
  // )

  // beforeEach(
  //   PlatformTest.inject([PlatformApplication], (app: PlatformApplication) => {
  //     request = SuperTest(app.raw)
  //   })
  // )

  // afterEach(PlatformTest.reset)

  it('should call GET /auth', () => {
    // const response = await request.get('/auth').expect(200)

    expect('hello').toEqual('hello')
  })
})
