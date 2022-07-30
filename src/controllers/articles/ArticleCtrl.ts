import { BodyParams, PathParams, QueryParams, Req } from '@tsed/common'
import { Configuration, Controller } from '@tsed/di'
import { Delete, Get, Post, Put } from '@tsed/schema'
import { pick } from 'lodash'
import { v4, validate } from 'uuid'
import { Collection, Sort, ObjectId } from 'mongodb'
import Joi from 'joi'
import dbMgr from '../../services/MongoService'
import { Article, ArticleStatus, PaginateResponse } from '../../types'
import { IResponseDto } from '../../types/interfaces/IResponseDto'
import dayjs from 'dayjs'
import { BadRequest } from '@tsed/exceptions'

interface ArticleQuery{
  limit: number
  status?: ArticleStatus
  parmlink?: string
  date_published?: string
  previous_cursor?: string
  next_cursor?: string
}

const schma = Joi.object().keys({
  topic: Joi.string().label('Topic').required(),
  subtitle: Joi.string().label('subtitle').optional(),
  content: Joi.string().label('content').required(),
  image_path: Joi.string().label('image').optional(),
  status: Joi.string().label('status').optional()
})

/**
 * Create
 * Update
 * Edit
 * Delete
 */
@Controller({ path: '/article' })
export class ArticleCtrl {
  Article: Collection<Article>

  constructor (@Configuration() readonly config: Configuration) {
    this.Article = dbMgr.db().collection('articles')
  }

  @Post('/')
  async createArticle (@Req() req: Req, @BodyParams() body: Partial<Article>): Promise<IResponseDto<any>> {
    const payload = pick(body, [
      'topic',
      'subtitle',
      'content',
      'image_path'
    ])

    // validate body
    const i = await schma.validateAsync(payload)
    Object.assign(i, {
      parmlink: v4(),
      status: 'published',
      created_at: new Date(),
      updated_at: new Date()
    })

    const content = await this.Article.insertOne(i)

    return {
      data: content,
      statusCode: 200,
      message: 'Article created'
    }
  }

  @Get('/')
  async getArticles (@QueryParams() payload: ArticleQuery): Promise<any> {
    const sort: Sort = { _id: -1, created_at: -1 }
    const limit = +payload.limit > 30 ? 30 : +payload.limit
    const qryPrev = payload.previous_cursor !== undefined && ObjectId.isValid(payload.previous_cursor)
    const qryNext = payload.next_cursor !== undefined && ObjectId.isValid(payload.next_cursor)

    const matchQry = {
      ...(payload.status !== undefined && { status: { $eq: payload.status } }),
      ...(payload.parmlink !== undefined && { parmlink: { $eq: payload.parmlink } }),
      ...(payload.date_published !== undefined && { date_published: { $lte: dayjs(payload.date_published).startOf('day').toDate() } })
    }

    let hasNext: boolean = false
    let hasPrev: boolean = false

    if (qryPrev) {
      Object.assign(matchQry, { _id: { $gt: new dbMgr.Id(payload.previous_cursor) } })
      sort._id = 1
    } else if (qryNext) {
      Object.assign(matchQry, { _id: { $lt: new dbMgr.Id(payload.next_cursor) } })
    }

    const { articles, count } = await new Promise<{articles: Article[], count: number}>((resolve, reject) => {
      Promise.all([
        this.Article.aggregate<Article>([{ $match: matchQry }])
          .sort(sort)
          .limit(limit)
          .toArray(),
        this.Article.countDocuments(matchQry)
      ])
        .then(([articles, count]) => resolve({ articles, count }))
        .catch(reject)
    })

    if (qryPrev) articles.reverse()

    if (articles.length > 0) {
      Object.assign(matchQry, { _id: { $lt: new dbMgr.Id(articles[articles.length - 1]._id) } })
      let check = await this.Article.findOne(matchQry)
      hasNext = check !== null

      Object.assign(matchQry, { _id: { $gt: new dbMgr.Id(articles[0]._id) } })
      check = await this.Article.findOne(matchQry)
      hasPrev = check !== null
    }

    return new PaginateResponse(articles, count, hasNext, hasPrev)
  }

  @Get('/:id')
  async getArticleById (@PathParams('id') parmlink: string): Promise<IResponseDto<Article>> {
    if (!validate(parmlink)) throw new BadRequest('Invalid parmlink')

    const article = await this.Article.findOne<Article>({ parmlink })
    if (article === null) {
      throw new BadRequest('Article not found')
    }

    return {
      data: article,
      statusCode: 200,
      message: 'Article found'
    }
  }

  @Put('/:id')
  async updateArticle (
    @PathParams('id') parmlink: string,
      @BodyParams() body: Partial<Article>): Promise<IResponseDto<Article>> {
    if (!validate(parmlink)) throw new BadRequest('Invalid parmlink')

    const ERR_MSG = 'Error occur while updating article, kindly confirm and try again'

    const i = await schma.validateAsync(body)
    Object.assign(i, { updated_at: new Date() })

    const result = await this.Article.findOneAndUpdate(
      { parmlink },
      { $set: body },
      { returnDocument: 'after' })

    if (result.ok !== 1) throw new BadRequest(ERR_MSG)
    if ((result.lastErrorObject != null) &&
    'updatedExisting' in result.lastErrorObject &&
    result.lastErrorObject.updatedExisting !== true) {
      throw new BadRequest(ERR_MSG)
    }

    return {
      statusCode: 200,
      data: result.value as Article,
      message: 'Article updated'
    }
  }

  @Delete('/:id')
  async deleteArticle (@PathParams('id') parmlink: string): Promise<IResponseDto<any>> {
    if (!validate(parmlink)) throw new BadRequest('Invalid parmlink')

    const result = await this.Article.deleteOne({ parmlink })

    if (!result.acknowledged) throw new BadRequest('Error occur while deleting article')

    return {
      statusCode: 200,
      message: 'Article deleted',
      data: null
    }
  }
}
