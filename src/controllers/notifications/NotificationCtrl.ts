import { Controller } from '@tsed/di'
import { Authorize } from '@tsed/passport'

@Authorize()
@Controller({ path: '/notification' })
export class NotificationCtrl {}
