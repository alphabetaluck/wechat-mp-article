import { request } from '#shared/utils/request';

export interface CommentAsset {
  fakeid: string;
  url: string;
  title: string;
  data: any;
}

/**
 * 更新 comment 缓存
 * @param comment 缓存
 */
export async function updateCommentCache(comment: CommentAsset): Promise<boolean> {
  const resp = await request<{ success: boolean }>('/api/data/comment/update', {
    method: 'POST',
    body: comment,
  });
  return resp.success;
}

/**
 * 获取 comment 缓存
 * @param url
 */
export async function getCommentCache(url: string): Promise<CommentAsset | undefined> {
  return request<CommentAsset | undefined>('/api/data/comment/get', {
    query: {
      url: url,
    },
  });
}
