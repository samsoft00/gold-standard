import { AnyObject } from '.'

export type ArticleStatus = 'draft' | 'published' | 'archived'

export interface Article {
  _id: string
  topic: string
  subtitle: AnyObject
  content: string
  image_path: string
  date_published: Date
  parmlink: string
  status: ArticleStatus
  created_at: Date
  updated_at: Date
}
