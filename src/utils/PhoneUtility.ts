import { BadRequest } from '@tsed/exceptions'
import phoneUtil from 'google-libphonenumber'

const phoneUtilInstance = phoneUtil.PhoneNumberUtil.getInstance()
const { E164 } = phoneUtil.PhoneNumberFormat

export class PhoneUtility {
  /**
     * Method to format phone number
     * @param {number} phone
     */
  formatPhoneNumber (phone: string): string {
    const number = phoneUtilInstance.parseAndKeepRawInput(phone, 'NG')

    const check = phoneUtilInstance.isValidNumberForRegion(number, 'NG')
    if (!check) throw new BadRequest('Invalid phone number, check and try again!') // eslint-disable-line

    return phoneUtilInstance.format(number, E164)
  }
}
