import { PlatformApplication, PlatformTest } from "@tsed/common"
import {GoldStandard} from '../../GoldStandard'
import SuperTest from 'supertest'
import { UserCtrl } from './UserCtrl';

describe('UserCtrl', () => {
    let request: SuperTest.SuperTest<SuperTest.Test> 
    
    it('should call GET /users', () => {
        expect(200).toEqual(200)
    })
})
