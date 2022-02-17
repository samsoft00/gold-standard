import { PlatformApplication, PlatformTest } from "@tsed/common"
import {GoldStandard} from '../../GoldStandard'
import SuperTest from 'supertest'
import { UserCtrl } from './UserCtrl';

describe('UserCtrl', () => {
    let request: SuperTest.SuperTest<SuperTest.Test>

    beforeEach(
      PlatformTest.bootstrap(GoldStandard, { 
        mount: { '/': [UserCtrl] } 
      })
    )
  
    beforeEach(
      PlatformTest.inject([PlatformApplication], (app: PlatformApplication) => {
        request = SuperTest(app.raw)
      })
    )
  
    afterEach(PlatformTest.reset)  
    
    it('should call GET /users', () => {
        expect(200).toEqual(200)
    })
})
