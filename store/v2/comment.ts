import { request } from '#shared/utils/request';
import { db } from './db';

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
  try {
    const resp = await request<{ success: boolean }>('/api/data/comment/update', {
      method: 'POST',
      body: comment,
    });
    return resp.success;
  } catch (error) {
    console.warn('Fallback to local Dexie for updateCommentCache:', error);
    return db.transaction('rw', 'comment', () => {
      db.comment.put(comment);
      return true;
    });
  }
}

/**
 * 获取 comment 缓存
 * @param url
 */
export async function getCommentCache(url: string): Promise<CommentAsset | undefined> {
  try {
    return await request<CommentAsset | undefined>('/api/data/comment/get', {
      query: {
        url: url,
      },
    });
  } catch (error) {
    console.warn('Fallback to local Dexie for getCommentCache:', error);
    return db.comment.get(url);
  }
}
