import { request } from '#shared/utils/request';

export interface CommentReplyAsset {
  fakeid: string;
  url: string;
  title: string;
  data: any;
  contentID: string;
}

/**
 * 更新 comment 缓存
 * @param reply 缓存
 */
export async function updateCommentReplyCache(reply: CommentReplyAsset): Promise<boolean> {
  const resp = await request<{ success: boolean }>('/api/data/comment-reply/update', {
    method: 'POST',
    body: reply,
  });
  return resp.success;
}

/**
 * 获取 comment 缓存
 * @param url
 * @param contentID
 */
export async function getCommentReplyCache(url: string, contentID: string): Promise<CommentReplyAsset | undefined> {
  return request<CommentReplyAsset | undefined>('/api/data/comment-reply/get', {
    query: {
      url: url,
      contentID: contentID,
    },
  });
}
