import Bugsnag from '@bugsnag/js'
import { BaseContext, Catch, ExceptionFilterMethods, PlatformContext } from '@tsed/common'
import { PassportException } from '@tsed/passport'
import { Exception } from '@tsed/exceptions'

const NODE_ENV = String(process.env.NODE_ENV)

@Catch(PassportException)
export class PassportExceptionFilter implements ExceptionFilterMethods {
  async catch (e: PassportException, ctx: PlatformContext): Promise<void> {
    const { response } = ctx

    let message = e.message ?? 'Authentication error, please login again'
    let status = 401

    switch (e.name) {
      case 'AuthenticationError':
        message = 'Invalid or expired Authentication, please login again'
        status = e.status
        break

      default:
        if (['production'].includes(NODE_ENV)) {
          Bugsnag.notify(e)
          message = 'There has been an error with your request. Try again later.'
        }
        break
    }

    response.status(status).body({ statusCode: status, message })
  }
}

/**
 * Catch Errors
 */
@Catch(Exception)
export class ExceptionHandler implements ExceptionFilterMethods {
  catch (e: Exception, ctx: PlatformContext): void {
    const { response } = ctx

    let message = e.message
    let status = 400

    switch (e.name) {
      case 'BAD_REQUEST':
      case 'UNAUTHORIZED':
        message = e.message
        status = e.status
        break
      default:
        if (['production'].includes(NODE_ENV)) {
          Bugsnag.notify(e)
          message = 'There has been an error with your request. Try again later.'
        }
        break
    }

    response
      .status(status)
      .body({ statusCode: status, message })
  }
}

/**
 * catch validation errors
 */
@Catch(Error)
export class ErrorHandler implements ExceptionFilterMethods {
  catch (e: Exception, ctx: PlatformContext): void {
    const { response } = ctx

    let message = e.message
    let status = 400

    switch (e.name) {
      case 'NotFoundError':
      case 'NotFound':
        message = e.message ?? 'Resources does not exist'
        status = 404
        break

      case 'CustomError':
      case 'ValidationError':
        message = e.message
        // status = e.status
        break

      case 'UNAUTHORIZED':
        status = 401
        message = e.message
        break

      default:
        if (['production'].includes(NODE_ENV)) {
          Bugsnag.notify(e)
          message = 'There has been an error with your request. Try again later.'
        }
        break
    }

    const obj = { statusCode: status, message }

    response
      .status(status)
      .body(obj)
  }
}

/**
 * MongooseErrorFilter.catch
 * PlatformExceptions.catch
 */
@Catch('MongoError')
export class MongoHandler implements ExceptionFilterMethods {
  catch (e: any, ctx: BaseContext): void {
    const { response } = ctx

    let message = e.message
    const status = 400

    if (Object.is(e.code, 11000)) {
      const target: string[] = Object.values(e.keyValue)
      message = `${target[0]} is already in use`
    }

    const obj = { statusCode: status, message }

    response
      .status(status)
      .body(obj)
  }
}
