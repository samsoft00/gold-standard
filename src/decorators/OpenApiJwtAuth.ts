import { useDecorators } from '@tsed/core'
import { Unauthorized } from '@tsed/exceptions'
import { Authenticate, AuthorizeOptions } from '@tsed/passport'
import { In, Returns, Security } from '@tsed/schema'

/**
 * Set JwtAuth access on decorated route
 * @param options
 */
export function OpenApiJwtAuth (options: AuthorizeOptions = {}): any {
  return useDecorators(
    Authenticate('jwt', options),
    Security('jwt'),
    Returns(401, Unauthorized).Description('Unauthorized'),
    In('header').Name('Authorization').Description('Jwt authorization').Type(String).Required(false)
  )
}
