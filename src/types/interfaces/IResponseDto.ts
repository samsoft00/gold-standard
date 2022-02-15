export class IResponseDto<T> {
  statusCode: number
  message: string
  data: T
}
