import type { ArticleMetadata } from '~/utils/download/types';
import { request } from '#shared/utils/request';

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
  const resp = await request<{ success: boolean }>('/api/data/metadata/update', {
    method: 'POST',
    body: metadata,
  });
  return resp.success;
}

/**
 * 获取 metadata
 * @param url
 */
export async function getMetadataCache(url: string): Promise<Metadata | undefined> {
  return request<Metadata | undefined>('/api/data/metadata/get', {
    query: {
      url: url,
    },
  });
}
