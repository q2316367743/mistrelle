import type { BookmarkFolder, BookmarkItem } from '@common/entity/bookmark'

export interface CreateBookmarkFolderPayload {
  parent_id: string
  name: string
  sort_order?: number
}

export type UpdateBookmarkFolderPayload = Partial<CreateBookmarkFolderPayload>

export interface CreateBookmarkItemPayload {
  folder_id: string
  url: string
  title: string
  description?: string
  icon_path?: string
  sort_order?: number
  open_with?: 0 | 1
  script?: string
  user_agent?: string
  width?: number
  height?: number
  min_width?: number
  min_height?: number
}

export type UpdateBookmarkItemPayload = Partial<CreateBookmarkItemPayload>

export interface BookmarkImportIconTask {
  bookmarkId: string
  iconUrl: string
  extension: string
  savePath: string
}

export interface BookmarkImportResult {
  folders: BookmarkFolder[]
  items: BookmarkItem[]
  iconTasks: BookmarkImportIconTask[]
}
