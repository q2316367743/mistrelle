import { requestDownload } from '@/plugin/http'
import HttpProgressEvent from '@/domain/HttpProgressEvent'

export const apiV1Download = (
  slug: string,
  path: string,
  onDownloadProgress?: (progressEvent: HttpProgressEvent) => void
) => {
  return requestDownload(
    {
      baseURL: 'https://api.skillhub.cn',
      url: '/api/v1/download',
      params: {
        slug: slug
      },
      onDownloadProgress
    },
    path
  )
}
