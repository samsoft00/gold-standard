import { Document, ObjectId } from 'mongodb'

export class PaginateResponse<T extends Document> {
  statusCode: number
  message: string
  data: Array<Partial<T>>
  pagination: {
    total_records: number
    next_cursor?: ObjectId
    previous_cursor?: ObjectId
  }

  constructor (r: T[], totalRecords: number, hasNext: boolean, hasPrev: boolean) {
    this.statusCode = 200
    this.message = 'successful'
    this.data = r
    this.pagination = {
      total_records: totalRecords,
      ...(hasNext && { next_cursor: r[r.length - 1]._id }),
      ...(hasPrev && { previous_cursor: r[0]._id })
    }
  }
}
