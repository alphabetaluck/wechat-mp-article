import type { ArticleMetadata } from '~/utils/download/types';
import { request } from '#shared/utils/request';
import { db } from './db';

export type Metadata = ArticleMetadata & {
  fakeid: string;
  url: string;
  title: string;
};

/**
 * 更新 metadata
 * @param metadata
 */
export async function updateMetadataCache(metadata: Metadata): Promise<boolean> {
  try {
    const resp = await request<{ success: boolean }>('/api/data/metadata/update', {
      method: 'POST',
      body: metadata,
    });
    return resp.success;
  } catch (error) {
    console.warn('Fallback to local Dexie for updateMetadataCache:', error);
    return db.transaction('rw', 'metadata', () => {
      db.metadata.put(metadata);
      return true;
    });
  }
}

/**
 * 获取 metadata
 * @param url
 */
export async function getMetadataCache(url: string): Promise<Metadata | undefined> {
  try {
    return await request<Metadata | undefined>('/api/data/metadata/get', {
      query: {
        url: url,
      },
    });
  } catch (error) {
    console.warn('Fallback to local Dexie for getMetadataCache:', error);
    return db.metadata.get(url);
  }
}
