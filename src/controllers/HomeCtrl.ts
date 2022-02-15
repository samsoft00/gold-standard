import { Controller, Get, Res } from '@tsed/common'
import { Hidden } from '@tsed/swagger'

@Hidden()
@Controller({ path: '/' })
export class HomeCtrl {
  @Get('/')
  index (@Res() res: Res): void {
    res.status(200).json({
      message: 'Gold Standard Endpoint v1.0.0'
    })
  }
}
