import type { AppMsgExWithFakeID, PublishInfo, PublishPage } from '~/types/types';
import { request } from '#shared/utils/request';
import { db } from './db';
import { type Info, updateInfoCache } from './info';

export type ArticleAsset = AppMsgExWithFakeID;

async function updateArticleCacheLocally(account: Info, publish_page: PublishPage): Promise<void> {
  await db.transaction('rw', ['article', 'info'], async () => {
    const keys = await db.article.toCollection().keys();

    const fakeid = account.fakeid;
    const total_count = publish_page.total_count;
    const publish_list = publish_page.publish_list.filter(item => !!item.publish_info);

    let msgCount = 0;
    let articleCount = 0;

    for (const item of publish_list) {
      const publish_info: PublishInfo = JSON.parse(item.publish_info);
      let newEntryCount = 0;

      for (const article of publish_info.appmsgex) {
        const key = await db.article.put({ ...article, fakeid }, `${fakeid}:${article.aid}`);
        if (!keys.includes(key)) {
          newEntryCount++;
          articleCount++;
        }
      }

      if (newEntryCount > 0) {
        msgCount++;
      }
    }

    await updateInfoCache({
      fakeid: fakeid,
      completed: publish_list.length === 0,
      count: msgCount,
      articles: articleCount,
      nickname: account.nickname,
      round_head_img: account.round_head_img,
      total_count: total_count,
    });
  });
}

/**
 * 更新文章缓存
 * @param account
 * @param publish_page
 */
export async function updateArticleCache(account: Info, publish_page: PublishPage) {
  try {
    await request<{ success: boolean }>('/api/data/article/sync', {
      method: 'POST',
      body: {
        account: account,
        publish_page: publish_page,
      },
    });
  } catch (error) {
    console.warn('Fallback to local Dexie for updateArticleCache:', error);
    await updateArticleCacheLocally(account, publish_page);
  }
}

async function hitCacheLocally(fakeid: string, create_time: number): Promise<boolean> {
  const count = await db.article
    .where('fakeid')
    .equals(fakeid)
    .and(article => article.create_time < create_time)
    .count();
  return count > 0;
}

async function getArticleCacheLocally(fakeid: string, create_time: number): Promise<AppMsgExWithFakeID[]> {
  return db.article
    .where('fakeid')
    .equals(fakeid)
    .and(article => article.create_time < create_time)
    .reverse()
    .sortBy('create_time');
}

async function getArticleByLinkLocally(url: string): Promise<AppMsgExWithFakeID | undefined> {
  return db.article.where('link').equals(url).first();
}

async function markArticleDeletedLocally(url: string): Promise<void> {
  await db.transaction('rw', 'article', async () => {
    await db.article
      .where('link')
      .equals(url)
      .modify(article => {
        article.is_deleted = true;
      });
  });
}

/**
 * 检查是否存在指定时间之前的缓存
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function hitCache(fakeid: string, create_time: number): Promise<boolean> {
  try {
    const resp = await request<{ hit: boolean }>('/api/data/article/hit', {
      query: {
        fakeid: fakeid,
        create_time: create_time,
      },
    });
    return !!resp.hit;
  } catch (error) {
    console.warn('Fallback to local Dexie for hitCache:', error);
    return hitCacheLocally(fakeid, create_time);
  }
}

/**
 * 读取缓存中的指定时间之前的历史文章
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function getArticleCache(fakeid: string, create_time: number): Promise<AppMsgExWithFakeID[]> {
  try {
    return request<AppMsgExWithFakeID[]>('/api/data/article/cache', {
      query: {
        fakeid: fakeid,
        create_time: create_time,
      },
    });
  } catch (error) {
    console.warn('Fallback to local Dexie for getArticleCache:', error);
    return getArticleCacheLocally(fakeid, create_time);
  }
}

/**
 * 根据 url 获取文章对象
 * @param url
 */
export async function getArticleByLink(url: string): Promise<AppMsgExWithFakeID> {
  let article: AppMsgExWithFakeID | undefined;
  try {
    article = await request<AppMsgExWithFakeID | undefined>('/api/data/article/by-link', {
      query: {
        url: url,
      },
    });
  } catch (error) {
    console.warn('Fallback to local Dexie for getArticleByLink:', error);
  }
  if (!article) {
    article = await getArticleByLinkLocally(url);
  }
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
  try {
    await request<{ success: boolean }>('/api/data/article/deleted', {
      method: 'POST',
      body: {
        url: url,
      },
    });
  } catch (error) {
    console.warn('Failed to update backend deleted state:', error);
  }

  await markArticleDeletedLocally(url);
}

export async function upsertArticle(article: AppMsgExWithFakeID): Promise<boolean> {
  try {
    const resp = await request<{ success: boolean }>('/api/data/article/upsert', {
      method: 'POST',
      body: article,
    });
    return resp.success;
  } catch (error) {
    console.warn('Fallback to local Dexie for upsertArticle:', error);
    const key = `${article.fakeid}:${article.aid}`;
    await db.article.put(article, key);
    return true;
  }
}

export async function deleteArticle(fakeid: string, aid: string, link?: string): Promise<boolean> {
  try {
    const resp = await request<{ success: boolean }>('/api/data/article/delete', {
      method: 'POST',
      body: {
        fakeid: fakeid,
        aid: aid,
        link: link,
      },
    });
    return resp.success;
  } catch (error) {
    console.warn('Fallback to local Dexie for deleteArticle:', error);
    await db.article.delete(`${fakeid}:${aid}`);
    return true;
  }
}
