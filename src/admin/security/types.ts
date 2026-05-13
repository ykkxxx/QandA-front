/** 与后端统一包装一致：`code === 0` 成功 */
export interface BaseResponse<T> {
  code: number
  data: T | null
  message: string
}

/** 黑名单分页单条（下划线字段与后端 JSON 一致） */
export interface BlacklistRow {
  id: number | string
  block_type: string
  block_value: string
  reason?: string | null
  created_at?: string | null
}

/** MyBatis-Plus Page JSON（字段以后端为准，此处为常用子集） */
export interface BlacklistPage {
  records: BlacklistRow[]
  total: number
  size: number
  current: number
  pages?: number
  [key: string]: unknown
}

export type BlockType = 'IP' | 'USERNAME' | 'USER_ID'
