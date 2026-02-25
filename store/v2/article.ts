import type { AppMsgExWithFakeID, PublishPage } from '~/types/types';
import { request } from '#shared/utils/request';
import type { Info } from './info';

export type ArticleAsset = AppMsgExWithFakeID;

/**
 * 更新文章缓存
 * @param account
 * @param publish_page
 */
export async function updateArticleCache(account: Info, publish_page: PublishPage) {
  await request<{ success: boolean }>('/api/data/article/sync', {
    method: 'POST',
    body: {
      account: account,
      publish_page: publish_page,
    },
  });
}

/**
 * 检查是否存在指定时间之前的缓存
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function hitCache(fakeid: string, create_time: number): Promise<boolean> {
  const resp = await request<{ hit: boolean }>('/api/data/article/hit', {
    query: {
      fakeid: fakeid,
      create_time: create_time,
    },
  });
  return !!resp.hit;
}

/**
 * 读取缓存中的指定时间之前的历史文章
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function getArticleCache(fakeid: string, create_time: number): Promise<AppMsgExWithFakeID[]> {
  return request<AppMsgExWithFakeID[]>('/api/data/article/cache', {
    query: {
      fakeid: fakeid,
      create_time: create_time,
    },
  });
}

/**
 * 根据 url 获取文章对象
 * @param url
 */
export async function getArticleByLink(url: string): Promise<AppMsgExWithFakeID> {
  const article = await request<AppMsgExWithFakeID | undefined>('/api/data/article/by-link', {
    query: {
      url: url,
    },
  });
  if (!article) {
    throw new Error(`Article(${url}) does not exist`);
  }
  return article;
}

/**
 * 文章被删除
 * @param url
 */
export async function articleDeleted(url: string): Promise<void> {
  await request<{ success: boolean }>('/api/data/article/deleted', {
    method: 'POST',
    body: {
      url: url,
    },
  });
}

export async function upsertArticle(article: AppMsgExWithFakeID): Promise<boolean> {
  const resp = await request<{ success: boolean }>('/api/data/article/upsert', {
    method: 'POST',
    body: article,
  });
  return resp.success;
}

export async function deleteArticle(fakeid: string, aid: string, link?: string): Promise<boolean> {
  const resp = await request<{ success: boolean }>('/api/data/article/delete', {
    method: 'POST',
    body: {
      fakeid: fakeid,
      aid: aid,
      link: link,
    },
  });
  return resp.success;
}
